require("dotenv").config();
const express = require("express");
const path = require("node:path");
const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { readStore, writeStore } = require("./src/store");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const JWT_SECRET = process.env.JWT_SECRET || "local-development-secret-change-before-deployment";
if (!process.env.JWT_SECRET) {
  if (IS_PRODUCTION) { console.error("JWT_SECRET is required in production."); process.exit(1); }
  console.warn("WARNING: JWT_SECRET is using a local-development fallback. Set it before deployment.");
}

// Hosts such as Render/Railway put the app behind a reverse proxy; trust one hop so
// req.ip (used by the rate limiter) is the real client address.
app.set("trust proxy", 1);
app.disable("x-powered-by");

const cspDirectives = {
  styleSrc: ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
  fontSrc: ["'self'", "https://fonts.gstatic.com"]
};
// Helmet's default "upgrade-insecure-requests" breaks http://localhost in Safari. Keep it in production only.
if (!IS_PRODUCTION) cspDirectives.upgradeInsecureRequests = null;
app.use(helmet({ contentSecurityPolicy: { directives: cspDirectives } }));
app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: false, limit: "50kb" }));
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false,
  message: { error: "Too many authentication attempts. Please wait and try again." } });

const safeUser = ({ id, name, email, createdAt }) => ({ id, name, email, createdAt });
const tokenFor = user => jwt.sign({ sub: user.id }, JWT_SECRET, { algorithm: "HS256", expiresIn: "7d" });
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Please sign in to continue." });
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    const user = readStore().users.find(item => item.id === payload.sub);
    if (!user) return res.status(401).json({ error: "Account not found. Please sign in again." });
    req.user = user;
    next();
  } catch (error) {
    if (["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"].includes(error.name)) return res.status(401).json({ error: "Your session has expired. Please sign in again." });
    next(error);
  }
}
function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  // Round-trip check rejects impossible dates such as 2026-02-31 or 2026-99-99.
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function validateTask(body) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const status = body.status || "todo";
  const priority = body.priority || "medium";
  const dueDate = typeof body.dueDate === "string" ? body.dueDate : "";
  if (title.length < 2 || title.length > 120) return { error: "Task title must be between 2 and 120 characters." };
  if (description.length > 2000) return { error: "Description must be 2,000 characters or fewer." };
  if (!["todo", "in_progress", "done"].includes(status)) return { error: "Choose a valid task status." };
  if (!["low", "medium", "high"].includes(priority)) return { error: "Choose a valid priority." };
  if (dueDate && !isValidDate(dueDate)) return { error: "Enter a valid due date (YYYY-MM-DD)." };
  return { value: { title, description, status, priority, dueDate } };
}

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.post("/api/auth/register", authLimiter, async (req, res, next) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";
    if (name.length < 2 || name.length > 60) return res.status(400).json({ error: "Name must be between 2 and 60 characters." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ error: "Enter a valid email address." });
    // bcrypt only uses the first 72 BYTES, so measure bytes rather than characters.
    if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) return res.status(400).json({ error: "Password must be at least 8 characters and at most 72 bytes." });
    // Do the slow async work first; everything after this point is synchronous, so no other
    // request can modify the store between our read and our write.
    const passwordHash = await bcrypt.hash(password, 12);
    const store = readStore();
    if (store.users.some(user => user.email === email)) return res.status(409).json({ error: "An account with this email already exists." });
    const user = { id: crypto.randomUUID(), name, email, passwordHash, createdAt: new Date().toISOString() };
    store.users.push(user); writeStore(store);
    res.status(201).json({ token: tokenFor(user), user: safeUser(user) });
  } catch (error) { next(error); }
});
app.post("/api/auth/login", authLimiter, async (req, res, next) => {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";
    const user = readStore().users.find(item => item.email === email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: "Email or password is incorrect." });
    res.json({ token: tokenFor(user), user: safeUser(user) });
  } catch (error) { next(error); }
});
app.get("/api/auth/me", requireAuth, (req, res) => res.json({ user: safeUser(req.user) }));
app.get("/api/tasks", requireAuth, (req, res, next) => {
  try {
    const tasks = readStore().tasks.filter(task => task.userId === req.user.id).sort((a, b) => {
      return (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31") || b.updatedAt.localeCompare(a.updatedAt);
    });
    res.json({ tasks });
  } catch (error) { next(error); }
});
app.post("/api/tasks", requireAuth, (req, res, next) => {
  try {
    const validation = validateTask(req.body);
    if (validation.error) return res.status(400).json({ error: validation.error });
    const now = new Date().toISOString();
    const task = { id: crypto.randomUUID(), userId: req.user.id, ...validation.value, createdAt: now, updatedAt: now };
    const store = readStore(); store.tasks.push(task); writeStore(store);
    res.status(201).json({ task });
  } catch (error) { next(error); }
});
app.patch("/api/tasks/:id", requireAuth, (req, res, next) => {
  try {
    const store = readStore();
    const index = store.tasks.findIndex(task => task.id === req.params.id && task.userId === req.user.id);
    if (index === -1) return res.status(404).json({ error: "Task not found." });
    const current = store.tasks[index];
    const validation = validateTask({ title: req.body.title ?? current.title, description: req.body.description ?? current.description,
      status: req.body.status ?? current.status, priority: req.body.priority ?? current.priority, dueDate: req.body.dueDate ?? current.dueDate });
    if (validation.error) return res.status(400).json({ error: validation.error });
    const updated = { ...current, ...validation.value, updatedAt: new Date().toISOString() };
    store.tasks[index] = updated; writeStore(store); res.json({ task: updated });
  } catch (error) { next(error); }
});
app.delete("/api/tasks/:id", requireAuth, (req, res, next) => {
  try {
    const store = readStore();
    const index = store.tasks.findIndex(task => task.id === req.params.id && task.userId === req.user.id);
    if (index === -1) return res.status(404).json({ error: "Task not found." });
    store.tasks.splice(index, 1); writeStore(store); res.status(204).end();
  } catch (error) { next(error); }
});
app.use("/api", (req, res) => res.status(404).json({ error: "API endpoint not found." }));
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"], maxAge: IS_PRODUCTION ? "1h" : 0 }));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});
app.listen(PORT, () => console.log(`TaskFlow running at http://localhost:${PORT}`));
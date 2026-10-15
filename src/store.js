const fs = require("node:fs");
const path = require("node:path");
const dir = path.join(__dirname, "..", "data");
const file = path.join(dir, "store.json");

function ensureStore() {
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify({ users: [], tasks: [] }, null, 2));
}
function readStore() {
  ensureStore();
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(data.users) || !Array.isArray(data.tasks)) throw new Error("Invalid data store format.");
  return data;
}
function writeStore(data) {
  ensureStore();
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(temp, file);
}
module.exports = { readStore, writeStore };

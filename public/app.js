const TOKEN_KEY = "taskflow_access_token";
const authView = document.getElementById("authView");
const dashboardView = document.getElementById("dashboardView");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const authError = document.getElementById("authError");
const taskDialog = document.getElementById("taskDialog");
const taskForm = document.getElementById("taskForm");
const taskList = document.getElementById("taskList");
const taskTemplate = document.getElementById("taskTemplate");
const toast = document.getElementById("toast");
const state = { token: localStorage.getItem(TOKEN_KEY) || "", user: null, tasks: [], filter: "all", search: "", priority: "all", editingTaskId: null, toastTimeout: null };
const filterNames = { all: "All tasks", todo: "To do", in_progress: "In progress", done: "Completed" };

function showToast(message, isError = false) {
  clearTimeout(state.toastTimeout);
  toast.textContent = message;
  toast.className = `toast show${isError ? " error" : ""}`;
  state.toastTimeout = setTimeout(() => { toast.className = "toast"; }, 3200);
}
function setAuthError(message = "") { authError.textContent = message; }
function initials(name) { return (name || "User").trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase(); }
function setBusy(button, busy, label) {
  if (busy) { button.dataset.originalText = button.innerHTML; button.disabled = true; button.textContent = label; }
  else { button.disabled = false; if (button.dataset.originalText) button.innerHTML = button.dataset.originalText; }
}
async function api(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(url, { ...options, headers });
  if (response.status === 204) return null;
  let data = {};
  try { data = await response.json(); } catch (_) { /* The server may return no JSON body. */ }
  if (!response.ok) {
    if (response.status === 401 && state.token && !url.startsWith("/api/auth/")) signOut(false);
    throw new Error(data.error || "Something went wrong. Please try again.");
  }
  return data;
}
// Same ordering the server uses for GET /api/tasks: due date first (no date last), then most recently updated.
function compareTasks(a, b) {
  return (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31") || b.updatedAt.localeCompare(a.updatedAt);
}
function sortTasks() { state.tasks.sort(compareTasks); }
function switchAuthTab(tab) {
  const isRegister = tab === "register";
  loginForm.classList.toggle("hidden", isRegister);
  registerForm.classList.toggle("hidden", !isRegister);
  document.querySelectorAll("[data-auth-tab]").forEach(button => {
    const active = button.dataset.authTab === tab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.getElementById("authTitle").textContent = isRegister ? "Create your account" : "Welcome back";
  document.getElementById("authSubtitle").textContent = isRegister ? "Start organizing your work in a few seconds." : "Sign in to pick up where you left off.";
  setAuthError("");
}
document.querySelectorAll("[data-auth-tab]").forEach(button => button.addEventListener("click", () => switchAuthTab(button.dataset.authTab)));
function enterDashboard(user) {
  state.user = user;
  authView.classList.add("hidden"); dashboardView.classList.remove("hidden");
  const firstName = user.name.split(/\s+/)[0] || user.name;
  document.getElementById("welcomeTitle").textContent = `Let's get things done, ${firstName}.`;
  document.getElementById("sidebarName").textContent = user.name;
  document.getElementById("sidebarEmail").textContent = user.email;
  document.getElementById("sidebarAvatar").textContent = initials(user.name);
  document.getElementById("topAvatar").textContent = initials(user.name);
  document.getElementById("todayLabel").textContent = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date());
}
function enterAuth() { dashboardView.classList.add("hidden"); authView.classList.remove("hidden"); state.user = null; state.tasks = []; }

loginForm.addEventListener("submit", async event => {
  event.preventDefault(); setAuthError("");
  const button = loginForm.querySelector('button[type="submit"]'); setBusy(button, true, "Signing in...");
  const form = new FormData(loginForm);
  try {
    const result = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
    state.token = result.token; localStorage.setItem(TOKEN_KEY, result.token); enterDashboard(result.user); await loadTasks();
  } catch (error) { setAuthError(error.message); }
  finally { setBusy(button, false); }
});
registerForm.addEventListener("submit", async event => {
  event.preventDefault(); setAuthError("");
  const button = registerForm.querySelector('button[type="submit"]'); setBusy(button, true, "Creating account...");
  const form = new FormData(registerForm);
  try {
    const result = await api("/api/auth/register", { method: "POST", body: JSON.stringify({ name: form.get("name"), email: form.get("email"), password: form.get("password") }) });
    state.token = result.token; localStorage.setItem(TOKEN_KEY, result.token); enterDashboard(result.user); await loadTasks();
  } catch (error) { setAuthError(error.message); }
  finally { setBusy(button, false); }
});
function signOut(notify = true) {
  state.token = ""; localStorage.removeItem(TOKEN_KEY); state.filter = "all"; state.search = ""; state.priority = "all"; state.tasks = [];
  document.getElementById("searchInput").value = ""; document.getElementById("priorityFilter").value = "all"; enterAuth();
  if (notify) showToast("You have signed out.");
}
document.getElementById("logoutButton").addEventListener("click", () => signOut());
async function loadTasks() { const result = await api("/api/tasks"); state.tasks = result.tasks; sortTasks(); renderStats(); renderTasks(); }
function renderStats() {
  const counts = { all: state.tasks.length, todo: state.tasks.filter(t => t.status === "todo").length, in_progress: state.tasks.filter(t => t.status === "in_progress").length, done: state.tasks.filter(t => t.status === "done").length };
  document.getElementById("totalStat").textContent = counts.all;
  document.getElementById("todoStat").textContent = counts.todo;
  document.getElementById("progressStat").textContent = counts.in_progress;
  document.getElementById("doneStat").textContent = counts.done;
  document.getElementById("completionRate").textContent = `${counts.all ? Math.round(counts.done / counts.all * 100) : 0}%`;
  document.getElementById("allNavCount").textContent = counts.all;
  document.getElementById("todoNavCount").textContent = counts.todo;
  document.getElementById("progressNavCount").textContent = counts.in_progress;
  document.getElementById("doneNavCount").textContent = counts.done;
  document.getElementById("taskFooterCount").textContent = `${counts.all} ${counts.all === 1 ? "task" : "tasks"}`;
}
function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(`${dateString}T00:00:00`);
  return Number.isNaN(date.getTime()) ? dateString : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}
function statusLabel(status) { return ({ todo: "To do", in_progress: "In progress", done: "Completed" })[status] || status; }
function isOverdue(task) {
  if (!task.dueDate || task.status === "done") return false;
  const due = new Date(`${task.dueDate}T23:59:59`); const today = new Date(); today.setHours(0, 0, 0, 0); return due < today;
}
function renderTasks() {
  const heading = filterNames[state.filter] || "All tasks";
  document.getElementById("currentViewTitle").textContent = heading;
  document.getElementById("taskListTitle").textContent = heading;
  document.getElementById("taskListSubtitle").textContent = state.filter === "all" ? "A clear view of everything on your plate." : `Tasks currently marked as ${heading.toLowerCase()}.`;
  document.querySelectorAll("[data-filter]").forEach(button => button.classList.toggle("active", button.dataset.filter === state.filter));
  const query = state.search.toLowerCase();
  const filtered = state.tasks.filter(task => (state.filter === "all" || task.status === state.filter) && (state.priority === "all" || task.priority === state.priority) && `${task.title} ${task.description}`.toLowerCase().includes(query));
  taskList.replaceChildren();
  if (!filtered.length) {
    const empty = document.createElement("div"); empty.className = "empty-state";
    const hasTasks = state.tasks.length > 0;
    empty.innerHTML = `<div class="empty-icon">${hasTasks ? "⌕" : "＋"}</div><h3>${hasTasks ? "No matching tasks" : "A fresh start"}</h3><p>${hasTasks ? "Try changing your search or filters." : "Create your first task and give your day some direction."}</p>${hasTasks ? "" : '<button class="button button-primary" type="button" data-empty-create>Create first task</button>'}`;
    taskList.append(empty); const createButton = empty.querySelector("[data-empty-create]"); if (createButton) createButton.addEventListener("click", () => openTaskDialog()); return;
  }
  filtered.forEach(task => {
    const fragment = taskTemplate.content.cloneNode(true); const card = fragment.querySelector(".task-card"); card.dataset.taskId = task.id;
    const priority = fragment.querySelector(".priority-pill"); priority.textContent = `${task.priority[0].toUpperCase()}${task.priority.slice(1)} priority`; priority.classList.add(`priority-${task.priority}`);
    fragment.querySelector(".task-title").textContent = task.title; fragment.querySelector(".task-description").textContent = task.description;
    const due = fragment.querySelector(".due-date"); due.textContent = task.dueDate ? `◷ ${formatDate(task.dueDate)}` : "◷ No due date";
    if (isOverdue(task)) { due.classList.add("overdue"); due.textContent = `! Overdue · ${formatDate(task.dueDate)}`; }
    fragment.querySelector(".task-updated").textContent = `Updated ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(task.updatedAt))}`;
    const status = fragment.querySelector(".status-badge"); status.textContent = statusLabel(task.status); status.classList.add(`status-${task.status}`); status.dataset.action = "cycle-status"; status.title = "Click to change status";
    fragment.querySelector(".edit-action").dataset.action = "edit"; fragment.querySelector(".delete-action").dataset.action = "delete";
    taskList.append(fragment);
  });
}
document.querySelectorAll("[data-filter]").forEach(button => button.addEventListener("click", () => { state.filter = button.dataset.filter; renderTasks(); document.getElementById("sidebar").classList.remove("open"); }));
document.getElementById("searchInput").addEventListener("input", event => { state.search = event.target.value.trim(); renderTasks(); });
document.getElementById("priorityFilter").addEventListener("change", event => { state.priority = event.target.value; renderTasks(); });
taskList.addEventListener("click", async event => {
  const button = event.target.closest("[data-action]"); if (!button) return;
  const card = button.closest("[data-task-id]"); if (!card) return;
  const task = state.tasks.find(item => item.id === card.dataset.taskId); if (!task) return;
  if (button.dataset.action === "edit") { openTaskDialog(task); return; }
  if (button.dataset.action === "delete") {
    if (!window.confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
    try { await api(`/api/tasks/${encodeURIComponent(task.id)}`, { method: "DELETE" }); state.tasks = state.tasks.filter(item => item.id !== task.id); renderStats(); renderTasks(); showToast("Task deleted."); }
    catch (error) { showToast(error.message, true); } return;
  }
  if (button.dataset.action === "cycle-status") {
    const next = { todo: "in_progress", in_progress: "done", done: "todo" };
    try { const result = await api(`/api/tasks/${encodeURIComponent(task.id)}`, { method: "PATCH", body: JSON.stringify({ status: next[task.status] }) }); state.tasks = state.tasks.map(item => item.id === task.id ? result.task : item); sortTasks(); renderStats(); renderTasks(); showToast(`Status changed to ${statusLabel(result.task.status).toLowerCase()}.`); }
    catch (error) { showToast(error.message, true); }
  }
});
function openTaskDialog(task = null) {
  state.editingTaskId = task ? task.id : null; taskForm.reset();
  document.getElementById("dialogTitle").textContent = task ? "Edit task" : "Create a task";
  document.getElementById("saveTaskButton").textContent = task ? "Save changes" : "Save task";
  document.getElementById("taskError").textContent = "";
  document.getElementById("taskTitle").value = task?.title || "";
  document.getElementById("taskDescription").value = task?.description || "";
  document.getElementById("taskPriority").value = task?.priority || "medium";
  document.getElementById("taskStatus").value = task?.status || "todo";
  document.getElementById("taskDueDate").value = task?.dueDate || "";
  if (!taskDialog.open) taskDialog.showModal();
  setTimeout(() => document.getElementById("taskTitle").focus(), 0);
}
document.getElementById("newTaskButton").addEventListener("click", () => openTaskDialog());
document.getElementById("closeDialog").addEventListener("click", () => taskDialog.close());
document.getElementById("cancelDialog").addEventListener("click", () => taskDialog.close());
taskDialog.addEventListener("click", event => { if (event.target === taskDialog) taskDialog.close(); });
taskForm.addEventListener("submit", async event => {
  event.preventDefault(); const errorEl = document.getElementById("taskError"); errorEl.textContent = "";
  const button = document.getElementById("saveTaskButton"); setBusy(button, true, "Saving..."); const form = new FormData(taskForm);
  const taskData = { title: form.get("title"), description: form.get("description"), priority: form.get("priority"), status: form.get("status"), dueDate: form.get("dueDate") };
  try {
    if (state.editingTaskId) {
      const result = await api(`/api/tasks/${encodeURIComponent(state.editingTaskId)}`, { method: "PATCH", body: JSON.stringify(taskData) });
      state.tasks = state.tasks.map(task => task.id === result.task.id ? result.task : task); showToast("Task updated.");
    } else {
      const result = await api("/api/tasks", { method: "POST", body: JSON.stringify(taskData) }); state.tasks.push(result.task); showToast("Task created.");
    }
    sortTasks(); taskDialog.close(); renderStats(); renderTasks();
  } catch (error) { errorEl.textContent = error.message; }
  finally { setBusy(button, false); }
});
document.getElementById("mobileMenu").addEventListener("click", () => document.getElementById("sidebar").classList.toggle("open"));
document.addEventListener("click", event => {
  const sidebar = document.getElementById("sidebar");
  if (window.innerWidth <= 680 && sidebar.classList.contains("open") && !sidebar.contains(event.target) && !event.target.closest("#mobileMenu")) sidebar.classList.remove("open");
});
async function initializeApp() {
  if (!state.token) return;
  try { const result = await api("/api/auth/me"); enterDashboard(result.user); await loadTasks(); }
  catch (error) { signOut(false); if (error.message) setAuthError(error.message); }
}
initializeApp();
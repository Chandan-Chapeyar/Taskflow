<<<<<<< HEAD
# TaskFlow — Full-Stack Task Management Application

A responsive task manager for the internship task. It includes account registration/login, protected task API endpoints, task CRUD, status and priority management, search, due dates and a mobile-friendly dashboard.

## Tech stack

- **Frontend:** HTML, CSS, vanilla JavaScript
- **Backend:** Node.js and Express
- **Authentication:** bcrypt password hashing + signed JWT tokens
- **Data persistence:** JSON file store (`data/store.json`)
- **Security basics:** Helmet security headers, request body limits, server-side validation and rate limiting on authentication routes

## Features

- Register an account and sign in
- Passwords are hashed; plain-text passwords are not stored
- Each account sees only its own tasks
- Create, read, update and delete tasks (CRUD)
- Task title, description, due date, priority and status
- Filter by status and priority; search task titles/descriptions
- Summary cards and completion rate
- Overdue task highlighting
- Responsive dashboard and mobile sidebar
- Click a task's status badge to advance its status
- Data persists across local server restarts

## Run locally

1. Install **Node.js 18 or newer**.
2. Extract this ZIP and open the project directory in a terminal.
3. Install packages:

   ```bash
   npm install
   ```

4. Copy `.env.example` to a new file named `.env`, then set `JWT_SECRET` to a long, random secret. Do not share or commit `.env`.
5. Start the server:

   ```bash
   npm start
   ```

6. Open `http://localhost:3000` and create an account.
7. New account and task data are stored locally in `data/store.json`.

For development with automatic restart on supported Node versions, use `npm run dev`.

## API overview

All task endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/auth/register` | Create account |
| `POST` | `/api/auth/login` | Sign in |
| `GET` | `/api/auth/me` | Get the current account |
| `GET` | `/api/tasks` | List tasks belonging to the current account |
| `POST` | `/api/tasks` | Create a task |
| `PATCH` | `/api/tasks/:id` | Update a task |
| `DELETE` | `/api/tasks/:id` | Delete a task |
| `GET` | `/api/health` | Health check |

## Manual testing checklist

- [ ] Create an account with a valid email and password of at least 8 characters.
- [ ] Try to create an account using the same email; it should be rejected.
- [ ] Sign out and sign back in.
- [ ] Create a task with a due date, priority and status.
- [ ] Edit its title, description, status or priority and confirm changes remain.
- [ ] Click a status badge to advance a task's status.
- [ ] Search and filter tasks.
- [ ] Delete a task.
- [ ] Create a second account and make sure it cannot see the first account's tasks.
- [ ] Test the UI at phone, tablet and desktop widths.

## Deployment notes

Deploy as a **single persistent Node.js service** that runs Express and supports a writable disk. Configure `JWT_SECRET` and `NODE_ENV=production` in the host's environment settings. Use the HTTPS deployment URL as the live link.

**Important limitation:** the JSON file store keeps this assignment simple, but it is not suitable for serverless hosting, multiple app instances or production-scale concurrent writes. On a host with ephemeral storage, data can be lost on restart or redeploy. For a serious public app, replace the JSON store with PostgreSQL, MySQL or another managed database. Never deploy with the fallback JWT secret. WebSocket updates are omitted because the task brief marks them optional; changes appear immediately in the browser that performs the action.

## Be ready to explain

1. **Frontend structure:** `public/index.html` contains the UI, `public/styles.css` defines layout and responsiveness, and `public/app.js` handles UI state and API calls.
2. **Backend:** `server.js` defines Express routes, validates input, authenticates requests and ensures tasks are scoped to the signed-in user.
3. **Authentication:** bcrypt hashes passwords; the server signs a JWT and the browser sends it as a Bearer token for protected APIs.
4. **CRUD:** the browser uses `GET`, `POST`, `PATCH` and `DELETE` requests to manage data.
5. **Trade-off:** JSON storage is easy to run locally, but a proper deployed system should use a database.
=======
# Taskflow
Task management application 
>>>>>>> ba0d8668686228692f820916cbe2ca75982bf1d8

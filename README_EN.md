<p align="center">
  <a href="https://pd-assistant.com/"><strong>🌐 Live: pd-assistant.com</strong></a>
</p>

<p align="center">
  <a href="README.md">🇹🇷 Türkçe</a> ·
  <strong>🇬🇧 English</strong>
</p>

<p align="center">
  <img src="docs/assets/readme/hero.en.svg" alt="PDA: tasks, chat, meetings and code in one workspace" width="100%" />
</p>

<h1 align="center">
  <img src="frontend/public/images/branding/pda-logo-512.png" alt="PDA — Project Delivery Assistant" width="260" />
</h1>

<p align="center">
  <strong>An open-source, self-hosted project management platform for students and small software teams.</strong><br />
  Tasks, chat, video meetings and GitHub tracking: the work of four separate tools in one workspace.
</p>

<p align="center">
  <a href="#-quick-start"><strong>🚀 Quick start</strong></a> ·
  <a href="#-what-makes-pda-different"><strong>✨ What sets us apart</strong></a> ·
  <a href="#screens"><strong>🖼️ Screens</strong></a> ·
  <a href="#-contributing"><strong>🤝 Contribute</strong></a>
</p>

<p align="center">
  <img src="docs/assets/pda-tour.gif" alt="PDA tour: dashboard, projects, criteria, task list, board and calendar" width="100%" />
</p>

---

## 🧭 What Makes PDA Different?

Most teams split their work across five tools. Tasks live in one place, chat in another, meetings behind a link, code on a different site. The team wanders between tools instead of doing the work. PDA brings all of it into **one workspace**, and adds the freedom to run it on your own server.

<p align="center">
  <img src="docs/assets/readme/stack.en.svg" alt="Task tracking, messaging, video meetings and code tracking merge into a single PDA workspace" width="100%" />
</p>

| | A scattered tool stack | PDA |
|---|---|---|
| **Tasks, chat, meetings, code** | 4 apps, 4 subscriptions, 4 logins | One workspace, one account |
| **People from outside** | They need to create an account too | Send a link, guests join **without an account** |
| **Task detail** | Either too bare or too complex | **Simple** or **Advanced**, your call |
| **Code tracking** | A separate tab and separate alerts | The repo sits next to the work; the team hears about every new commit |
| **File sharing** | In a separate chat app | In the project chat, right inside the conversation |
| **Cost and data** | Per-seat pricing, data lives elsewhere | Free, open source, **your data on your server** |

---

### 🎥 Send a link. Guests join without an account.

Start meetings tied to a project or fully standalone. The team enters the room, and anyone outside joins as a guest with just the link, no account needed.

<p align="center">
  <img src="docs/assets/readme/meeting.en.svg" alt="A live project meeting, a standalone meeting, a copied guest link and a guest joining the room without an account" width="100%" />
</p>

- Project meetings and standalone meetings side by side; upcoming and live meetings in one list.
- The guest link is specific to one meeting; the guest only gets a session limited to that room.
- Meeting chat, reactions and email reminders.
- Video media (LiveKit) is **optional and disabled by default**; see [Meeting media](#-meeting-media-livekit-optional) for setup.

### 💬 Project chat. Direct messages. Files too.

Every project has its own group chat. Write one to one with anyone and drop files straight into the conversation.

<p align="center">
  <img src="docs/assets/readme/chat.en.svg" alt="Project chat with three messages, a PDF attachment, a reaction and a typing indicator" width="100%" />
</p>

- Group chat and one-to-one messages between members of the same project.
- Replies, reactions and **file attachments**; a typing indicator.
- Real-time notifications, reminders and a calendar.

### 📋 Simple task. Advanced task. Your call.

A title is enough for a small job. A big one brings assignees, priority, dates, estimates and subtasks. You choose which mode is enabled for each project.

<p align="center">
  <img src="docs/assets/readme/tasks.en.svg" alt="The task form opens with a title and description in simple mode, and adds assignees, priority, due date, estimate and subtasks in advanced mode" width="100%" />
</p>

- **Simple:** title, description, priority, status and assignees.
- **Advanced:** subtasks, labels, time estimate and points, sprints.
- List, drag-and-drop Kanban board, sprint, backlog and calendar views; file attachments.

### 🐙 Code, next to the work.

Connect a public GitHub repository to the project (read-only). Basic mode follows the main branch; advanced mode shows branches and unmerged commits. The team hears about every new commit.

<p align="center">
  <img src="docs/assets/readme/repo.en.svg" alt="Basic mode lists the latest commits on the main branch, advanced mode shows branches and unmerged commits, and a new commit notification appears" width="100%" />
</p>

### 🏢 Set up your organization. Keep projects under one roof.

A club, a team or a company: a GitHub-like organization with its own profile, logo and cover.

<p align="center">
  <img src="docs/assets/readme/org.en.svg" alt="An organization profile with three project cards under it" width="100%" />
</p>

### 🔓 The code is open. The server is yours.

Apache 2.0 licensed. Install it on your own server with Docker and keep your data. Sign-up emails go out through **your own SMTP account**.

<p align="center">
  <img src="docs/assets/readme/terminal.en.svg" alt="Clone the repo, prepare .env, start the backend and database with Docker and the frontend with npm" width="100%" />
</p>

---

<a id="screens"></a>

## 🖼️ Screenshots

<table>
  <tr>
    <td width="50%"><img src="docs/assets/screenshots/landing-light.png" alt="Landing page, light theme" /></td>
    <td width="50%"><img src="docs/assets/screenshots/landing-dark.png" alt="Landing page, dark theme" /></td>
  </tr>
  <tr>
    <td align="center" colspan="2"><sub>Landing page · Light and Dark</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/assets/screenshots/dashboard-light.png" alt="Dashboard, light theme" /></td>
    <td width="50%"><img src="docs/assets/screenshots/dashboard-dark.png" alt="Dashboard, dark theme" /></td>
  </tr>
  <tr>
    <td align="center" colspan="2"><sub>Dashboard · Light and Dark</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/assets/screenshots/tasks-board-light.png" alt="Task board, light theme" /></td>
    <td width="50%"><img src="docs/assets/screenshots/tasks-board-dark.png" alt="Task board, dark theme" /></td>
  </tr>
  <tr>
    <td align="center" colspan="2"><sub>Task board · Light and Dark</sub></td>
  </tr>
</table>

<details>
<summary><strong>More screens</strong></summary>

<br />

<table>
  <tr>
    <td width="50%"><img src="docs/assets/screenshots/project-overview-light.png" alt="Project overview, light theme" /></td>
    <td width="50%"><img src="docs/assets/screenshots/project-overview-dark.png" alt="Project overview, dark theme" /></td>
  </tr>
  <tr>
    <td align="center" colspan="2"><sub>Project overview · Light and Dark</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/assets/screenshots/tasks-list-light.png" alt="Task list, light theme" /></td>
    <td width="50%"><img src="docs/assets/screenshots/tasks-list-dark.png" alt="Task list, dark theme" /></td>
  </tr>
  <tr>
    <td align="center" colspan="2"><sub>Task list · Light and Dark</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/assets/screenshots/criteria-light.png" alt="Project criteria, light theme" /></td>
    <td width="50%"><img src="docs/assets/screenshots/criteria-dark.png" alt="Project criteria, dark theme" /></td>
  </tr>
  <tr>
    <td align="center" colspan="2"><sub>Project criteria · Light and Dark</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/assets/screenshots/calendar-light.png" alt="Calendar, light theme" /></td>
    <td width="50%"><img src="docs/assets/screenshots/calendar-dark.png" alt="Calendar, dark theme" /></td>
  </tr>
  <tr>
    <td align="center" colspan="2"><sub>Calendar · Light and Dark</sub></td>
  </tr>
</table>

**Mobile view**

<table>
  <tr>
    <td align="center" width="33%"><img src="docs/assets/screenshots/landing-mobile.png" alt="Landing page, mobile" width="220" /></td>
    <td align="center" width="33%"><img src="docs/assets/screenshots/dashboard-mobile.png" alt="Dashboard, mobile" width="220" /></td>
    <td align="center" width="33%"><img src="docs/assets/screenshots/tasks-board-mobile.png" alt="Task board, mobile" width="220" /></td>
  </tr>
</table>

</details>

---

## 🎯 Why PDA?

PDA is aimed at **students and small software teams**. Especially in university projects and small team work, we want to reduce problems such as:

- Tasks getting lost between WhatsApp / Discord messages
- It being unclear who is responsible for what
- Project progress not being trackable
- Testing and bug processes being handled in a scattered way
- Paid project management tools being needlessly complex or expensive for small teams

PDA brings this process together **in one place, open source and self-hostable**.

### Core principles

- **Open source:** Apache License 2.0
- **Free to use:** Does not depend on any paid service; runs on your own infrastructure
- **Self-hosted:** Your data stays on your own server
- **Student focused:** Experience the roles and task flows of real software teams
- **Modular but simple:** Modular Monolith architecture; modules are clearly separated, and setup stays simple with a single backend
- **Open to contributions:** Issue and Pull Request support
- **Secure defaults:** Secret management, cookie-based auth, validation and RBAC

---

## ✨ V1 Features

> The detailed change list for this version is on the [Releases](https://github.com/alperrte/project-delivery-assistant/releases) page. Only the main headings are listed here.

### 📋 Task management: Simple and Advanced

You choose which mode is enabled for each project. A task can be assigned to one or more people.

- **Simple:** Title, description, priority, status and assignees. Ideal for quickly entering work.
- **Advanced:** Everything in a simple task, plus subtasks, labels, time estimate and points, and sprints. Ideal for detailed planning.

With list, drag-and-drop board, sprint and backlog views, who owns a piece of work is always visible.

### 🐙 GitHub repository tracking: Simple and Advanced

A public GitHub repository is connected to the project (read-only).

- **Simple:** Latest commits on the main branch.
- **Advanced:** Branches, merged and unmerged commits, and who made each commit.

The team is notified when a new commit arrives.

### 🎥 Meetings

- Project-linked or standalone meetings; **guest join** without an account.
- Meeting chat, reactions and email reminders.
- Video media is optional (LiveKit).

### 💬 Communication

- **In-project chat:** A group chat for every project, with replies, reactions and file attachments.
- **Direct messages:** Between members of the same project.
- **Notifications, reminders and a calendar.**

### 🏢 Organizations

- A GitHub-like organization profile: logo, cover, description.
- Organization-linked projects, invitation and membership management.

### 🔐 Account and infrastructure

- **Sign-up and login:** Email-verified registration, login, password reset; Google / GitHub login (optional).
- **Security:** Two-factor authentication (TOTP), HttpOnly cookie sessions, role-based authorization.
- **SMTP infrastructure:** Verification and notification emails are sent with your own SMTP account.
- **Admin panel:** The first administrator account is created from `.env`.
- **Docker-based setup.**

### 👥 Project and team

- Squad / team structure, invitation and membership management.
- Project-based roles (a user can hold more than one role in the same project).
- Delivery criteria and completion percentage, issue records, test reports for testers.

### 🎨 Interface

- Turkish, English and German interface.
- Light / Dark / System theme.
- Responsive design for mobile, tablet and desktop.

---

## 🧩 Role Structure

In PDA, role permissions are fixed on the application side; a role name alone does not grant access. A user can hold more than one role in the same project.

### Global roles

- `USER`
- `ADMIN` — manages the PDA installation, has no implicit permissions inside projects

### Project-based roles

- `PROJECT_MANAGER`
- `BACKEND_DEVELOPER`
- `FRONTEND_DEVELOPER`
- `FULL_STACK_DEVELOPER`
- `AI_ML_DEVELOPER`
- `UI_UX_DEVELOPER`
- `TESTER`
- `ANALYST`

The same user can have different roles in different projects.

---

## 🏗️ Architecture and Tech Stack

PDA is built with a **Modular Monolith** architecture.

With this approach:

- Modules are clearly separated from each other
- A single backend deployment is kept, so setup and operation stay simple
- Free / low-cost deployment is supported
- Splitting modules apart later is easier if the need arises

```mermaid
flowchart LR
    user["Browser<br/>student · manager · developer · tester · admin · guest"]

    subgraph fe["Frontend · :3000"]
        next["Next.js 16 · React 19 · TypeScript<br/>App Router · next-intl · TanStack Query"]
    end

    subgraph be["Backend · :8080 · /api/v1"]
        sec["Security layer<br/>HttpOnly cookie JWT · CSRF · RBAC · rate limiting"]
        mods["Spring Boot 4 · Java 25 · Spring Modulith<br/>auth · user · admin · project · squad · task · issue<br/>testreport · comment · chat · meeting · notification · reminder<br/>mail · contact · dashboard · search · activity · audit · analytics"]
        sec --> mods
    end

    db[("PostgreSQL 18<br/>Flyway migration")]
    smtp["SMTP<br/>verification and notification emails"]
    oauth["Google · GitHub<br/>OAuth login (optional)"]
    gh["GitHub API<br/>repository and commit data"]
    lk["LiveKit SFU<br/>meeting media (optional)"]

    user -->|HTTPS| next
    next -->|"REST + WebSocket"| sec
    mods -->|JPA| db
    mods -.-> smtp
    mods -.-> oauth
    mods -.-> gh
    mods -.-> lk
```

<p align="center">
  <img src="assets/git_images/tech-stack.png" alt="PDA tech stack" width="100%" />
</p>

---

## 🔐 Security Approach

Because PDA is an open-source project that can be deployed, security defaults are kept strict from the start.

- Passwords are hashed with **BCrypt**.
- Access and refresh tokens are kept in **HttpOnly cookies**.
- No auth tokens are stored in `localStorage` or `sessionStorage`.
- CSRF protection is active because auth is cookie-based.
- Guest meeting sessions are limited to a cookie scoped to that one meeting.
- Two-factor authentication secrets are stored encrypted in the database.
- Codes and links sent by email are hashed with HMAC.
- Production CORS is managed with an explicit allowlist.
- Spring Data JPA and parameterized queries are used.
- Dynamic SQL string concatenation is forbidden.
- Backend input validation is mandatory.
- Rate limiting is applied to auth, messaging, analytics and contact endpoints.
- Secret values are taken only from ENV / the deployment secret store.
- Passwords, JWTs, cookie contents and secrets are never logged.
- Swagger is disabled by default (`API_DOCS_ENABLED=false`).

---

## 🚀 Quick Start

### Requirements

- Git
- Docker Desktop **or** Docker Engine + Docker Compose (for the backend and PostgreSQL)
- Node.js 22 and npm (to run the Next.js frontend)

You don't need to install Java and PostgreSQL on the host machine separately; the backend and database run in Docker, while the frontend runs outside Docker.

### 1. Clone the repository

```bash
git clone https://github.com/alperrte/project-delivery-assistant.git
cd project-delivery-assistant
```

### 2. Create the environment file

Linux / macOS:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

### 3. Fill in the `.env` values

The `.env.example` file has a description next to every variable. To get started, you need to fill in:

| Variable | What to do |
|---|---|
| `DB_PASSWORD` | Replace `change_me` with your own database password. |
| `JWT_SECRET` | Generate a long, random value. |
| `EMAIL_VERIFICATION_HMAC_KEY` | Paste the output of `openssl rand -base64 32`. |
| `TOTP_ENCRYPTION_KEY` | Paste a different `openssl rand -base64 32` output. If you change it later, everyone's two-factor authentication is disabled. |
| `ADMIN_EMAIL` and `ADMIN_INITIAL_PASSWORD` | The email and temporary password of your first admin account. |
| `MAIL_ENABLED`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_ADDRESS` | Required for sign-up; while `MAIL_ENABLED=false`, sign-up returns `503`. See below. |

Generating values:

```bash
openssl rand -base64 32
```

If `openssl` is not available in Windows PowerShell:

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

Example layout (change the values to your own):

```env
# Application
APP_ENV=dev
BACKEND_PORT=8080
FRONTEND_PORT=3000

# PostgreSQL
DB_NAME=pda
DB_PORT=5432
DB_USERNAME=pda
DB_PASSWORD=<your-password>
DB_URL=jdbc:postgresql://postgres:5432/pda

# JWT
JWT_SECRET=<long-random-value>
JWT_ACCESS_TOKEN_EXPIRATION_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRATION_DAYS=7

# Frontend / CORS
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
INTERNAL_API_URL=http://backend:8080/api/v1

# API Documentation
API_DOCS_ENABLED=true

# Initial Admin
ADMIN_EMAIL=<admin-email>
ADMIN_INITIAL_PASSWORD=<temporary-password>

# Mail (Hostinger Email, implicit TLS)
MAIL_ENABLED=false
MAIL_PROVIDER=smtp
SMTP_FROM_ADDRESS=info@pd-assistant.com
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USERNAME=info@pd-assistant.com
SMTP_PASSWORD=
SMTP_AUTH=true
SMTP_STARTTLS=false
SMTP_SSL=true
CONTACT_RECIPIENT=info@pd-assistant.com

# Security keys
EMAIL_VERIFICATION_HMAC_KEY=<openssl rand -base64 32>
TOTP_ENCRYPTION_KEY=<another openssl rand -base64 32>
```

#### How to set up email

Sign-up emails are sent with your own SMTP account (Hostinger, Gmail, Brevo, etc.).

1. Get the SMTP details from your provider and put them in `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD` and `SMTP_FROM_ADDRESS` in `.env`.
2. For port `465` use `SMTP_SSL=true` and `SMTP_STARTTLS=false`; for port `587` do the opposite. Never enable both.
3. Set `MAIL_ENABLED=true` and restart the backend: `docker compose up -d`.
4. Try signing up; the verification email should arrive.

> Never commit the SMTP password or share it with anyone. If you use Brevo, also set `MAIL_PROVIDER=brevo`.

#### Optional settings

| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google login. Disabled if both are empty, enabled if both are set. Redirect URI: `http://localhost:8080/api/v1/auth/oauth2/callback/google` |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | GitHub login. Redirect URI: `http://localhost:8080/api/v1/auth/oauth2/callback/github` |
| `GITHUB_API_TOKEN` | For the project repository page. If empty, the whole server can make 60 requests per hour; a token without scopes raises this to 5000 per hour. Used only on the server. |
| `ORGANIZATION_MEDIA_STORAGE_PATH` | Directory where organization logo and cover images are stored. |
| `TRUSTED_PROXY_CIDRS` | Only if you really put a reverse proxy in front of the backend, enter its address. Otherwise leave it empty. |
| `LOG_LEVEL` | Log level. |

> The real `.env` file must never be committed to Git.

### 4. Start the backend and PostgreSQL

```bash
docker compose up --build -d
```

### 5. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend opens at `http://localhost:3000` and connects to the backend at `http://localhost:8080/api/v1`. If `API_DOCS_ENABLED=true`, the Swagger UI is served by the backend.

### 6. Stop the services

Stop the frontend with `Ctrl+C` in its terminal, and stop the backend and PostgreSQL with:

```bash
docker compose down
```

---

## 🎥 Meeting Media (LiveKit, optional)

Creating meetings, guest links, meeting chat and reminders work without LiveKit. Audio and video need a [LiveKit](https://livekit.io) SFU. This feature is **disabled by default** (`MEETING_MEDIA_ENABLED=false`).

For local development you can bring LiveKit up with an extra Compose file and profile:

```bash
docker compose -f docker-compose.yml -f docker-compose.meeting.yml --profile meeting up -d
```

Then fill in these variables in `.env`:

| Variable | Description |
|---|---|
| `MEETING_MEDIA_ENABLED` | Turns on the media integration; default `false`. |
| `LIVEKIT_API_URL`, `LIVEKIT_WS_URL` | The address the backend uses to reach LiveKit and the one browsers connect to. |
| `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | The LiveKit key pair. |
| `MEETING_EMPTY_GRACE`, `MEETING_RETAIN_CHAT`, `MEETING_MAX_PARTICIPANTS`, `MEETING_TOKEN_TTL` | Empty-room grace period, chat retention, participant limit and join token lifetime. |

In production, also set `MEDIA_ADDRESS`, `TURN_ADDRESS` and `LIVEKIT_NODE_IP` to your own domains and server IP, and prepare DNS, TLS and TURN separately. The production Compose file is `docker-compose.meeting.prod.yml`.

---

## 👑 First Admin Account

The first admin account is created from `.env`:

```env
ADMIN_EMAIL=
ADMIN_INITIAL_PASSWORD=
```

Flow:

1. the system checks whether an admin account exists,
2. if not, it creates one from the ENV values,
3. the password is stored only as a BCrypt hash,
4. changing the password is required on first login,
5. an existing admin is not overwritten from ENV on restart.

---

## 🤝 Contributing

PDA is an open-source project and open to contributions. Report a bug, suggest an idea, send code.

Contribution flow:

1. fork the repository,
2. create a new branch,
3. develop your change,
4. run the relevant tests,
5. open a Pull Request.

- Open a GitHub Issue to report a bug or suggest a new idea.
- Report security vulnerabilities to [info@pd-assistant.com](mailto:info@pd-assistant.com) instead of a public issue.

---

<h2 align="center">👨‍💻 Developers</h2>

<div align="center">

<table align="center">
  <tr>
    <td align="center" valign="top" width="50%">
      <br />
      <img src="docs/assets/team/alper-temiz.png" alt="Alper Temiz" width="120" />
      <h3>Alper Temiz</h3>
      <sub><code>Full Stack Developer</code></sub>
      <br /><br />
      <table align="center">
        <tr><td>🐙 <a href="https://github.com/alperrte">github.com/alperrte</a></td></tr>
        <tr><td>💼 <a href="https://www.linkedin.com/in/alpertemizz/">linkedin.com/in/alpertemizz</a></td></tr>
        <tr><td>✉️ <a href="mailto:alpertemiz15@gmail.com">alpertemiz15@gmail.com</a></td></tr>
        <tr><td>📄 <a href="frontend/public/cv/alper-temiz-cv.pdf">Resume (CV)</a></td></tr>
      </table>
    </td>
    <td align="center" valign="top" width="50%">
      <br />
      <img src="docs/assets/team/hamza-tasbay.png" alt="Hamza Taşbay" width="120" />
      <h3>Hamza Taşbay</h3>
      <sub><code>Full Stack Developer</code></sub>
      <br /><br />
      <table align="center">
        <tr><td>🐙 <a href="https://github.com/HmzT270">github.com/HmzT270</a></td></tr>
        <tr><td>💼 <a href="https://www.linkedin.com/in/hamza-tasbay">linkedin.com/in/hamza-tasbay</a></td></tr>
        <tr><td>✉️ <a href="mailto:tasbayh@gmail.com">tasbayh@gmail.com</a></td></tr>
        <tr><td>📄 <a href="frontend/public/cv/hamza-tasbay-cv.pdf">Resume (CV)</a></td></tr>
      </table>
    </td>
  </tr>
</table>

</div>

---

<h2 align="center">📄 License</h2>

<p align="center">
  PDA is licensed under the <strong>Apache License 2.0</strong>.<br />
  Details: <a href="LICENSE"><code>LICENSE</code></a>
</p>

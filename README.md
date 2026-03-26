# CollabDoc — Real-Time Collaborative Editor

A Google Docs + Whiteboard hybrid built with **React**, **Strapi**, and **Material UI**.  
Multiple users can edit documents and draw on a shared whiteboard simultaneously — in real time.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Prerequisites](#prerequisites)
4. [Project Structure](#project-structure)
5. [Backend Setup (Strapi)](#backend-setup-strapi)
6. [Frontend Setup (React)](#frontend-setup-react)
7. [Build & Serve React from Strapi](#build--serve-react-from-strapi)
8. [Environment Variables](#environment-variables)
9. [Demo Data / Seeding](#demo-data--seeding)
10. [Running Locally (Quick Start)](#running-locally-quick-start)
11. [How Real-Time Works](#how-real-time-works)
12. [API Reference](#api-reference)
13. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                   Browser                        │
│  React App (served from Strapi /public/app)      │
│  ┌──────────┐  ┌────────────┐  ┌─────────────┐  │
│  │ Rich Text│  │ Whiteboard │  │  Presence   │  │
│  │ Editor   │  │ Canvas     │  │  Sidebar    │  │
│  └────┬─────┘  └─────┬──────┘  └──────┬──────┘  │
│       └──────────────┼─────────────────┘         │
│                   Socket.IO                       │
└───────────────────┬──────────────────────────────┘
                    │  HTTP (REST)  +  WebSocket
┌───────────────────▼──────────────────────────────┐
│              Strapi (Node.js)                     │
│  ┌─────────────┐  ┌──────────────────────────┐   │
│  │  REST API   │  │  Socket.IO Server        │   │
│  │  /api/docs  │  │  (custom server plugin)  │   │
│  └──────┬──────┘  └──────────────────────────┘   │
│         │                                         │
│  ┌──────▼──────────────────────────────────────┐  │
│  │         SQLite (dev) / PostgreSQL (prod)    │  │
│  └─────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer     | Technology                                                         |
| --------- | ------------------------------------------------------------------ |
| Frontend  | React 18, Material UI v5, Quill.js (rich text), Fabric.js (canvas) |
| Backend   | Strapi v4 (Node.js CMS + API)                                      |
| Real-time | Socket.IO (bundled into Strapi via custom server)                  |
| Database  | SQLite (dev) / PostgreSQL (prod)                                   |
| Auth      | Strapi built-in JWT auth                                           |

---

## Prerequisites

Make sure you have these installed:

- **Node.js** `>= 18.x` (check: `node -v`)
- **npm** `>= 9.x` (check: `npm -v`)
- **Git**

---

## Project Structure

```
collabdoc/
├── backend/                    ← Strapi project
│   ├── config/
│   │   ├── server.js           ← Server + Socket.IO bootstrap
│   │   ├── database.js         ← DB config
│   │   └── middlewares.js      ← CORS, static files
│   ├── src/
│   │   ├── api/
│   │   │   └── document/       ← Document content type
│   │   │       ├── content-types/schema.json
│   │   │       ├── controllers/document.js
│   │   │       ├── routes/document.js
│   │   │       └── services/document.js
│   │   └── index.js            ← Socket.IO real-time logic
│   ├── public/
│   │   └── app/                ← ← ← React build goes here
│   └── package.json
│
├── frontend/                   ← React project (CRA or Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Auth/           ← Login / Register
│   │   │   ├── Editor/         ← Rich text editor (Quill)
│   │   │   ├── Whiteboard/     ← Canvas (Fabric.js)
│   │   │   ├── Layout/         ← AppShell, Navbar, Sidebar
│   │   │   └── Documents/      ← Document list, create, share
│   │   ├── hooks/              ← useSocket, useDocument, useAuth
│   │   ├── pages/              ← Login, Dashboard, EditorPage
│   │   ├── services/           ← api.js (axios), socket.js
│   │   ├── store/              ← Zustand state slices
│   │   ├── utils/
│   │   └── App.jsx
│   ├── .env.example
│   └── package.json
│
├── scripts/
│   └── deploy-frontend.sh      ← Build React → copy to Strapi
│
└── README.md                   ← You are here
```

---

## Backend Setup (Strapi)

### 1. Create the Strapi project

```bash
# From the collabdoc/ root
npx create-strapi-app@latest backend --quickstart
# Choose: JavaScript, SQLite (quickstart handles this)
cd backend
```

> **Or** if you already have the backend/ folder from this repo, skip to step 2.

### 2. Install extra dependencies

```bash
cd backend
npm install socket.io                  # Real-time engine
npm install @strapi/plugin-users-permissions  # (usually included)
```

### 3. Copy config files

Replace the generated files with the ones provided in this repo:

```
backend/config/server.js         ← custom server with Socket.IO
backend/config/middlewares.js    ← CORS + static file serving
backend/src/index.js             ← Socket.IO room/event logic
backend/src/api/document/...     ← Document content type
```

### 4. First run

```bash
cd backend
npm run develop
```

Open `http://localhost:1337/admin` → create your admin account.

### 5. Enable public API permissions

In the Strapi Admin:

1. Go to **Settings → Users & Permissions → Roles → Authenticated**
2. Under **Document**, enable: `find`, `findOne`, `create`, `update`, `delete`
3. Save.

---

## Frontend Setup (React)

### 1. Create the React project

```bash
# From collabdoc/ root
npm create vite@latest frontend -- --template react
cd frontend
```

> **Or** use the provided frontend/ folder directly.

### 2. Install dependencies

```bash
cd frontend
npm install

# Core deps (if starting fresh):
npm install @mui/material @emotion/react @emotion/styled @mui/icons-material
npm install axios socket.io-client
npm install react-quill quill
npm install fabric
npm install zustand
npm install react-router-dom
npm install react-hot-toast
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env — set VITE_API_URL and VITE_SOCKET_URL
```

### 4. Run in development

```bash
npm run dev
# Vite dev server: http://localhost:5173
```

> During development, the React dev server proxies API calls to Strapi on `localhost:1337`.

---

## Build & Serve React from Strapi

This is how you get a single server serving both the API and the frontend.

### Step-by-step

```bash
# 1. Build React for production
cd frontend
npm run build
# Output: frontend/dist/

# 2. Copy the build into Strapi's public folder
cp -r dist/* ../backend/public/app/

# 3. Tell Strapi to serve the SPA (already configured in middlewares.js)
#    Strapi will serve backend/public/app/index.html for all non-API routes

# 4. Start Strapi in production
cd ../backend
NODE_ENV=production npm run start
# Visit: http://localhost:1337  ← serves the React app
# API:   http://localhost:1337/api/...
```

### One-command script

```bash
# From collabdoc/ root
chmod +x scripts/deploy-frontend.sh
./scripts/deploy-frontend.sh
```

### How it works (the key config)

In `backend/config/middlewares.js`, we add a static file middleware:

```js
// Strapi serves everything in public/ automatically.
// public/app/ contains the React build.
// The catch-all route in src/index.js returns index.html for SPA routing.
```

In `backend/src/index.js` (register hook):

```js
// A koa route catches all non-/api/* requests and returns
// the React index.html so client-side routing works.
```

---

## Environment Variables

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:1337
VITE_SOCKET_URL=http://localhost:1337
```

### Backend (`backend/.env`)

```env
HOST=0.0.0.0
PORT=1337
APP_KEYS=your-app-keys-here          # generate: openssl rand -base64 32
API_TOKEN_SALT=your-salt             # generate: openssl rand -base64 32
ADMIN_JWT_SECRET=your-secret         # generate: openssl rand -base64 32
JWT_SECRET=your-jwt-secret           # generate: openssl rand -base64 32
DATABASE_CLIENT=sqlite
DATABASE_FILENAME=.tmp/data.db
```

For **production** with PostgreSQL:

```env
DATABASE_CLIENT=postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=collabdoc
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=your-password
```

---

## Demo Data / Seeding

The app ships with a seed script that creates demo documents so you can try the editor without uploading anything.

```bash
cd backend
node scripts/seed.js
```

This creates:

- 2 demo user accounts (`demo1@collabdoc.app` / `demo2@collabdoc.app`, password: `Demo1234!`)
- 3 sample documents (a meeting notes doc, a product spec, a blank canvas)

You can also create documents from the UI after logging in.

---

## Running Locally (Quick Start)

```bash
# Terminal 1 — Backend
cd backend
npm install
npm run develop

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
```

| URL                           | What               |
| ----------------------------- | ------------------ |
| `http://localhost:5173`       | React dev server   |
| `http://localhost:1337/admin` | Strapi admin panel |
| `http://localhost:1337/api`   | REST API           |

---

## How Real-Time Works

```
User A types → socket.emit('doc:change', delta)
                     ↓
              Strapi Socket.IO server
              - broadcasts to room (documentId)
              - persists delta to DB (debounced 1s)
                     ↓
User B receives → socket.on('doc:change', delta)
               → applies Quill delta (OT-lite)
```

### Socket Events

| Event             | Direction       | Payload                          |
| ----------------- | --------------- | -------------------------------- |
| `join-document`   | Client → Server | `{ documentId, userId }`         |
| `doc:change`      | Client → Server | `{ documentId, delta, version }` |
| `doc:change`      | Server → Client | `{ delta, userId, version }`     |
| `whiteboard:draw` | Client → Server | `{ documentId, fabricJson }`     |
| `whiteboard:draw` | Server → Client | `{ fabricJson, userId }`         |
| `presence:update` | Client → Server | `{ documentId, cursor, name }`   |
| `presence:update` | Server → Client | `{ users[] }`                    |
| `leave-document`  | Client → Server | `{ documentId }`                 |

---

## API Reference

### Auth

| Method | Path                       | Description   |
| ------ | -------------------------- | ------------- |
| POST   | `/api/auth/local/register` | Register user |
| POST   | `/api/auth/local`          | Login → JWT   |

### Documents

| Method | Path                 | Description           |
| ------ | -------------------- | --------------------- |
| GET    | `/api/documents`     | List user's documents |
| POST   | `/api/documents`     | Create document       |
| GET    | `/api/documents/:id` | Get document          |
| PUT    | `/api/documents/:id` | Update document       |
| DELETE | `/api/documents/:id` | Delete document       |

All document endpoints require `Authorization: Bearer <jwt>` header.

---

## Troubleshooting

### CORS errors in development

Make sure `backend/config/middlewares.js` includes `http://localhost:5173` in the allowed origins.

### Socket.IO not connecting

1. Check that `backend/src/index.js` bootstraps Socket.IO on the Strapi server.
2. Check browser console for the socket URL — it should point to `localhost:1337`.

### React app not loading from Strapi (`/app`)

1. Confirm `frontend/dist/` was copied to `backend/public/app/`.
2. Confirm the catch-all route is registered in `backend/src/index.js`.
3. Run `NODE_ENV=production npm start` (not `develop`) for the static serving.

### Port conflicts

Change Strapi port in `backend/.env`: `PORT=1338`  
Change Vite port in `frontend/vite.config.js`: `server: { port: 5174 }`

---

## License

MIT — use freely, contribute back if you build something cool.

# Incognito — Backend

Privacy-Preserving Anonymous College Complaints System backend service.

## Tech Stack

- **Node.js** (ES Modules)
- **Express.js**
- **better-sqlite3** (SQLite)
- **@semaphore-protocol/core** (Semaphore Protocol V4)
- **cors** & **dotenv**

## Getting Started

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Available configuration options:
- `PORT`: Port the server runs on (default: `3000`).
- `FRONTEND_URL`: Permitted CORS origin for frontend (default: `http://localhost:5173`).
- `DATABASE_PATH`: Path to the SQLite database file (default: `./data.db`).

### 3. Run the Server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

### 4. Health Check

```bash
curl http://localhost:3000/api/health
```

Expected Response:
```json
{
  "ok": true,
  "service": "incognito-backend"
}
```

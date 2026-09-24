# StudySync

Collaborative study companion: assignments, Pomodoro focus sessions, notes + AI flashcards, grades/GPA, and real-time study rooms.

## Quick start (≈2 minutes)

Requirements: Node.js 18+ and npm.

```bash
# 1. Install everything (also generates the Prisma client)
npm install

# 2. Create your environment file and set a JWT secret
cp .env.example .env
#    → edit .env and change JWT_SECRET to any long random string

# 3. Create the SQLite database and seed demo data
npm run db:setup

# 4. Run the API (port 4000) and the Vite dev server (port 5173) together
npm run dev
```

The frontend lives in `src/` (reusable UI in `src/components/ui/`, pages in
`src/pages/`, and helpers in `src/lib/`). The API lives in `server/`, with
endpoints in `server/routes/`. The SQLite schema is in `prisma/`; the seed
script and build configuration remain at the root.

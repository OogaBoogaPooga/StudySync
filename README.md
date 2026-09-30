# StudySync

A study companion for students. Assignments, focus sessions, AI-generated
notes, spaced-repetition flashcards, and collaborative study rooms — all in
one place.

Live: https://www.studysync.run.place

---

## What it does

### Assignments and planning
- Track assignments with due dates, class, weight, progress, and type
  (homework / quiz / test / exam / project / reading)
- Calendar view with filters for Open, Late, Due Soon, and Done
- Dashboard with a "next up" hero card that ranks what to work on right now
- Per-class chips with open-assignment counts
- Optional browser notifications for items due in the next 24 hours

### Grades and GPA
- Weighted GPA calculation with per-class breakdown
- Grade snapshots — paste a grade like `143/158` or `94.27%` and it saves
- Import from your school portal by pasting text (parses IC, PowerSchool,
  Canvas, Skyward formats); falls back to AI parsing for anything unusual
- Screenshot import via vision model for anything else
- What-if calculator — see how a future score changes your class grade and GPA
- Performance chart, credit distribution, PDF export

### Notes and study sets
- Rich-text editor with bold, italic, underline, headings, lists, and links
- Paste text or upload .docx / .pdf / .pptx / .txt files and AI generates
  structured notes. Tuned for AP US History but works for any subject.
- Link any set to a class and unit
- Share links that let anyone with the URL view or edit the set — and a
  one-click **Save to my sets** button that copies notes and flashcards into
  their own account

### Flashcards and spaced repetition
- Manual flashcards or AI-generated from notes
- Full SM-2 algorithm — each card tracks its own ease, interval, due date,
  and state (New / Learning / Review / Mastered)
- Rate each card Again / Hard / Good / Easy; the app schedules the next review
- Study mode auto-picks due cards; keyboard-driven review (Space to flip,
  1–4 to rate)

### AI features
- **Ask my notes** — a chat drawer that answers questions using only your own
  study sets. Refuses to answer when the material isn't there.
- **AI tutor** — the workspace chat is a patient tutor, not a search engine.
  Explains concepts, checks reasoning, walks through problems.
- **Quiz generator** — 10 mixed MCQs and short-answer questions, auto-graded
  with attempt history
- **Guided assignment workspace** — for any assignment, AI breaks it into
  4–7 executable steps and coaches you through each one. You do the work,
  it checks your output, and steps tick off as you complete them.
- **Guided lessons** — for any study set, AI builds a 4–8 topic course and
  walks you through it one topic at a time with a check-your-understanding
  question after each section.

### Focus and music
- Pomodoro timer (25 / 5 / 15 by default, all durations customizable)
- Runs in the background across tabs and pages; persists across refreshes
- Floating timer badge on every page when a session is running
- Session notes auto-save locally; 7-day focus chart
- 25 lo-fi tracks streamed from the server
- Floating music pill at bottom-center with play, skip, shuffle, loop, volume;
  full music browser on the Focus page

### Study rooms
- Real-time collaborative rooms — invite code, shared whiteboard, chat, polls
- Whiteboard built on Fabric.js with drawing tools, color picker, brush size,
  and a draggable resize handle
- Chat with system messages for joins and leaves
- Live polls with running vote tallies

### Real-time collaborative editing
- Every study set has a **Edit together** mode
- Built on Yjs — concurrent edits merge mathematically instead of clobbering
- Live colored cursors with name labels showing where each person is typing
- Works through your existing Socket.IO connection; no extra server needed

### Platform
- Installable as a PWA — runs in its own window with its own dock icon
- Service worker caches the app shell and API responses; loads offline
- Auto-updates on deploy
- Six color themes (Nordic, Ocean, Sunset, Forest, Rose, Slate) plus three
  layout styles (Nordic, Studio, Paper) that change corner radius, heading
  font, and shadow depth
- Dark mode and high-contrast mode, independent of theme
- Reduce-motion accessibility toggle
- Guided onboarding tour that navigates pages and opens real features
- Settings dialog with themes, accessibility, and credits

---

## Tech stack

**Frontend**
- React 18, Vite
- Tailwind CSS with CSS-variable design tokens for theming
- Radix UI primitives for dialogs, popovers, and selects
- React Router for navigation
- Chart.js for GPA and focus charts
- Fabric.js for the shared whiteboard
- TipTap (ProseMirror) for the rich-text editor
- Yjs + y-protocols for collaborative editing
- Socket.IO client for real-time features

**Backend**
- Node.js + Express
- Prisma 5 with SQLite
- Socket.IO for real-time rooms and collaboration
- multer for file uploads
- mammoth (docx), pdf2json (pdf), officeparser (pptx) for document extraction
- zod for input validation
- bcryptjs for password hashing, jsonwebtoken for sessions

**AI**
- Groq API (OpenAI-compatible endpoint)
- `openai/gpt-oss-120b` for text generation (notes, flashcards, chat, quizzes)
- `meta-llama/llama-4-scout-17b-16e-instruct` for vision (screenshot grade import)
- `llama-3.3-70b-versatile` for the guided lesson and coach features
  (better at structured teaching than the default model)

**Deployment**
- Railway with a persistent volume mounted at `/data`
- SQLite database at `/data/dev.db`
- Study music served from `/data/music/`
- Custom domain via freedomain.one DNS

---

## Project layout

```
prisma/
  schema.prisma           — database schema
seed.js                   — demo data
index.html
vite.config.js            — Vite + PWA plugin config
tailwind.config.js
server/
  index.js                — Express + Socket.IO bootstrap
  db.js                   — Prisma client singleton
  socket.js               — real-time rooms, Yjs relay, chat, polls, whiteboard
  middleware/auth.js      — JWT verification, zod validation, async wrapper
  routes/
    auth.js               — register, login, /me
    classes.js            — class CRUD
    assignments.js        — assignment CRUD
    sessions.js           — focus sessions and stats
    sets.js               — study sets, flashcards, spaced repetition,
                            public share routes, save-shared-set
    ai.js                 — AI chat, notes, flashcards, quizzes, lessons,
                            assignment coaching, grade parsing
    quizzes.js            — AI quiz generation and submission
    shareEdit.js          — public edit-together PUT endpoint
    infinitecampus.js     — IC integration scaffolding
    activity.js           — streak stats
src/
  main.jsx
  App.jsx                 — routes and providers
  index.css               — design tokens and global styles
  lib/
    api.js                — fetch wrapper and API helpers
    store.jsx             — app context (user, theme, sidebar, toast)
    timer.jsx             — global background timer
    music.jsx             — global music player
    socket.js             — Socket.IO singleton
    yjsProvider.js        — Yjs to Socket.IO bridge
    grades.js             — GPA and class-grade calculations
    utils.js              — helpers
  components/
    Layout.jsx            — sidebar, mobile nav, help/settings buttons
    CollabEditor.jsx      — TipTap + Yjs editor
    NotesChat.jsx         — floating "Ask my notes" drawer
    MusicPill.jsx         — bottom-center music control
    MusicSidebar.jsx      — full music browser on Focus page
    TimerBadge.jsx        — floating timer across pages
    StreakCard.jsx        — 30-day activity card
    UpcomingWorkCallout.jsx — high-impact assignment callout
    ScreenshotImportDialog.jsx — grades-from-image dialog
    PasteGradesDialog.jsx — grades-from-text dialog
    SettingsDialog.jsx    — themes, styles, accessibility, credits
    Tour.jsx              — guided onboarding
    InstallBanner.jsx     — PWA install prompt
    Logo.jsx              — sidebar logo with quokka easter egg
    ui/                   — button, card, input, dialog, badge, progress
  pages/
    Login.jsx
    Dashboard.jsx         — hero, stats, class chips, assignment list
    CalendarPage.jsx
    Focus.jsx             — timer, session notes, streak, music, stats
    Notes.jsx             — study set grid
    StudySet.jsx          — editor, cards, AI tutor, SRS study mode
    SharedSet.jsx         — public view, edit-together, save to my sets
    Learn.jsx             — guided lessons from a study set
    AssignmentWorkspace.jsx — step-by-step coach for an assignment
    Grades.jsx            — GPA, breakdown, import, what-if
    Quiz.jsx              — AI quiz flow
    Rooms.jsx             — room list
    Room.jsx              — live room with whiteboard, chat, polls
public/
  logo.png
  quokka.jpg
```

---

## Local development

Clone, install, and configure the environment.

```bash
git clone https://github.com/OogaBoogaPooga/StudySync.git
cd StudySync
npm install
```

Create a `.env` file at the project root:

```
JWT_SECRET=some-long-random-string
DATABASE_URL=file:./dev.db
NODE_ENV=development
PORT=4000
GROQ_API_KEY=gsk_...
GROQ_MODEL=openai/gpt-oss-120b
CREDENTIAL_ENCRYPTION_KEY=some-long-random-string-at-least-32-chars
```

Then initialize the database and start both servers:

```bash
npm run db:setup         # prisma db push + seed
npm run dev              # runs the API on :4000 and Vite on :5173
```

Vite proxies `/api` and Socket.IO to the backend. Open http://localhost:5173.

**Demo login:** `demo@studysync.app` / `password123`

To reset the database:

```bash
npm run db:reset
```

---

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `JWT_SECRET` | yes | Any long random string. Signs session tokens. |
| `DATABASE_URL` | yes | `file:/data/dev.db` on Railway, `file:./dev.db` locally. |
| `NODE_ENV` | yes | `production` on Railway, `development` locally. |
| `PORT` | no | Defaults to 4000. |
| `GROQ_API_KEY` | yes | Get one at console.groq.com. |
| `GROQ_MODEL` | no | Defaults to `openai/gpt-oss-120b`. |
| `GROQ_VISION_MODEL` | no | Defaults to `meta-llama/llama-4-scout-17b-16e-instruct`. |
| `GROQ_TEACH_MODEL` | no | Defaults to `llama-3.3-70b-versatile`. Used for lessons and coaching. |
| `GROQ_COACH_MODEL` | no | Same default. Used for assignment coaching. |
| `CREDENTIAL_ENCRYPTION_KEY` | yes | 32+ characters. Encrypts stored third-party credentials. |

---

## Railway deployment

The service auto-deploys on push to `main`.

**Build command**

```
npm install --include=dev && npm run build
```

**Start command**

```
npm start
```

**Pre-Deploy Command** must be left **empty**. If it runs `prisma db push`
on every deploy it will re-seed and wipe data.

**Persistent volume** must be mounted at `/data`. The SQLite database and
the study music live there and survive redeploys.

**After schema changes**, run once from the Railway shell:

```bash
npx prisma db push
```

That syncs the SQLite file with the current Prisma schema and regenerates
the Prisma Client. It does not need to run on every deploy — only when
`prisma/schema.prisma` changes.

---

## Database

SQLite via Prisma. Models:

- **User** — auth, plus optional Infinite Campus credential fields
- **Class** — name, color, credits, optional grade snapshot
- **Assignment** — title, due date, weight, progress, score, type,
  optional rubric and AI-generated task plan
- **StudySession** — focus session records for the streak and stats cards
- **StudySet** — notes content, share token, optional class/unit link,
  optional cached lesson plan and progress
- **Flashcard** — front/back plus SM-2 scheduling fields
- **ChatMessage** — message history for the notes chat
- **Quiz** and **QuizAttempt** — AI-generated quizzes and score history

Run `npx prisma studio` to browse the database with a UI.

---

## License

MIT.

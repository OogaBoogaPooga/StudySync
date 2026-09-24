# StudySync

A study companion that keeps assignments, focus sessions, notes, flashcards, and grades in one place. Built because juggling five different apps to stay on top of school is exhausting.

**Live:** [www.studysync.run.place](https://www.studysync.run.place)

**Demo login:** `demo@studysync.app` / `password123`

---

## Features

### Assignments
Track everything with a due date, class, and progress slider. Status updates itself: Late, Due soon, Done, Upcoming. Filter by any of those from the dashboard. You can throw in a score and weight if you want it to count toward your grade. There's a button that adds it to Google Calendar. It'll also send you a browser notification if something's due within 24 hours.

### Calendar
Month view. Assignments show up as colored chips on their due dates. Click a day to see what's on it.

### Focus timer
Standard Pomodoro cycle (25/5/15). Circular ring shows progress. Notes auto-save locally as you type so a refresh doesn't lose them. Every completed focus round gets logged with its duration and whatever you wrote. There's a bar chart of your last 7 days. When a round ends you get a chime and a notification. And a list of distraction tips if you're the kind of person who needs them.

### Notes & AI flashcards
Rich text editor (bold, italic, underline, headings, lists, links). Saves automatically. Add flashcards by hand, or paste your notes and let AI generate them. Study mode flips cards with Space and moves with arrow keys. Any set can be shared as a read-only public link.

### AI notes maker
Paste an article, textbook section, or transcript — or upload a Word doc, PowerPoint, PDF, or plain text file — and it turns the source into structured study notes with headings and bullet points. Then generate flashcards straight from those notes. Powered by Groq. Falls back to a simpler offline extractor if the API isn't configured.

### Grades
Weighted GPA on the 4.0 scale. Per-class breakdown with letter grades, averages, and credits. The what-if calculator lets you plug in a hypothetical score and see how it moves your class grade and your overall GPA. Bar chart of class performance, doughnut of credit distribution. Print button exports the whole thing to PDF.

### Study rooms
Shared whiteboard, group chat, and polls. Real-time via Socket.IO. You get a 6-character code and a copyable invite link. No video, no audio, no accounts needed to join.

### Other
Dark mode, light mode, high-contrast mode. Keyboard navigable. Responsive down to phone size.

---

## Tech Stack

- **Frontend:** React, Vite, Tailwind CSS, Radix UI, Chart.js, Fabric.js (whiteboard), Socket.IO client
- **Backend:** Node.js, Express, Prisma, SQLite, Socket.IO
- **AI:** Groq (OpenAI-compatible API) — falls back to a local heuristic extractor when no key is set
- **Deployment:** Railway with a persistent volume for the SQLite database

---

## Running Locally

Requirements: Node.js 18+ and npm.

```bash
# 1. Install dependencies (also generates the Prisma client)
npm install

# 2. Copy the environment file and set a JWT secret
cp .env.example .env
# Edit .env and change JWT_SECRET to any long random string

# 3. Create the SQLite database and seed demo data
npm run db:setup

# 4. Run the API (port 4000) and the Vite dev server (port 5173) together
npm run dev

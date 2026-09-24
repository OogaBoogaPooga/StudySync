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


Features
Assignments
Track everything with a due date, class, and progress slider. Status updates itself: Late, Due soon, Done, Upcoming. Filter by any of those from the dashboard. You can throw in a score and weight if you want it to count toward your grade. There's a button that adds it to Google Calendar. It'll also send you a browser notification if something's due within 24 hours.

Calendar
Month view. Assignments show up as colored chips on their due dates. Click a day to see what's on it.

Focus timer
Standard Pomodoro cycle (25/5/15). Circular ring shows progress. Notes auto-save locally as you type so a refresh doesn't lose them. Every completed focus round gets logged with its duration and whatever you wrote. There's a bar chart of your last 7 days. When a round ends you get a chime and a notification. And a list of distraction tips if you're the kind of person who needs them.

Notes
Rich text editor (bold, italic, underline, headings, lists, links). Saves automatically. You can add flashcards by hand, or dump your notes into the AI generator and get them back. If no OpenAI key is set, it falls back to a simple offline extractor — less clever but it works. Study mode flips cards with Space and moves with arrow keys. Any set can be shared as a read-only public link.

Grades
Weighted GPA on the 4.0 scale. Per-class breakdown with letter grades, averages, and credits. The what-if calculator lets you plug in a hypothetical score and see how it moves your class grade and your overall GPA. Bar chart of class performance, doughnut of credit distribution. Print button exports the whole thing to PDF.

Study rooms
Shared whiteboard, group chat, and polls. Real-time via Socket.IO. You get a 6-character code and a copyable invite link. No video, no audio, no accounts needed to join.

Other
Dark mode, light mode, high-contrast mode. Keyboard navigable. Responsive down to phone size. Deployed on Railway.

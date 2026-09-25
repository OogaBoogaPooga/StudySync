import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useApp } from './lib/store.jsx';
import Layout from './components/Layout.jsx';
import { MusicProvider } from './lib/music.jsx';
import MusicPill from './components/MusicPill.jsx';

const Login = lazy(() => import('./pages/Login.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const CalendarPage = lazy(() => import('./pages/CalendarPage.jsx'));
const Focus = lazy(() => import('./pages/Focus.jsx'));
const Notes = lazy(() => import('./pages/Notes.jsx'));
const StudySet = lazy(() => import('./pages/StudySet.jsx'));
const SharedSet = lazy(() => import('./pages/SharedSet.jsx'));
const Grades = lazy(() => import('./pages/Grades.jsx'));
const Rooms = lazy(() => import('./pages/Rooms.jsx'));
const Room = lazy(() => import('./pages/Room.jsx'));
const Quiz = lazy(() => import('./pages/Quiz.jsx'));

const Spinner = () => (
  <div className="flex h-[60vh] items-center justify-center" role="status" aria-label="Loading">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>
);

function Protected({ children }) {
  const { user, loading } = useApp();
  if (loading) return <Spinner />;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <MusicProvider>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/share/:shareId" element={<SharedSet />} />
          <Route element={<Protected><Layout /></Protected>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/focus" element={<Focus />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/notes/:id" element={<StudySet />} />
            <Route path="/quiz/:id" element={<Quiz />} />
            <Route path="/grades" element={<Grades />} />
            <Route path="/rooms" element={<Rooms />} />
            <Route path="/rooms/:code" element={<Room />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <MusicPill />
      </Suspense>
    </MusicProvider>
  );
}

import { Navigate } from 'react-router-dom';

export default function GamesGuard({ children }) {
  const unlocked = localStorage.getItem('studysync_games_unlocked') === 'true';
  if (!unlocked) {
    return <Navigate to="/focus" replace />;
  }
  return children;
}

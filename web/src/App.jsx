import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProgressProvider, useProgress } from './contexts/ProgressContext';
import { QuestionsProvider, useQuestions } from './contexts/QuestionsContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TestView from './pages/TestView';
import StrategyGuide from './pages/StrategyGuide';
import Flashcards from './pages/Flashcards';

function Gate({ children }) {
  const { user, loading: authLoading } = useAuth();
  const { loading: questionsLoading } = useQuestions();
  const { ready: progressReady } = useProgress();

  if (authLoading) return <div className="app-loading">Loading…</div>;
  if (user && (questionsLoading || !progressReady)) return <div className="app-loading">Loading your progress…</div>;
  return children;
}

function Shell() {
  return (
    <Gate>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/test/:subject" element={<ProtectedRoute><TestView /></ProtectedRoute>} />
        <Route path="/strategy" element={<ProtectedRoute><StrategyGuide /></ProtectedRoute>} />
        <Route path="/flashcards" element={<ProtectedRoute><Flashcards /></ProtectedRoute>} />
      </Routes>
    </Gate>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ProgressProvider>
          <QuestionsProvider>
            <Shell />
          </QuestionsProvider>
        </ProgressProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';

const ProgressContext = createContext(null);

const EMPTY = { english: {}, math: {} };

export const DEFAULT_QUESTION_PROGRESS = {
  selected: null,
  sprInput: '',
  checked: false,
  correct: null,
  flagged: false,
  confidence: null, // see lib/confidence.js
  eliminated: [],
  timeSpentSec: 0,
  annotations: [],
};

export function ProgressProvider({ children }) {
  const { user } = useAuth();
  const [progress, setProgress] = useState(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user) { setProgress(EMPTY); setReady(false); return; }
    setReady(false);
    let loaded = { english: false, math: false };
    const unsubs = ['english', 'math'].map((subject) =>
      onSnapshot(doc(db, 'users', user.uid, 'progress', subject), (snap) => {
        setProgress((prev) => ({ ...prev, [subject]: snap.exists() ? snap.data() : {} }));
        loaded[subject] = true;
        if (loaded.english && loaded.math) setReady(true);
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [user]);

  const getProg = useCallback((subject, id) => {
    return { ...DEFAULT_QUESTION_PROGRESS, ...(progress[subject] && progress[subject][id]) };
  }, [progress]);

  // Deep-merges `patch` into progress[subject][id] both locally (optimistic)
  // and in Firestore (setDoc with merge:true only sends the changed fields).
  const updateQuestionProgress = useCallback((subject, id, patch) => {
    if (!user) return;
    setProgress((prev) => ({
      ...prev,
      [subject]: {
        ...prev[subject],
        [id]: { ...DEFAULT_QUESTION_PROGRESS, ...(prev[subject] && prev[subject][id]), ...patch },
      },
    }));
    setDoc(doc(db, 'users', user.uid, 'progress', subject), { [id]: patch }, { merge: true })
      .catch((err) => console.error('Failed to save progress', err));
  }, [user]);

  const resetAllProgress = useCallback(() => {
    if (!user) return;
    setProgress(EMPTY);
    setDoc(doc(db, 'users', user.uid, 'progress', 'english'), {});
    setDoc(doc(db, 'users', user.uid, 'progress', 'math'), {});
  }, [user]);

  return (
    <ProgressContext.Provider value={{ progress, ready, getProg, updateQuestionProgress, resetAllProgress }}>
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress() {
  return useContext(ProgressContext);
}

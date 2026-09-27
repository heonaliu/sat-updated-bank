import { createContext, useContext, useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const QuestionsContext = createContext(null);

async function loadSubject(name) {
  const snap = await getDocs(collection(db, `questions_${name}`));
  const rows = snap.docs.map((d) => d.data());
  rows.sort((a, b) => a.order - b.order);
  return rows;
}

export function QuestionsProvider({ children }) {
  const [data, setData] = useState({ english: [], math: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([loadSubject('english'), loadSubject('math')])
      .then(([english, math]) => setData({ english, math }))
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }, []);

  return (
    <QuestionsContext.Provider value={{ data, loading, error }}>
      {children}
    </QuestionsContext.Provider>
  );
}

export function useQuestions() {
  return useContext(QuestionsContext);
}

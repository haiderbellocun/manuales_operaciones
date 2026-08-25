import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { storage } from '../utils/storage';
import { useAuth } from './AuthContext';

const DocsContext = createContext(null);

export function DocsProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setDocs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDocuments();
      setDocs(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => { refresh(); }, [refresh]);

  const toggleFav = useCallback(async (id) => {
    const numericId = Number(id);
    const doc = docs.find(d => Number(d.id) === numericId);
    const wasFav = doc?.fav ?? storage.isFavorite(numericId);
    setDocs(prev => prev.map(d => Number(d.id) === numericId ? { ...d, fav: !wasFav } : d));
    try {
      const isFav = await api.toggleFavorite(numericId);
      setDocs(prev => prev.map(d => Number(d.id) === numericId ? { ...d, fav: isFav } : d));
      return isFav;
    } catch (error) {
      setDocs(prev => prev.map(d => Number(d.id) === numericId ? { ...d, fav: wasFav } : d));
      throw error;
    }
  }, [docs]);

  const addDocument = useCallback(async (payload) => {
    const { file, infographic, ...meta } = payload;
    const doc = await api.uploadDocument(meta, file, infographic);
    await refresh();
    return doc;
  }, [refresh]);

  return (
    <DocsContext.Provider value={{ docs, loading, error, refresh, toggleFav, addDocument, setDocs }}>
      {children}
    </DocsContext.Provider>
  );
}

export function useDocs() {
  const ctx = useContext(DocsContext);
  if (!ctx) throw new Error('useDocs debe usarse dentro de DocsProvider');
  return ctx;
}

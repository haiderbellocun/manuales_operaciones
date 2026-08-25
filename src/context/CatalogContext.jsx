import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';
import { coordinationsForArea } from '../utils/areas';

const CatalogContext = createContext(null);

function byId(items, id) {
  return items.find(item => Number(item.id) === Number(id)) || null;
}

export function CatalogProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [areas, setAreas] = useState([]);
  const [coordinations, setCoordinations] = useState([]);
  const [types, setTypes] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);

  const refreshCatalogs = useCallback(async () => {
    if (!isAuthenticated) {
      setAreas([]);
      setCoordinations([]);
      setTypes([]);
      setPeople([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [nextAreas, nextCoordinations, nextTypes, nextPeople] = await Promise.all([
        api.getAreas(),
        api.getCoordinations(),
        api.getTypes(),
        api.getPeople(),
      ]);
      setAreas(nextAreas || []);
      setCoordinations(nextCoordinations || []);
      setTypes(nextTypes || []);
      setPeople(nextPeople || []);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => { refreshCatalogs(); }, [refreshCatalogs]);

  return (
    <CatalogContext.Provider value={{
      areas,
      coordinations,
      types,
      people,
      loading,
      refreshCatalogs,
      areaById: (id) => byId(areas, id),
      coordinationById: (id) => byId(coordinations, id),
      coordinationsForArea: (areaId) => coordinationsForArea(coordinations, areaId),
      typeById: (id) => byId(types, id),
      personById: (id) => byId(people, id),
    }}>
      {children}
    </CatalogContext.Provider>
  );
}

export function useCatalogs() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalogs debe usarse dentro de CatalogProvider');
  return ctx;
}

const KEYS = {
  favorites: 'acervo_favorites',
  libraryPrefs: 'acervo_library_prefs',
  searchHistory: 'acervo_search_history',
  session: 'acervo_session',
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded — silently ignore */
  }
}

export const storage = {
  getFavorites() {
    return read(KEYS.favorites, []);
  },

  setFavorites(ids) {
    write(KEYS.favorites, ids);
  },

  toggleFavorite(id) {
    const favs = storage.getFavorites();
    const next = favs.includes(id) ? favs.filter(x => x !== id) : [...favs, id];
    storage.setFavorites(next);
    return next;
  },

  isFavorite(id) {
    return storage.getFavorites().includes(id);
  },

  getLibraryPrefs() {
    return read(KEYS.libraryPrefs, { view: 'cards', sort: 'updated', filt: null });
  },

  saveLibraryPrefs(prefs) {
    write(KEYS.libraryPrefs, prefs);
  },

  getSearchHistory() {
    return read(KEYS.searchHistory, []);
  },

  addSearchQuery(q) {
    const trimmed = q.trim();
    if (!trimmed) return;
    const history = storage.getSearchHistory().filter(h => h !== trimmed);
    write(KEYS.searchHistory, [trimmed, ...history].slice(0, 8));
  },

  clearSearchHistory() {
    write(KEYS.searchHistory, []);
  },
};

export { KEYS };

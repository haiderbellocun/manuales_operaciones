import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from './context/AuthContext';
import { CatalogProvider } from './context/CatalogContext';
import { DocsProvider } from './context/DocsContext';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <CatalogProvider>
        <DocsProvider>
          <App />
        </DocsProvider>
      </CatalogProvider>
    </AuthProvider>
  </React.StrictMode>,
);

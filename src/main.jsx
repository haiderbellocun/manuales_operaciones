import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from './context/AuthContext';
import { DocsProvider } from './context/DocsContext';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <DocsProvider>
        <App />
      </DocsProvider>
    </AuthProvider>
  </React.StrictMode>,
);

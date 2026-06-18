import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DocsProvider } from './context/DocsContext';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <DocsProvider>
          <App />
        </DocsProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

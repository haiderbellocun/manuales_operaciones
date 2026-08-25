import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCatalogs } from '../context/CatalogContext';
import { Icon } from '../components';

function loadGoogleIdentityScript() {
  if (window.google?.accounts?.id) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-google-identity]');
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = 'true';
    script.onload = resolve;
    script.onerror = () => reject(new Error('No se pudo cargar Google Identity Services.'));
    document.head.appendChild(script);
  });
}

export function LoginView() {
  const { loginWithGoogle, loading, error } = useAuth();
  const { areas } = useCatalogs();
  const googleButtonRef = useRef(null);
  const [googleReady, setGoogleReady] = useState(false);
  const [googleError, setGoogleError] = useState('');
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const heroAreas = areas.slice(0, 6);

  useEffect(() => {
    let cancelled = false;
    if (!clientId) {
      setGoogleError('Google OAuth no esta configurado. Define VITE_GOOGLE_CLIENT_ID.');
      return undefined;
    }

    loadGoogleIdentityScript()
      .then(() => {
        if (cancelled || !googleButtonRef.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          cancel_on_tap_outside: false,
          callback: async ({ credential }) => {
            if (!credential) {
              setGoogleError('Google no devolvio una credencial valida. Revisa el Client ID y los origenes autorizados.');
              return;
            }
            try {
              await loginWithGoogle(credential);
            } catch {
              // AuthContext muestra el error.
            }
          },
        });
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: 360,
        });
        setGoogleReady(true);
      })
      .catch(err => {
        if (!cancelled) setGoogleError(err.message || 'No se pudo inicializar Google.');
      });

    return () => { cancelled = true; };
  }, [clientId, loginWithGoogle]);

  return (
    <div className="login-layout">
      <div className="login-hero">
        <div className="hero-bg-circle hero-bg-circle-1"></div>
        <div className="hero-bg-circle hero-bg-circle-2"></div>
        <div className="row gap-12 login-brand">
          <span className="brand-mark" style={{ width: 40, height: 40 }}><svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><path d="M4 19V5a2 2 0 0 1 2-2h2v18H6a2 2 0 0 1-2-2zM10 3h2v18h-2zM15.5 3.5l3.8 1 3.7 14.5-3.8 1z" /></svg></span>
          <div><div style={{ fontWeight: 800, fontSize: 22 }}>Acervo</div><div className="login-brand-sub">Operaciones</div></div>
        </div>
        <div className="login-hero-content">
          <h1 className="login-hero-title">Centro de Conocimiento Operativo</h1>
          <p className="login-hero-desc">El repositorio vivo del Area de Operaciones. Manuales, procedimientos, ANS y descriptores de cargo centralizados, trazables y siempre a la mano.</p>
          {heroAreas.length > 0 && (
            <div className="row gap-16 mt-24 login-areas">
              {heroAreas.map(area => <span key={area.id} className="login-area-chip">{area.name}</span>)}
            </div>
          )}
        </div>
        <div className="login-footer">2026 - Plataforma institucional de gestion documental</div>
      </div>
      <div className="login-form-wrap">
        <div className="login-form">
          <h2 className="login-form-title">Iniciar sesion</h2>
          <p className="muted login-form-sub">Accede con tu cuenta institucional de Google CUN.</p>
          {(error || googleError) && <div className="login-error"><Icon name="alert" size={16} />{error || googleError}</div>}
          <div className="google-login-box">
            <div ref={googleButtonRef} className="google-login-button"></div>
            {loading && <div className="text-sm muted mt-16">Validando cuenta...</div>}
            {!googleReady && !googleError && <div className="text-sm muted mt-16">Cargando Google...</div>}
          </div>
          <p className="text-xs muted mt-20" style={{ textAlign: 'center', lineHeight: 1.5 }}>Solo pueden ingresar usuarios activos con correo @cun.edu.co registrado en la base de datos.</p>
        </div>
      </div>
    </div>
  );
}

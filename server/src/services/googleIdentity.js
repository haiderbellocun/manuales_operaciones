import { OAuth2Client } from 'google-auth-library';

const DEFAULT_ALLOWED_DOMAINS = 'cun.edu.co';

function configuredDomains() {
  return (process.env.GOOGLE_ALLOWED_DOMAINS || process.env.GOOGLE_ALLOWED_DOMAIN || DEFAULT_ALLOWED_DOMAINS)
    .split(',')
    .map(domain => domain.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);
}

export function getAllowedGoogleDomains() {
  return configuredDomains();
}

export function isAllowedGoogleEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  return configuredDomains().some(domain => normalized.endsWith(`@${domain}`));
}

export function assertAllowedGoogleEmail(email) {
  if (!isAllowedGoogleEmail(email)) {
    const err = new Error(`Solo se permite el acceso con correos institucionales ${configuredDomains().map(d => `@${d}`).join(', ')}.`);
    err.statusCode = 403;
    throw err;
  }
}

export async function verifyGoogleCredential(credential) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) {
    const err = new Error('Google OAuth no esta configurado. Define GOOGLE_OAUTH_CLIENT_ID en el backend.');
    err.statusCode = 503;
    throw err;
  }

  if (!credential) {
    const err = new Error('No se recibio la credencial de Google.');
    err.statusCode = 400;
    throw err;
  }

  const client = new OAuth2Client(clientId);
  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: clientId,
  });
  const payload = ticket.getPayload();
  const email = String(payload?.email || '').toLowerCase();

  if (!email || payload?.email_verified !== true) {
    const err = new Error('Google no confirmo el correo de la cuenta.');
    err.statusCode = 401;
    throw err;
  }

  assertAllowedGoogleEmail(email);
  return {
    email,
    name: payload.name,
    picture: payload.picture,
    hostedDomain: payload.hd,
  };
}

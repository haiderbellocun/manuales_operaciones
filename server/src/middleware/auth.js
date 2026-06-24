import '../config/env.js';
import jwt from 'jsonwebtoken';
import { findByEmail, getAuthContext } from '../db/repos/users.js';
import { isAllowedGoogleEmail } from '../services/googleIdentity.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET no esta definido en las variables de entorno. Configura server/.env');
const JWT_EXPIRES = '4h';
export const SESSION_COOKIE_NAME = 'acervo_session';
export const SESSION_MAX_AGE_MS = 4 * 60 * 60 * 1000;

function getCookie(req, name) {
  const raw = req.headers.cookie || '';
  const cookies = raw.split(';').map(part => part.trim()).filter(Boolean);
  for (const cookie of cookies) {
    const eq = cookie.indexOf('=');
    if (eq === -1) continue;
    const key = cookie.slice(0, eq);
    if (key === name) return decodeURIComponent(cookie.slice(eq + 1));
  }
  return null;
}

export function sessionCookieOptions() {
  const production = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: production,
    sameSite: 'strict',
    maxAge: SESSION_MAX_AGE_MS,
    path: '/',
  };
}

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES },
  );
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

async function normalizeTokenPayload(payload) {
  const numericSub = Number(payload.sub);
  if (Number.isInteger(numericSub) && numericSub > 0) {
    return { ...payload, sub: numericSub };
  }

  if (payload.email) {
    const user = await findByEmail(payload.email);
    if (user) {
      return { ...payload, sub: user.id, role: user.role_id };
    }
  }

  return payload;
}

export async function authRequired(req, res, next) {
  const cookieToken = getCookie(req, SESSION_COOKIE_NAME);
  const token = cookieToken;

  if (!token) {
    return res.status(401).json({ message: 'Sesion no valida. Inicia sesion de nuevo.' });
  }

  try {
    req.user = await normalizeTokenPayload(verifyToken(token));
    if (!isAllowedGoogleEmail(req.user.email)) {
      return res.status(401).json({ message: 'Sesion no valida para el dominio institucional permitido.' });
    }
    next();
  } catch {
    return res.status(401).json({ message: 'Token expirado o invalido.' });
  }
}

export async function authOptional(req, _res, next) {
  const cookieToken = getCookie(req, SESSION_COOKIE_NAME);
  const token = cookieToken;
  if (token) {
    try {
      req.user = await normalizeTokenPayload(verifyToken(token));
    } catch {
      // Ignore invalid optional tokens.
    }
  }
  next();
}

async function loadActiveAuthUser(req, res) {
  if (!req.user?.sub) {
    res.status(401).json({ message: 'Sesion no valida. Inicia sesion de nuevo.' });
    return null;
  }

  const authUser = await getAuthContext(req.user.sub);
  if (!authUser || authUser.status !== 'Activo') {
    res.status(403).json({ message: 'Usuario inactivo o sin acceso al sistema.' });
    return null;
  }

  return authUser;
}

export function requirePermission(...permissions) {
  return async (req, res, next) => {
    try {
      const authUser = await loadActiveAuthUser(req, res);
      if (!authUser) return;

      const perms = authUser.perms || {};
      const allowed = permissions.every(permission => perms[permission] === true);
      if (!allowed) {
        return res.status(403).json({ message: 'No tienes permisos para realizar esta accion.' });
      }

      req.auth = {
        id: authUser.id,
        name: authUser.name,
        email: authUser.email,
        role: authUser.role_id,
        area: authUser.area_id,
        roleName: authUser.role_name,
        perms,
      };
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireRole(...roles) {
  return async (req, res, next) => {
    try {
      const authUser = await loadActiveAuthUser(req, res);
      if (!authUser) return;

      if (!roles.map(Number).includes(authUser.role_id)) {
        return res.status(403).json({ message: 'No tienes permisos para administrar esta seccion.' });
      }

      req.auth = {
        id: authUser.id,
        name: authUser.name,
        email: authUser.email,
        role: authUser.role_id,
        area: authUser.area_id,
        roleName: authUser.role_name,
        perms: authUser.perms || {},
      };
      next();
    } catch (err) {
      next(err);
    }
  };
}

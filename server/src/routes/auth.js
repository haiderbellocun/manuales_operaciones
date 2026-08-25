import { Router } from 'express';
import {
  createGoogleUser, findByEmail, findById, updateGoogleProfilePicture,
  updateLastAccess, sanitizeUser, userForToken,
} from '../db/repos/users.js';
import {
  SESSION_COOKIE_NAME, authRequired, sessionCookieOptions, signToken,
} from '../middleware/auth.js';
import { isAllowedGoogleEmail, verifyGoogleCredential } from '../services/googleIdentity.js';
import { recordAppLogin } from '../services/centralLoginLog.js';

const router = Router();

router.post('/google', async (req, res, next) => {
  try {
    const { credential } = req.body || {};
    const identity = await verifyGoogleCredential(credential);
    const existingUser = await findByEmail(identity.email);
    const user = existingUser
      ? await updateGoogleProfilePicture(existingUser.id, identity.picture)
      : await createGoogleUser(identity);
    if (user.status !== 'Activo') {
      return res.status(403).json({ message: 'Usuario inactivo. Contacta al administrador.' });
    }

    await updateLastAccess(user.id);
    recordAppLogin(user.email, 'acervo');
    const token = signToken(userForToken(user));
    res.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions());
    return res.json({ user: await sanitizeUser(user), provider: 'google' });
  } catch (err) {
    return next(err);
  }
});

router.get('/session', authRequired, async (req, res, next) => {
  try {
    const user = await findById(req.user.sub);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
    if (!isAllowedGoogleEmail(user.email)) return res.status(401).json({ message: 'Sesion no valida para el dominio institucional permitido.' });
    return res.json({ user: await sanitizeUser(user), provider: 'session' });
  } catch (err) {
    return next(err);
  }
});

router.post('/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE_NAME, {
    ...sessionCookieOptions(),
    maxAge: undefined,
  });
  return res.status(204).send();
});

export default router;

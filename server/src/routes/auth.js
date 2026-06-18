import { Router } from 'express';
import {
  findByEmail, findById, updateLastAccess, sanitizeUser, userForToken,
} from '../db/repos/users.js';
import { signToken, authRequired } from '../middleware/auth.js';

const router = Router();

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'Correo y contraseña son obligatorios.' });
    }
    const user = await findByEmail(email);
    if (!user) return res.status(401).json({ message: 'Correo no registrado en el sistema.' });
    if (user.status !== 'Activo') {
      return res.status(403).json({ message: 'Usuario inactivo. Contacta al administrador.' });
    }
    if (user.password !== password) {
      return res.status(401).json({ message: 'Contraseña incorrecta.' });
    }
    await updateLastAccess(user.id);
    const token = signToken(userForToken(user));
    res.json({ token, user: await sanitizeUser(user), provider: 'credentials' });
  } catch (err) {
    next(err);
  }
});

router.post('/microsoft', async (req, res, next) => {
  try {
    const user = await findByEmail('mlopez@institucion.edu.co');
    if (!user) return res.status(500).json({ message: 'Usuario demo no configurado.' });
    const token = signToken(userForToken(user));
    res.json({ token, user: await sanitizeUser(user), provider: 'microsoft' });
  } catch (err) {
    next(err);
  }
});

router.get('/session', authRequired, async (req, res, next) => {
  try {
    const user = await findById(req.user.sub);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
    res.json({ user: await sanitizeUser(user), provider: 'session' });
  } catch (err) {
    next(err);
  }
});

export default router;

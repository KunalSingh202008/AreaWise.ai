import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { RequestHandler } from 'express';
import config from '../firebase-applet-config.json';

const firebaseApp = getApps()[0] ?? initializeApp({
  projectId: process.env.FIREBASE_PROJECT_ID || config.projectId,
});

export const requireAdmin: RequestHandler = async (req, res, next) => {
  const token = req.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) {
    res.status(401).json({ error: 'Sign in to continue.' });
    return;
  }

  try {
    const user = await getAuth(firebaseApp).verifyIdToken(token, true);
    if (user.admin !== true) {
      res.status(403).json({ error: 'Administrator access required.' });
      return;
    }
    res.locals.adminUid = user.uid;
    next();
  } catch {
    res.status(401).json({ error: 'Could not verify your session. Sign in again.' });
  }
};

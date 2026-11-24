import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { RequestHandler, Response } from 'express';
import config from '../firebase-applet-config.json';

export interface Session {
  uid: string;
  email: string;
  name: string | null;
  admin: boolean;
  professional: boolean;
}

const projectId = process.env.FIREBASE_PROJECT_ID || config.projectId;
const emulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (emulator && (process.env.NODE_ENV === 'production' || !projectId.startsWith('demo-') ||
    !/^127\.0\.0\.1:\d+$/.test(emulator))) {
  throw new Error('Firebase Auth emulator requires a demo project on loopback outside production.');
}
const firebaseApp = getApps()[0] ?? initializeApp({ projectId });

export function session(res: Response): Session {
  return res.locals.account as Session;
}

function authenticate(adminOnly: boolean): RequestHandler {
  return async (req, res, next) => {
    const token = req.get('authorization')?.match(/^Bearer (\S{1,8192})$/i)?.[1];
    if (!token) {
      res.status(401).json({ error: 'Sign in to continue.' });
      return;
    }

    try {
      const user = await getAuth(firebaseApp).verifyIdToken(token, adminOnly);
      if (adminOnly && user.admin !== true) {
        res.status(403).json({ error: 'Administrator access required.' });
        return;
      }
      res.locals.account = {
        uid: user.uid, email: user.email || '', name: user.name || null,
        admin: user.admin === true, professional: user.professional === true,
      } satisfies Session;
    } catch {
      res.status(401).json({ error: 'Could not verify your session. Sign in again.' });
      return;
    }
    next();
  };
}

export const requireSignedIn = authenticate(false);
export const requireAdmin = authenticate(true);

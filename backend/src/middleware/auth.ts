import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

export const JWT_SECRET = process.env.JWT_SECRET || 'signvault-dev-secret';

export interface AuthPayload {
  email: string;
  name: string;
  role: string;
}

export interface AuthedRequest extends Request {
  user?: AuthPayload;
}

export const requireAuth = (req: AuthedRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET) as AuthPayload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
};

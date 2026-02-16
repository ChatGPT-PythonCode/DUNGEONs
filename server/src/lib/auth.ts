import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret";

export const signToken = (userId: string) => jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });

export interface AuthedRequest extends Request {
  userId?: string;
}

export const authMiddleware = (req: AuthedRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "missing token" });
  try {
    const payload = jwt.verify(header.replace("Bearer ", ""), JWT_SECRET) as { userId: string };
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: "invalid token" });
  }
};

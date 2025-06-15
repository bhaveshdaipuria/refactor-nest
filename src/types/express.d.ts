import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      session?: {
        user?: {
          role: string;
          allowedConstituencies?: string[];
        };
      };
      userRole?: string;
      allowedConst?: string[];
    }
  }
} 
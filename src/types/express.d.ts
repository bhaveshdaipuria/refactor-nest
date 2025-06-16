import { Request } from "express";

declare global {
  namespace Express {
    // Your custom request extensions
    interface Request {
      session?: {
        user?: {
          role: string;
          allowedConstituencies?: string[];
        };
      };
      userRole?: string;
      allowedConst?: string[];
      file?: Express.Multer.File; // Add Multer file to Request
    }

    // Add Multer to Express namespace
    namespace Multer {
      interface File {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        destination: string;
        filename: string;
        path: string;
        buffer?: Buffer;
      }
    }
  }
}

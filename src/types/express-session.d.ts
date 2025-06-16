import "express-session";

declare module "express-session" {
  interface Session {
    user?: {
      role: string;
      allowedConstituencies?: string[];
      email?: string;
    };
  }
}

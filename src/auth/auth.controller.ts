import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  Next,
  UseGuards,
} from "@nestjs/common";
import { Response, Request, NextFunction } from "express";
import { AuthService } from "./auth.service";
import { AdminGuard } from "src/guards/admin.guard";

@Controller("api/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  async registerUser(
    @Req() req: Request & { session: { user?: any } },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const { email, password } = req.body;
      const result = await this.authService.registerUser(
        email,
        password,
        req.session,
      );
      return res.status(result.status).json(result.response);
    } catch (error) {
      next(error);
    }
  }

  @Post("create-account")
  async createAccount(@Req() req: Request, @Res() res: Response) {
    try {
      const { email, password, role, allowedConstituencies } = req.body;
      const result = await this.authService.createAccount(
        email,
        password,
        role,
        allowedConstituencies,
      );
      return res.status(result.status).json(result.response);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  @Post("login")
  async login(
    @Req() req: Request & { session: { user?: any } },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const { email, password } = req.body;
      const result = await this.authService.login(email, password, req.session);
      return res.status(result.status).json(result.response);
    } catch (error) {
      next(error);
    }
  }

  @Get("logout")
    logout(
    @Req() req: Request & { session: { destroy?: any } },
    @Res() res: Response,
  ) {
    const result = this.authService.logout(req.session);
    if (result.redirect) {
      return res.redirect(result.redirect);
    }
    return res.status(200).json({ message: "Logged out successfully" });
  }

  @Get("admin")
  @UseGuards(AdminGuard)
  admin(@Res() res: Response) {
    res.status(200).json({ message: "Access granted to admin" });
  }
}

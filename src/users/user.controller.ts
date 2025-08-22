import {
  Controller,
  Delete,
  Patch,
  Put,
  Req,
  Res,
  Body,
  Param,
} from "@nestjs/common";
import { Request, Response } from "express";
import { UserService } from "./user.service";

@Controller("api/user")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Patch("/details/:id")
  async updateCandidateById(
    @Param("id") userId: string,
    @Body("email") email: string,
    @Body("role") role: string,
    @Res() res: Response,
  ) {
    try {
      const updatedUser = await this.userService.updateUserById(userId, email, role);
      return res.status(200).json({
        success: true,
        message: "User updated successfully",
        user: updatedUser,
      });
    } catch (error) {
      return res.status(error.status || 500).json({
        message: error.message || "Internal server error",
      });
    }
  }

  @Put("add/:id")
  async addConstituencyIDS(
    @Param("id") userId: string,
    @Body("constituencyIds") constituencyIds: string[],
    @Res() res: Response,
  ) {
    try {
      await this.userService.addConstituencyIds(userId, constituencyIds);
      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(error.status || 500).json({ message: error.message });
    }
  }

  @Put("remove/:id")
  async removeConstituencyIDS(
    @Param("id") userId: string,
    @Body("constituencyId") constituencyId: string,
    @Res() res: Response,
  ) {
    try {
      await this.userService.removeConstituencyId(userId, constituencyId);
      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(error.status || 500).json({ message: error.message });
    }
  }

  @Delete("/delete/:id")
  async deleteUserById(
    @Param("id") userId: string,
    @Res() res: Response,
  ) {
    try {
      await this.userService.deleteUserById(userId);
      return res.status(200).json({ success: true, message: "User deleted successfully" });
    } catch (error) {
      return res.status(error.status || 500).json({ message: error.message });
    }
  }
}

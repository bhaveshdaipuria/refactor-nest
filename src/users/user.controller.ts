import { Controller, Delete, Patch, Put, Req, Res } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Request, Response } from "express";
import { Model } from "mongoose";
import { userSchema } from "src/schemas/user.schema";

@Controller("api/user")
export class UserControler {
  constructor(
    @InjectModel("User") private userModel: Model<typeof userSchema>,
  ) {}

  @Patch("/details/:id")
  async updateCandidateById(@Req() req: Request, @Res() res: Response) {
    try {
      const userId = req.params.id;
      let { email, role } = req.body;
      console.log(userId);
      console.log(req.body);
      // Normalize role
      if (role) {
        role = role.toLowerCase().split(" ").join("");
      }

      // Valid roles
      const validRoles = ["superadmin", "admin", "user"];
      if (!role || !validRoles.includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      if (!userId) {
        return res.status(400).json({ message: "User ID not found" });
      }

      const updatedUser = await this.userModel.findByIdAndUpdate(userId, {
        $set: { email, role },
      });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.status(200).json({
        success: true,
        message: "User updated successfully",
        user: updatedUser,
      });
    } catch (error) {
      console.error("Error updating user:", error);
      res
        .status(500)
        .json({ message: "Internal server error", error: error.message });
    }
  }

  @Put("add/:id")
  async addConstituencyIDS(@Req() req: Request, @Res() res: Response) {
    try {
      console.log(req.params.id);
      const userId = req.params.id;
      const { constituencyIds } = req.body;

      if (
        !constituencyIds ||
        !Array.isArray(constituencyIds) ||
        constituencyIds.length === 0
      ) {
        return res
          .status(400)
          .json({ message: "No constituency IDs provided" });
      }

      const updatedUser = await this.userModel.findByIdAndUpdate(userId, {
        $push: { allowedConstituencies: { $each: constituencyIds } },
      });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error", error });
    }
  }

  @Put("remove/:id")
  async removeConstituencyIDS(@Req() req: Request, @Res() res: Response) {
    try {
      const userId = req.params.id;
      const { constituencyId } = req.body;

      if (!userId || !constituencyId) {
        return res
          .status(400)
          .json({ message: "userId or ConstituencyId not found" });
      }

      const updatedUser = await this.userModel.findByIdAndUpdate(userId, {
        $pull: { allowedConstituencies: constituencyId },
      });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error", error });
    }
  }

  @Delete("/delete/:id")
  async deleteUserById(@Req() req: Request, @Res() res: Response) {
    try {
      const userId = req.params.id;
      const user = await this.userModel.findById(userId);

      const deleteUser = await this.userModel.findByIdAndDelete(userId);
      if (!deleteUser) {
        return res.status(404).json({ message: "could not delete user" });
      }
      return res
        .status(200)
        .json({ success: true, message: "User deleted successfully" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error", error });
    }
  }
}

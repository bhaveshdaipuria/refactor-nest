import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { userSchema } from "src/schemas/user.schema";

@Injectable()
export class UserService {
  constructor(
    @InjectModel("User") private readonly userModel: Model<typeof userSchema>,
  ) {}

  async updateUserById(userId: string, email: string, role: string) {
    if (!userId) throw new BadRequestException("User ID not provided");

    // Normalize role
    if (role) role = role.toLowerCase().split(" ").join("");

    const validRoles = ["superadmin", "admin", "user"];
    if (!role || !validRoles.includes(role)) {
      throw new BadRequestException("Invalid role");
    }

    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      { $set: { email, role } },
      { new: true },
    );

    if (!updatedUser) throw new NotFoundException("User not found");

    return updatedUser;
  }

  async addConstituencyIds(userId: string, constituencyIds: string[]) {
    if (!constituencyIds || !Array.isArray(constituencyIds) || constituencyIds.length === 0) {
      throw new BadRequestException("No constituency IDs provided");
    }

    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      { $push: { allowedConstituencies: { $each: constituencyIds } } },
      { new: true },
    );

    if (!updatedUser) throw new NotFoundException("User not found");

    return updatedUser;
  }

  async removeConstituencyId(userId: string, constituencyId: string) {
    if (!userId || !constituencyId) {
      throw new BadRequestException("userId or ConstituencyId not provided");
    }

    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      { $pull: { allowedConstituencies: constituencyId } },
      { new: true },
    );

    if (!updatedUser) throw new NotFoundException("User not found");

    return updatedUser;
  }

  async deleteUserById(userId: string) {
    const deletedUser = await this.userModel.findByIdAndDelete(userId);

    if (!deletedUser) throw new NotFoundException("Could not delete user");

    return deletedUser;
  }
}

import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as bcrypt from "bcrypt";
import { userSchema } from "../schemas/user.schema";

@Injectable()
export class AuthService {
  constructor(
    @InjectModel("User")
    private readonly userModel: Model<typeof userSchema>,
  ) {}

  async registerUser(email: string, password: string, session: any) {
    if (!email || !password) {
      return { status: 400, response: { message: "Please provide both email and password" } };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { status: 400, response: { message: "Invalid email format" } };
    }

    if (password.length < 8) {
      return { status: 400, response: { message: "Password must be at least 8 characters long" } };
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new this.userModel({ email, password: hashedPassword });
    await user.save();

    if (!session) {
      throw new Error("Session not initialized");
    }

    session.user = user;
    return { status: 201, response: { message: "User registered successfully" } };
  }

  async createAccount(email: string, password: string, role: string, allowedConstituencies?: string[]) {
    if (!email || !password) {
      return { status: 400, response: { message: "Please provide both email and password" } };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { status: 400, response: { message: "Invalid email format" } };
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let newUser: any = { email, password: hashedPassword, role };

    if (role === "user") {
      newUser["allowedConstituencies"] = allowedConstituencies;
    }

    const newCreatedUser = new this.userModel(newUser);
    const isSaved = await newCreatedUser.save();
    if (!isSaved) {
      return { status: 400, response: { message: "Bad Request" } };
    }

    return { status: 200, response: { success: true } };
  }

  async login(email: string, password: string, session: any) {
    if (!email || !password) {
      return { status: 400, response: { message: "Please provide both email and password" } };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { status: 400, response: { message: "Invalid email format" } };
    }

    if (password.length < 8) {
      return { status: 400, response: { message: "Password must be at least 8 characters long" } };
    }

    const user: any = await this.userModel.findOne({ email });
    if (!user) {
      return { status: 404, response: { message: "You are not registered!" } };
    }

    if (await bcrypt.compare(password, user.password)) {
      session.user = user;
      return { status: 200, response: { message: "Login successful" } };
    } else {
      return { status: 401, response: { message: "Incorrect password" } };
    }
  }

   logout(session: any) {
    session.destroy();
    return { redirect: "/" };
  }
}

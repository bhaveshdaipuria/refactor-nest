import { Controller, Get, Query, Res, Req, HttpStatus, Param, Next, Render, UseGuards, Post } from "@nestjs/common";
import { Response, Request, NextFunction } from "express";
import { InjectModel } from "@nestjs/mongoose";
import { Model, PipelineStage } from "mongoose";
import { InjectRedis } from "@nestjs-modules/ioredis";
import Redis from "ioredis";
import { ElectionCandidateSchema } from "../schemas/candidate-election.schema";
import { TempElectionSchema } from "../schemas/temp-election.schema";
import { ElectionPartyResultSchema } from "../schemas/party-election.schema";
import { ElectionSchema } from "../schemas/election.schema";
import * as bcrypt from 'bcrypt';
import { userSchema } from '../schemas/user.schema';
import { AdminGuard } from "src/guards/admin.guard";
import { RedisManager } from "../config/redis.manager";

@Controller('api/auth')
export class AuthController {
	constructor(
		@InjectModel("ElectionCandidate")
		private electionCandidateModel: Model<typeof ElectionCandidateSchema>,
		@InjectModel("ElectionPartyResult")
		private partyElectionModel: Model<typeof ElectionPartyResultSchema>,
		@InjectModel("TempElection")
		private tempElectionModel: Model<typeof TempElectionSchema>,
		@InjectModel("Election")
		private electionModel: Model<typeof ElectionSchema>,
		@InjectModel("User")
		private userModel: Model<typeof userSchema>,
		private readonly redisManager: RedisManager,
	) {}

    @Post('register')
    async registerUser(
        @Req() req: Request & {session: {user?: any}}, 
        @Res() res: Response,
        @Next() next: NextFunction
    ) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res
                    .status(400)
                    .json({ message: "Please provide both email and password" });
            }
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ message: "Invalid email format" });
            }

            if (password.length < 8) {
                return res
                    .status(400)
                    .json({ message: "Password must be at least 8 characters long" });
            }
            const hashedPassword = await bcrypt.hash(password, 10);
            const user = new this.userModel({ email, password: hashedPassword });
            await user.save();
            
            if (!req.session) {
                throw new Error('Session not initialized');
            }
            
            req.session.user = user;
            res.status(201).json({ message: "User registered successfully" });
        } catch (error) {
            next(error);
        }
    }

    @Post('create-account')
    async createAccount(@Req() req: Request, @Res() res: Response){
    try {
        const { email, password, role, allowedConstituencies } = req.body;
        if (!email || !password) {
        return res
            .status(400)
            .json({ message: "Please provide both email and password" });
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        let newUser = {
        email,
        password: hashedPassword,
        role,
        };
        if (role === "user") {
        newUser["allowedConstituencies"] = allowedConstituencies;
        }
        const newCreatedUser = new this.userModel(newUser);
        const isSaved = await newCreatedUser.save();
        if (!isSaved) {
        return res.status(400).json({ message: "Bad Request" });
        }
        return res.status(200).json({ success: true });

        } catch (error) {
        return res.status(500).json({ error: error.message });
        }

    }

    @Post('login')
    async login(@Req() req: Request & {session: {user?: any}}, @Res() res: Response, @Next() next: NextFunction){
    try {
        const { email, password } = req.body;
        console.log(email, password);
        if (!email || !password) {
        return res
            .status(400)
            .json({ message: "Please provide both email and password" });
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
        }

        if (password.length < 8) {
        return res
            .status(400)
            .json({ message: "Password must be at least 8 characters long" });
        }
        const user: any = await this.userModel.findOne({ email });
        if (!user) {
        return res.status(404).json({ message: "You are not registered!" });
        }
        if (await bcrypt.compare(password, user.password)) {
        req.session.user = user;
        res.status(200).json({ message: "Login successful" });
        } else {
        res.status(401).json({ message: "Incorrect password" });
        }
    } catch (error) {
        next(error);
    }

    }

    @Get('logout')
    logout(@Req() req: Request & {session: {destroy?: any}}, @Res() res: Response){
        req.session.destroy()
        res.redirect('/')
    }

    @Get('admin')
    @UseGuards(AdminGuard)
    admin(@Res() res: Response){
        res.status(200).json({message: 'Access granted to admin'})
    }

}


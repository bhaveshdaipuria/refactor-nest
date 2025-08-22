import { Controller, Get, Query, Res, Req, HttpStatus, Param, Next, Render, UseGuards } from "@nestjs/common";
import { AdminGuard } from "src/guards/admin.guard";
import { UserGuard } from "src/guards/user.guard";
import { LoggedInGuard } from "src/guards/logged-in.guard";
import { Response, Request, NextFunction } from "express";
import { InjectModel } from "@nestjs/mongoose";
import { Model, PipelineStage } from "mongoose";
import { TempElectionSchema } from "src/schemas/temp-election.schema";
import { constituencySchema } from "src/schemas/constituency.schema";
import { ConstituencyElectionSchema } from "src/schemas/constituency-election.schema";
import { candidateSchema } from "src/schemas/candidates.schema";
import { ElectionCandidateSchema } from "src/schemas/candidate-election.schema";
import { partySchema } from "src/schemas/party.schema";
import { electionSchema } from "src/schemas/assembly-election.schema";
import { ElectionPartyResultSchema } from "src/schemas/party-election.schema";
import { userSchema } from "src/schemas/user.schema";
import { ElectionSchema } from "src/schemas/election.schema";
import mongoose from "mongoose";
import { allianceSchema } from "src/schemas/alliance.schema";
import { RedisManager } from "../config/redis.manager";
import { DashBoardService } from "./dashboard.service";

@Controller()
export class DashBoardController {
	constructor(
		@InjectModel("TempElection")
		private tempElectionModel: Model<typeof TempElectionSchema>,
		@InjectModel("Election")
		private electionModel: Model<typeof ElectionSchema>,
		@InjectModel("Constituency")
		private constituencyModel: Model<typeof constituencySchema>,
		@InjectModel("ElectionConstituency")
		private electionConsituencyModel: Model<typeof ConstituencyElectionSchema>,
		@InjectModel("Candidate")
		private candidateModel: Model<typeof candidateSchema>,
		@InjectModel("ElectionCandidate")
		private electionCandidateModel: Model<typeof ElectionCandidateSchema>,
		@InjectModel("Party")
		private partyModel: Model<typeof partySchema>,
		@InjectModel("ElectionPartyResult")
		private electionPartyResultModel: Model<typeof ElectionPartyResultSchema>,
		@InjectModel("User")
		private userModel: Model<typeof userSchema>,
		@InjectModel("AssemblyElection")
		private assemblyElectionModel: Model<typeof electionSchema>,
		@InjectModel("Alliance")
		private allianceModel: Model<typeof allianceSchema>,
		private readonly redisManager: RedisManager,
		private readonly dashboardService: DashBoardService,
	) {}

	@Get()
	afterLogin(
		@Req() req: Request & { session: { user?: any } },
		@Res() res: Response
	) {
		return this.dashboardService.afterLogin(req, res);
	}

	@Get('edit-election/:id')
	@UseGuards(LoggedInGuard)
	@UseGuards(AdminGuard)
	@Render('edit-election')
	async editElection(
		@Req() req: Request & { session: { user?: any } },
		@Param('id') id: string
	) {
		return this.dashboardService.editElection(req, id);
	}

	@Get('login')
	loginPage(
		@Req() req: Request & { session: { user?: any } },
		@Res() res: Response
	) {
		return this.dashboardService.loginPage(req, res);
	}

	@Get('accounts-list')
	@UseGuards(LoggedInGuard)
	@UseGuards(AdminGuard)
	async accountsList(@Req() req: Request, @Res() res: Response) {
		return this.dashboardService.accountsList(req, res);
	}

	@Get('create-account')
	@UseGuards(LoggedInGuard)
	@UseGuards(AdminGuard)
	async createAccount(@Req() req: Request, @Res() res: Response) {
		return this.dashboardService.createAccount(req, res);
	}

	@Get('create-election')
	@UseGuards(LoggedInGuard)
	@UseGuards(AdminGuard)
	async createElection(@Req() req: Request, @Res() res: Response) {
		return this.dashboardService.createElection(req, res);
	}

	@Get('alliance-election/:electionId')
	@UseGuards(LoggedInGuard)
	@UseGuards(AdminGuard)
	async allianceElection(
		@Req() req: Request, 
		@Res() res: Response, 
		@Param('electionId') electionId: string
	) {
		return this.dashboardService.getAllianceElectionData(electionId, req, res);
	}

	@Get('dashboard')
	@UseGuards(LoggedInGuard)
	@UseGuards(AdminGuard)
	async dashboard(@Req() req: Request, @Res() res: Response) {
		return this.dashboardService.getDashboardData(req, res);
	}

	@Get('alliances')
	@UseGuards(LoggedInGuard)
	@UseGuards(AdminGuard)
	async alliances(@Req() req: Request, @Res() res: Response) {
		return this.dashboardService.getAlliancesData(req, res);
	}

	@Get('edit-alliance/:id')
	async editAlliance(
		@Req() req: Request, 
		@Res() res: Response, 
		@Param('id') id: string
	) {
		return this.dashboardService.getEditAllianceData(req, res, id);
	}

	@Get('create-alliance')
	@UseGuards(LoggedInGuard)
	@UseGuards(AdminGuard)
	async createAlliance(@Req() req: Request, @Res() res: Response) {
		return this.dashboardService.getCreateAllianceData(req, res);
	}

	@Get('temp-create-election')
	@UseGuards(LoggedInGuard)
	@UseGuards(AdminGuard)
	async tempCreateElection(@Req() req: Request, @Res() res: Response) {
		return this.dashboardService.getTempCreateElectionData(req, res);
	}

	@Get('temp-edit-election/:id')
	@UseGuards(LoggedInGuard)
	@UseGuards(UserGuard)
	async tempEditElection(
		@Req () req: Request, 
		@Res() res: Response, 
		@Next() next: NextFunction, 
		@Param('id') id: string
	) {
		return this.dashboardService.getTempEditElectionData(req, res, next, id);
	}

	@Get('temp-election-list')
	@UseGuards(LoggedInGuard)
	@UseGuards(UserGuard)
	async tempElectionList(@Req() req: Request, @Res() res: Response) {
		return this.dashboardService.getTempElectionListData(req, res);
	}

	@Get('parties')
	@UseGuards(LoggedInGuard)
	@UseGuards(AdminGuard)
	async parties(@Req() req: Request, @Res() res: Response) {
		return this.dashboardService.getPartiesData(req, res);
	}

	@Get('create-party')
	@UseGuards(LoggedInGuard)
	@UseGuards(AdminGuard)
	async createParty(@Req() req: Request, @Res() res: Response) {
		return this.dashboardService.getCreatePartyData(req, res);
	}

	@Get('edit-party/:id')
	@UseGuards(LoggedInGuard)
	@UseGuards(AdminGuard)
	async editParty(
		@Req() req: Request, 
		@Res() res: Response, 
		@Next() next: NextFunction, 
		@Param('id') id: string
	) {
		return this.dashboardService.getEditPartyData(req, res, next, id);
	}

	@Get('constituency')
	@UseGuards(LoggedInGuard)
	@UseGuards(AdminGuard)
	async constituency(@Req() req: Request, @Res() res: Response) {
		return this.dashboardService.getConstituencyData(req, res);
	}

	@Get('create-constituency')
	@UseGuards(LoggedInGuard)
	@UseGuards(AdminGuard)
	async createConstituency(@Req() req: Request, @Res() res: Response) {
		return this.dashboardService.getCreateConstituencyData(req, res);
	}

	@Get('edit-constituency/:id')
	@UseGuards(LoggedInGuard)
	@UseGuards(AdminGuard)
	async editConstituency(
		@Req() req: Request, 
		@Res() res: Response, 
		@Param('id') id: string
	) {
		return this.dashboardService.getEditConstituencyData(req, res, id);
	}

	@Get('candidates')
	@UseGuards(LoggedInGuard)
	@UseGuards(AdminGuard)
	async candidates(@Req() req: Request, @Res() res: Response) {
		return this.dashboardService.getCandidatesData(req, res);
	}

	@Get('create-candidate')
	@UseGuards(LoggedInGuard)
	@UseGuards(AdminGuard)
	async createCandidate(@Req() req: Request, @Res() res: Response) {
		return this.dashboardService.getCreateCandidateData(req, res);
	}

	@Get('edit-candidate/:id')
	@UseGuards(LoggedInGuard)
	@UseGuards(AdminGuard)
	async editCandidate(
		@Req() req: Request, 
		@Res() res: Response, 
		@Param('id') id: string
	) {
		return this.dashboardService.getEditCandidateData(req, res, id);
	}

	@Get('create-assembly-election')
	@UseGuards(LoggedInGuard)
	@UseGuards(AdminGuard)
	async createAssemblyElection(@Req() req: Request, @Res() res: Response) {
		return this.dashboardService.getCreateAssemblyElectionData(req, res);
	}

	@Get('edit-assembly-election/:id')
	@UseGuards(LoggedInGuard)
	@UseGuards(AdminGuard)
	async editAssemblyElection(
		@Req() req: Request, 
		@Res() res: Response, 
		@Param('id') id: string
	) {
		return this.dashboardService.getEditAssemblyElectionData(req, res, id);
	}

	@Get('assembly-election')
	@UseGuards(LoggedInGuard)
	@UseGuards(AdminGuard)
	async assemblyElection(@Req() req: Request, @Res() res: Response) {
		return this.dashboardService.getAssemblyElectionData(req, res);
	}

	@Get('cons-candidates')
	@UseGuards(LoggedInGuard)
	@UseGuards(AdminGuard)
	async consCandidates(@Req() req: Request, @Res() res: Response) {
		return this.dashboardService.getConsCandidatesData(req, res);
	}

	@Get('election-chatbot')
	// @UseGuards(LoggedInGuard)
	async electionChatbot(@Req() req: Request, @Res() res: Response) {
		return this.dashboardService.getElectionChatbotData(req, res);
	}
}
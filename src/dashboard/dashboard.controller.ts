import { Controller, Get, Query, Res, Req, HttpStatus, Param, Next, Render } from "@nestjs/common";
import { Response, Request } from "express";
import { InjectModel } from "@nestjs/mongoose";
import { Model, PipelineStage } from "mongoose";
import { InjectRedis } from "@nestjs-modules/ioredis";
import Redis from "ioredis";
import { ElectionCandidateSchema } from "../schemas/candidate-election.schema";
import { TempElectionSchema } from "../schemas/temp-election.schema";
import { ElectionPartyResultSchema } from "../schemas/party-election.schema";
import { ElectionSchema } from "../schemas/election.schema";

@Controller()
export class DashBoardController {
	constructor(
		@InjectModel("ElectionCandidate")
		private electionCandidateModel: Model<typeof ElectionCandidateSchema>,
		@InjectModel("ElectionPartyResult")
		private partyElectionModel: Model<typeof ElectionPartyResultSchema>,
		@InjectModel("TempElection")
		private tempElectionModel: Model<typeof TempElectionSchema>,
		@InjectModel("Election")
		private electionModel: Model<typeof ElectionSchema>,
		@InjectRedis() private readonly redis: Redis,
	) {}

        @Get()
        afterLogin(
            @Req() req: Request & { session: { user?: any } },
            @Res() res: Response
        ){
            if (!req.session.user) {
                return res.redirect("/login");
            }
            res.redirect("/temp-election-list");
        }

        @Get('edit-election/:id')
        @Render('edit-election')
        async editElection(
            @Req() req: Request & { session: { user?: any } },
            @Param('id') id: string
        ) {
            try {
                const electionId = id;
                console.log(electionId);
                const election = await this.electionModel.findById(electionId);
                console.log(election);
                if (!election) {
                    throw new Error("Election not found");
                }
                return { election, user: req.session.user };
            } catch (error) {
                console.error('Error in editElection:', error);
                throw error;
            }
        }

        @Get('login')
        loginPage(
            @Req() req: Request & { session: { user?: any } },
            @Res() res: Response
        ) {
            if (req.session.user) {
                return res.redirect('/temp-election-list');
            }
            return res.render('login');
        }

}

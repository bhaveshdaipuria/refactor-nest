import { Controller, Get, Req, Res } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Request, Response } from "express";
import { Model } from "mongoose";
import { ElectionCandidateSchema } from "src/schemas/candidate-election.schema";
import { candidateSchema } from "src/schemas/candidates.schema";
import { ConstituencyElectionSchema } from "src/schemas/constituency-election.schema";
import { constituencySchema } from "src/schemas/constituency.schema";
import { ElectionSchema } from "src/schemas/election.schema";
import { partySchema } from "src/schemas/party.schema";
import { TempElectionSchema } from "src/schemas/temp-election.schema";

@Controller("api/election")
export class ElectionController {
  constructor(
    @InjectModel("TempElection")
    private tempElectionModel: Model<typeof TempElectionSchema>,
    @InjectModel("Election")
    private electionModel: Model<typeof ElectionSchema>,
    @InjectModel("Constituency")
    private constituencyModel: Model<typeof constituencySchema>,
    @InjectModel("ElectionConstituency")
    private electionConstituencyModel: Model<typeof ConstituencyElectionSchema>,
    @InjectModel("Candidate")
    private candidateModel: Model<typeof candidateSchema>,
    @InjectModel("ElectionCandidate")
    private electionCandidateModel: Model<typeof ElectionCandidateSchema>,
    @InjectModel("Party")
    private PartyModel: Model<typeof partySchema>,
  ) {}

  @Get("party-summary")
  async getElectionPartySummary(@Req() req: Request, @Res() res: Response) {
    const fullUrl = req.get("Referer");
    console.log("fullUrl -> ", fullUrl);

    const stateName = { delhi: "दिल्ली 2025", jharkhand: "झारखंड 2024" };

    const state = fullUrl?.includes("delhi")
      ? stateName["delhi"]
      : stateName["jharkhand"];
    try {
      const election: any = await this.electionModel.findOne({
        state: state,
      });

      if (!election) {
        return res.status(404).json({ error: "Election not found" });
      }

      // Filter for BJP+ and JMM+ parties
      // const filteredParties = election.parties.filter(party =>
      //   party.name === 'BJP+' || party.name === 'JMM+'
      // );

      res.status(200).json({
        state: election.state,
        totalSeats: election.totalSeats,
        declaredSeats: election.declaredSeats,
        parties: election.parties,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  }
}

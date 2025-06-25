import { InjectRedis } from "@nestjs-modules/ioredis";
import { Controller, Delete, Get, Post, Put, Req, Res } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Request, Response } from "express";
import Redis from "ioredis";
import { Model } from "mongoose";
import { electionSchema } from "src/schemas/assembly-election.schema";
import { candidateSchema } from "src/schemas/candidates.schema";
import { cachedKeys } from "src/utils";
import { RedisManager } from "../config/redis.manager";

@Controller("api/assembly-election")
export class AssemblyElectionController {
  constructor(
    @InjectModel("AssemblyElection")
    private assemblyElectionModel: Model<typeof electionSchema>,
    @InjectModel("Candidate")
    private candidateModel: Model<typeof candidateSchema>,
    private readonly redisManager: RedisManager,
  ) {}

  @Post()
  async createAssemblyElection(@Res() res: Response, @Req() req: Request) {
    try {
      const election = await this.assemblyElectionModel.insertOne(req.body);

      await this.redisManager.clearAllKeys();

      return res.status(201).redirect("/assembly-election");
    } catch (error) {
      console.error(error);
      res.status(500).send("Server Error");
    }
  }

  @Get()
  async getAllAssemblyElection(@Res() res: Response, @Req() req: Request) {
    try {
      // Fetch from cache if available
      const cachedData = await this.redisManager.get(cachedKeys.ASSEMBLY_ELECTION);
      if (cachedData) {
        return res.json(cachedData);
      }

      // Clear cache after 5 minutes
      // Fetch from DB if no cache
      const elections = await this.assemblyElectionModel
        .find()
        .populate("constituencies");
      await this.redisManager.setWithTTL(
        cachedKeys.ASSEMBLY_ELECTION,
        JSON.stringify(elections),
        3600
      ); // Cache for 5 minutes

      res.json(elections);
    } catch (error) {
      console.error(error);
      res.status(500).send("Server Error");
    }
  }

  @Get(":id")
  async getAssemblyElectionById(@Res() res: Response, @Req() req: Request) {
    try {
      const cachedData = await this.redisManager.get(
        cachedKeys.ASSEMBLY_ELECTION + ":" + req.params.id,
      );
      if (cachedData) {
        return res.json(cachedData);
      }

      const election = await this.assemblyElectionModel
        .findById(req.params.id)
        .populate("constituencies");
      if (!election) return res.status(404).send("Election not found");
      await this.redisManager.setWithTTL(
        cachedKeys.ASSEMBLY_ELECTION + ":" + req.params.id,
        JSON.stringify(election),
        3600
      ); // Cache the result
      res.json(election);
    } catch (error) {
      console.error(error);
      res.status(500).send("Server Error");
    }
  }

  @Put(":id")
  async updateAssemblyElectionById(@Res() res: Response, @Req() req: Request) {
    try {
      const election = await this.assemblyElectionModel.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true },
      );
      if (!election) return res.status(404).send("Election not found");

      await this.redisManager.clearAllKeys();
      res.json(election);
    } catch (error) {
      console.error(error);
      res.status(500).send("Server Error");
    }
  }

  @Delete(":id")
  async deleteAssemblyElectionById(@Res() res: Response, @Req() req: Request) {
    try {
      const election = await this.assemblyElectionModel.findByIdAndDelete(
        req.params.id,
      );
      if (!election) return res.status(404).send("Election not found");

      await this.redisManager.clearAllKeys();

      res.json({ message: "Election deleted successfully" });
    } catch (error) {
      console.error(error);
      res.status(500).send("Server Error");
    }
  }

  @Get("state/:name")
  async getStateAssemblyElection(@Res() res: Response, @Req() req: Request) {
    try {
      const stateName = req.params.name;

      const cachedData = await this.redisManager.get(
        cachedKeys.ASSEMBLY_ELECTION + `:${stateName}`,
      );

      if (cachedData) {
        return res.json(cachedData);
      }

      // Fetch the elections with full population of nested documents
      const elections: any = await this.assemblyElectionModel
        .findOne({
          state: stateName,
        })
        .populate({
          path: "constituencies",
          populate: {
            path: "candidates",
            model: "Candidate",
            populate: {
              path: "party",
              model: "Party",
            },
          },
        });

      if (!elections)
        return res.status(404).send("No elections found in this state");

      // Process each constituency to determine leading and trailing candidates
      const constituencies = await Promise.all(
        elections.constituencies.map(async (constituency) => {
          // Fetch sorted candidates for the constituency
          const cands = await this.candidateModel
            .find({ constituency: constituency._id })
            .sort({ totalVotes: -1 }) // Sort by total votes in descending order
            .populate("party");

          const highestVoteCandidate: any = cands[0]; // Leading candidate (highest votes)
          const lowestVoteCandidate: any = cands[1]; // Trailing candidate (lowest votes)

          const leadingPartyColor = highestVoteCandidate
            ? highestVoteCandidate.party.color_code
            : null;
          const trailingPartyColor = lowestVoteCandidate
            ? lowestVoteCandidate.party.color_code
            : null;

          // Construct the constituency object with leading and trailing candidates
          return {
            _id: constituency._id,
            name: constituency.name,
            state: constituency.state,
            won: constituency.won || "awaiting",
            totalVotes: constituency.totalVotes,
            color:
              highestVoteCandidate && highestVoteCandidate.totalVotes > 0
                ? leadingPartyColor
                : "#C0C0C0",
            leadingCandidate: highestVoteCandidate
              ? {
                  _id: highestVoteCandidate._id,
                  name: highestVoteCandidate.name,
                  totalVotes: highestVoteCandidate.totalVotes,
                  party: {
                    _id: highestVoteCandidate.party._id,
                    party: highestVoteCandidate.party.party,
                    color_code: leadingPartyColor,
                    party_logo: highestVoteCandidate.party.party_logo,
                  },
                }
              : null,
            trailingCandidate: lowestVoteCandidate
              ? {
                  _id: lowestVoteCandidate._id,
                  name: lowestVoteCandidate.name,
                  totalVotes: lowestVoteCandidate.totalVotes,
                  party: {
                    _id: lowestVoteCandidate.party._id,
                    party: lowestVoteCandidate.party.party,
                    color_code: trailingPartyColor,
                    party_logo: lowestVoteCandidate.party.party_logo,
                  },
                }
              : null,
          };
        }),
      );

      // Send the response with structured data

      await this.redisManager.setWithTTL(
        cachedKeys.ASSEMBLY_ELECTION + `:${stateName}`,
        { elections: constituencies },
        3600
      );

      res.json({
        state: elections.state,
        year: elections.year,
        total_seat: elections.total_seat,
        total_votes: elections.total_votes,
        total_candidate: elections.total_candidate,
        constituency: constituencies,
      });
    } catch (error) {
      console.error(error);
      res.status(500).send("Server Error");
    }
  }
}

import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { electionSchema } from "src/schemas/assembly-election.schema";
import { candidateSchema } from "src/schemas/candidates.schema";
import { RedisManager } from "../config/redis.manager";
import { cachedKeys } from "src/utils";

@Injectable()
export class AssemblyElectionService {
  constructor(
    @InjectModel("AssemblyElection")
    private assemblyElectionModel: Model<typeof electionSchema>,
    @InjectModel("Candidate")
    private candidateModel: Model<typeof candidateSchema>,
    private readonly redisManager: RedisManager,
  ) {}

  async createElection(data: any) {
    const election = await this.assemblyElectionModel.insertOne(data);
    await this.redisManager.clearAllKeys();
    return election;
  }

  async getAllElections() {
    const cachedData = await this.redisManager.get(cachedKeys.ASSEMBLY_ELECTION);
    if (cachedData) return cachedData;

    const elections = await this.assemblyElectionModel
      .find()
      .populate("constituencies");

    await this.redisManager.setWithTTL(
      cachedKeys.ASSEMBLY_ELECTION,
      JSON.stringify(elections),
      3600,
    );
    return elections;
  }

  async getElectionById(id: string) {
    const cachedData = await this.redisManager.get(
      cachedKeys.ASSEMBLY_ELECTION + ":" + id,
    );
    if (cachedData) return cachedData;

    const election = await this.assemblyElectionModel
      .findById(id)
      .populate("constituencies");

    if (!election) throw new NotFoundException("Election not found");

    await this.redisManager.setWithTTL(
      cachedKeys.ASSEMBLY_ELECTION + ":" + id,
      JSON.stringify(election),
      3600,
    );

    return election;
  }

  async updateElection(id: string, data: any) {
    const election = await this.assemblyElectionModel.findByIdAndUpdate(id, data, {
      new: true,
    });

    if (!election) throw new NotFoundException("Election not found");

    await this.redisManager.clearAllKeys();
    return election;
  }

  async deleteElection(id: string) {
    const election = await this.assemblyElectionModel.findByIdAndDelete(id);
    if (!election) throw new NotFoundException("Election not found");

    await this.redisManager.clearAllKeys();
    return { message: "Election deleted successfully" };
  }

  async getStateElection(stateName: string) {
    const cachedData = await this.redisManager.get(
      cachedKeys.ASSEMBLY_ELECTION + `:${stateName}`,
    );
    if (cachedData) return cachedData;

    const elections: any = await this.assemblyElectionModel
      .findOne({ state: stateName })
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

    if (!elections) throw new NotFoundException("No elections found in this state");

    const constituencies = await Promise.all(
      elections.constituencies.map(async (constituency) => {
        const cands = await this.candidateModel
          .find({ constituency: constituency._id })
          .sort({ totalVotes: -1 })
          .populate("party");

        const highestVoteCandidate: any = cands[0];
        const lowestVoteCandidate: any = cands[1];

        const leadingPartyColor = highestVoteCandidate
          ? highestVoteCandidate.party.color_code
          : null;
        const trailingPartyColor = lowestVoteCandidate
          ? lowestVoteCandidate.party.color_code
          : null;

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

    const response = {
      state: elections.state,
      year: elections.year,
      total_seat: elections.total_seat,
      total_votes: elections.total_votes,
      total_candidate: elections.total_candidate,
      constituency: constituencies,
    };

    await this.redisManager.setWithTTL(
      cachedKeys.ASSEMBLY_ELECTION + `:${stateName}`,
      response,
      3600,
    );

    return response;
  }
}

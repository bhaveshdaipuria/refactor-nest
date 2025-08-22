import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { candidateSchema } from "src/schemas/candidates.schema";
import { ConstituencyElectionSchema } from "src/schemas/constituency-election.schema";
import { constituencySchema } from "src/schemas/constituency.schema";
import { TempElectionSchema } from "src/schemas/temp-election.schema";
import { RedisManager } from "../config/redis.manager";
import { Request } from "express";

@Injectable()
export class ConstituencyService {
  constructor(
    @InjectModel("TempElection")
    private tempElectionModel: Model<typeof TempElectionSchema>,
    @InjectModel("Constituency")
    private constituencyModel: Model<typeof constituencySchema>,
    @InjectModel("ElectionConstituency")
    private electionConstituencyModel: Model<typeof ConstituencyElectionSchema>,
    @InjectModel("Candidate")
    private candidateModel: Model<typeof candidateSchema>,
    private readonly redisManager: RedisManager,
  ) {}

  async createConstituency(req: Request) {
    const existingConstituency = await this.constituencyModel.findOne({
      name: req.body.name,
      state: req.body.state,
    });
    if (existingConstituency) throw new BadRequestException("Constituency already exists");

    const constituency = await this.constituencyModel.create(req.body);

    if (req.body.candidates) {
      for (let candidate of req.body.candidates) {
        await this.candidateModel.findByIdAndUpdate(
          candidate,
          { constituency: constituency._id },
          { new: true },
        ).exec();
      }
    }

    await this.redisManager.clearAllKeys();
    return constituency;
  }

  async getAllConstituencies(state?: string, year?: string) {
    if (!state || !year) {
      throw new BadRequestException("State and year are required query parameters");
    }

    const key = `widget_cn_election_constituencies_${state}_${year}`;
    const cachedResult = await this.redisManager.get(key);
    if (cachedResult) return JSON.parse(cachedResult);

    const election = await this.tempElectionModel.findOne({ state, year }).lean();
    if (!election) throw new NotFoundException("Election not found");

    const constituencies = await this.electionConstituencyModel
      .find({ election: election._id })
      .populate({ path: "constituency", select: "-candidates" })
      .lean()
      .then((results: any) => results.map((result) => result.constituency));

    await this.redisManager.set(key, JSON.stringify(constituencies));
    return constituencies;
  }

  async getConstituencyById(id: string) {
    const constituency = await this.constituencyModel.findById(id).populate("candidates");
    if (!constituency) throw new NotFoundException("Constituency not found");
    return constituency;
  }

  async updateConstituencyById(id: string, req: Request) {
    const existingConstituency = await this.constituencyModel.findById(id).populate("candidates");
    if (!existingConstituency) throw new NotFoundException("Constituency not found");

    // TODO: If candidate cleanup is needed, uncomment the logic here
    const updatedConstituency = await this.constituencyModel.findByIdAndUpdate(id, req.body, { new: true });

    await this.redisManager.clearAllKeys();
    return updatedConstituency;
  }

  async deleteConstituencyById(id: string) {
    const constituency = await this.constituencyModel.findByIdAndDelete(id);
    if (!constituency) throw new NotFoundException("Constituency not found");

    await this.redisManager.clearAllKeys();
    return { message: "Constituency deleted successfully" };
  }
}

import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { partySchema } from "src/schemas/party.schema";
import { constituencySchema } from "src/schemas/constituency.schema";
import { candidateSchema } from "src/schemas/candidates.schema";
import { RedisManager } from "../config/redis.manager";
import { cachedKeys, getFullImagePath } from "src/utils";
import { Request } from "express";

@Injectable()
export class PartyService {
  constructor(
    @InjectModel("Party") private readonly partyModel: Model<typeof partySchema>,
    @InjectModel("Constituency") private readonly constituencyModel: Model<typeof constituencySchema>,
    @InjectModel("Candidate") private readonly candidateModel: Model<typeof candidateSchema>,
    private readonly redisManager: RedisManager,
  ) {}

  async getTopParties(fullUrl?: string) {
    const AllStateParties = {
      delhi: [
        "67a217ceaede35a3487141b8",
        "67a217e1aede35a3487141bc",
        "67a217f2aede35a3487141c0",
        "67a21803aede35a3487141c6",
      ],
      jharkhand: [
        "673b16b4568e8acfd1213d6f",
        "673b16b4568e8acfd1213d73",
        "673b16b4568e8acfd1213d86",
        "673b16b4568e8acfd1213d83",
        "673b16b4568e8acfd1213d77",
      ],
    };

    const state = fullUrl?.includes("delhi") ? "delhi" : "jharkhand";
    const partyIds = AllStateParties[state];

    const topParties = await this.partyModel.aggregate([
      {
        $match: {
          _id: { $in: partyIds.map((id) => new Types.ObjectId(id)) },
        },
      },
      {
        $addFields: {
          sortIndex: {
            $indexOfArray: [partyIds.map((id) => new Types.ObjectId(id)), "$_id"],
          },
        },
      },
      { $sort: { sortIndex: 1 } },
    ]);

    return [
      ...topParties,
      {
        _id: new Types.ObjectId(),
        party: "Others",
        color_code: "#2F05FF",
        total_votes: 0,
        total_seat: 0,
        party_logo: null,
        votes_percentage: 0,
      },
    ];
  }

  async getPartiesSummaries(req: Request) {
    const parties: any = await this.partyModel
      .find({ party: { $in: ["BJP+", "JMM+", "बीजेपी+", "जेएमएम+"] } })
      .sort({ createdAt: -1 });

    const partiesList = parties.map((party) => ({
      party: party.party,
      color_code: party.color_code,
      total_votes: party.total_votes,
      total_seat: party.total_seat,
      party_logo: party.party_logo
        ? getFullImagePath(req, "party_logos/" + party.party_logo)
        : null,
    }));

    const totalSeats = await this.constituencyModel.countDocuments();

    return { totalSeats, partiesList };
  }

  async getPartyCount() {
    return this.candidateModel.aggregate([
      { $unwind: "$constituency" },
      {
        $group: {
          _id: "$constituency",
          maxVotes: { $max: "$totalVotes" },
        },
      },
      {
        $lookup: {
          from: "candidates",
          localField: "_id",
          foreignField: "constituency",
          as: "candidates",
        },
      },
      { $unwind: "$candidates" },
      {
        $match: {
          $expr: { $eq: ["$candidates.totalVotes", "$maxVotes"] },
        },
      },
      {
        $lookup: {
          from: "parties",
          localField: "candidates.party",
          foreignField: "_id",
          as: "partyDetails",
        },
      },
      { $unwind: "$partyDetails" },
      {
        $group: {
          _id: "$partyDetails.party",
          constituenciesWon: { $addToSet: "$_id" },
        },
      },
      {
        $project: {
          party: "$_id",
          constituencyCount: { $size: "$constituenciesWon" },
        },
      },
      { $sort: { constituencyCount: -1 } },
    ]);
  }

  async createParty(req: Request) {
    const partyData: any = {
      party: req.body.party,
      color_code: req.body.color_code,
      total_seat: req.body.total_seat,
      total_votes: req.body.total_votes,
      electors: req.body.electors,
      votes_percentage: req.body.votes_percentage,
    };

    if (req.file) {
      partyData.party_logo = getFullImagePath(req, "party_logos");
    }

    const existingParty = await this.partyModel.findOne({ party: partyData.party });
    if (existingParty) throw new BadRequestException("Party already exists");

    await this.partyModel.create(partyData);
    await this.redisManager.clearAllKeys();

    return { redirect: "/parties" };
  }

  async getAllParties() {
    const cachedData = await this.redisManager.get(cachedKeys.PARTY);
    if (cachedData) return JSON.parse(cachedData);

    const parties = await this.partyModel.find();
    await this.redisManager.set(cachedKeys.PARTY, JSON.stringify(parties));

    return parties;
  }

  async getPartyById(partyId: string) {
    const cachedData = await this.redisManager.get(cachedKeys.PARTY + ":" + partyId);
    if (cachedData) return JSON.parse(cachedData);

    const party = await this.partyModel.findById(partyId);
    if (!party) throw new NotFoundException("Party not found");

    await this.redisManager.set(cachedKeys.PARTY + ":" + partyId, JSON.stringify(party));
    return party;
  }

  async updatePartyById(req: Request) {
    const partyData: any = {
      party: req.body.party,
      color_code: req.body.color_code,
    };

    if (req.file) {
      partyData.party_logo = getFullImagePath(req, "party_logos");
    }

    const party = await this.partyModel.findByIdAndUpdate(req.params.id, partyData, { new: true });
    if (!party) throw new NotFoundException("Party not found");

    await this.redisManager.clearAllKeys();
    return party;
  }

  async deletePartyById(partyId: string) {
    const party = await this.partyModel.findByIdAndDelete(partyId);
    if (!party) throw new NotFoundException("Party not found");

    await this.redisManager.clearAllKeys();
    return { message: "Deleted party" };
  }
}

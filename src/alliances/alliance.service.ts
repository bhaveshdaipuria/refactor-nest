import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { allianceSchema } from "src/schemas/alliance.schema";
import { TempElectionSchema } from "src/schemas/temp-election.schema";
import { getFullImagePath } from "src/utils";
import { Request } from "express";

@Injectable()
export class AllianceService {
  constructor(
    @InjectModel("Alliance")
    private allianceModel: Model<typeof allianceSchema>,
    @InjectModel("TempElection")
    private tempElectionModel: Model<typeof TempElectionSchema>,
  ) {}

  async getElectionParties(electionId: string) {
    return this.tempElectionModel.aggregate([
      { $match: { _id: new Types.ObjectId(electionId) } },
      {
        $lookup: {
          from: "alliances",
          localField: "_id",
          foreignField: "election",
          as: "alliances",
        },
      },
      {
        $project: {
          allAllianceParties: {
            $reduce: {
              input: "$alliances.parties",
              initialValue: [],
              in: { $concatArrays: ["$$value", "$$this"] },
            },
          },
          electionParties: "$electionInfo.partyIds",
        },
      },
      { $unwind: { path: "$electionParties", preserveNullAndEmptyArrays: true } },
      {
        $match: {
          $expr: {
            $not: { $in: ["$electionParties", "$allAllianceParties"] },
          },
        },
      },
      {
        $lookup: {
          from: "parties",
          localField: "electionParties",
          foreignField: "_id",
          as: "partyDetails",
        },
      },
      { $unwind: "$partyDetails" },
      {
        $project: {
          _id: "$partyDetails._id",
          party: "$partyDetails.party",
          color_code: "$partyDetails.color_code",
          party_logo: "$partyDetails.party_logo",
          total_seat: "$partyDetails.total_seat",
          total_votes: "$partyDetails.total_votes",
          electors: "$partyDetails.electors",
          votes_percentage: "$partyDetails.votes_percentage",
        },
      },
    ]);
  }

  async createAlliance(req: Request, body: any) {
    const { allianceName, leaderParty, parties, election } = body;

    if (!parties.includes(leaderParty)) {
      throw new Error("Leader Party must be one of the selected Parties.");
    }

    return this.allianceModel.create({
      name: allianceName,
      leaderParty,
      parties,
      logo: getFullImagePath(req, "alliance_logos"),
      election,
    });
  }

  async deleteAllianceById(id: string) {
    return this.allianceModel.findByIdAndDelete(id);
  }

  async updateAllianceById(req: Request, id: string, body: any) {
    const { allianceName, leaderParty, parties, logo } = body;
    const allianceData: any = {
      name: allianceName,
      leaderParty,
      parties,
      logo,
    };

    if (req.file) {
      allianceData.logo = getFullImagePath(req, "alliance_logos");
    }

    return this.allianceModel.findByIdAndUpdate(id, allianceData, {
      new: true,
    });
  }
}

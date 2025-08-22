import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, PipelineStage } from "mongoose";
import { RedisManager } from "../config/redis.manager";
import { ElectionCandidateSchema } from "../schemas/candidate-election.schema";
import { TempElectionSchema } from "../schemas/temp-election.schema";
import { ElectionPartyResultSchema } from "../schemas/party-election.schema";

export interface HotCandidateQuery {
  year: string;
  party?: string;
  candidateName?: string;
}

export interface CandidatesListQuery {
  state: string;
  constituencyId?: string;
  year: string;
}

export interface HotCandidatesQuery {
  state: string;
  year: string;
}

export interface TopCandidatesQuery {
  state: string;
  year: string;
}

export interface CandidateDetailsQuery {
  electionId: string;
  userRole?: string;
  allowedConst?: string[];
}

@Injectable()
export class ElectionService {
  constructor(
    @InjectModel("ElectionCandidate")
    private electionCandidateModel: Model<typeof ElectionCandidateSchema>,
    @InjectModel("ElectionPartyResult")
    private partyElectionModel: Model<typeof ElectionPartyResultSchema>,
    @InjectModel("TempElection")
    private tempElectionModel: Model<typeof TempElectionSchema>,
    private readonly redisManager: RedisManager
  ) {}

  async getHotCandidateResult(query: HotCandidateQuery) {
    const { year, party, candidateName } = query;

    let key = `widget_bihar_hot_candidate_result_${year}`;
    if (party) key += `_${party}`;
    if (candidateName) key += `_${candidateName}`;

    const cachedResults = await this.redisManager.get(key);
    if (cachedResults) {
      return JSON.parse(cachedResults);
    }

    const aggregationPipeline: PipelineStage[] = [
      {
        $match: {
          status: "completed",
          year: parseInt(year),
        },
      },
      {
        $lookup: {
          from: "electioncandidates",
          localField: "_id",
          foreignField: "election",
          as: "candidates",
        },
      },
      { $unwind: "$candidates" },
      {
        $match: {
          "candidates.status": { $in: ["Won", "Lost"] },
        },
      },
      {
        $lookup: {
          from: "candidates",
          localField: "candidates.candidate",
          foreignField: "_id",
          as: "candidateDetails",
        },
      },
      { $unwind: "$candidateDetails" },
      {
        $lookup: {
          from: "parties",
          localField: "candidateDetails.party",
          foreignField: "_id",
          as: "partyDetails",
        },
      },
      { $unwind: "$partyDetails" },
      {
        $match: {
          "candidateDetails.hotCandidate": true,
        },
      },
      ...(party
        ? [
            {
              $match: {
                "partyDetails.party": party,
              },
            },
          ]
        : []),
      ...(candidateName
        ? [
            {
              $match: {
                "candidateDetails.name": {
                  $regex: candidateName,
                  $options: "i",
                },
              },
            },
          ]
        : []),
      {
        $project: {
          _id: 0,
          name: "$candidateDetails.name",
          candidateImage: "$candidateDetails.image",
          party: {
            name: "$partyDetails.party",
            color_code: "$partyDetails.color_code",
            logo: "$partyDetails.party_logo",
          },
          status: "$candidates.status",
        },
      },
      { $sort: { votesReceived: -1 } },
    ];

    const results = await this.tempElectionModel.aggregate(aggregationPipeline);

    if (!results || results.length === 0) {
      throw new NotFoundException("No hot candidates found matching the criteria");
    }

    const response = {
      success: true,
      data: results,
    };

    await this.redisManager.set(key, JSON.stringify(response));
    return response;
  }

  async getCandidatesList(query: CandidatesListQuery) {
    const { state, constituencyId, year } = query;

    const yearNum = parseInt(year);
    const constituencyIdNum = constituencyId ? parseInt(constituencyId) : null;

    const pipeline = [
      {
        $lookup: {
          from: "tempelections",
          let: { electionState: state, electionYear: yearNum },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$state", "$$electionState"] },
                    { $eq: ["$year", "$$electionYear"] },
                  ],
                },
              },
            },
          ],
          as: "election",
        },
      },
      { $unwind: "$election" },
      ...(constituencyIdNum
        ? [
            {
              $lookup: {
                from: "constituencies",
                let: { constId: constituencyIdNum, constState: state },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ["$constituencyId", "$$constId"] },
                          { $eq: ["$state", "$$constState"] },
                        ],
                      },
                    },
                  },
                ],
                as: "constituency",
              },
            },
            { $unwind: "$constituency" },
            {
              $match: {
                constituency: { $exists: true, $ne: null },
              },
            },
          ]
        : []),
      {
        $lookup: {
          from: "electioncandidates",
          let: {
            electionId: "$election._id",
            ...(constituencyIdNum
              ? { constituencyId: "$constituency._id" }
              : {}),
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$election", "$$electionId"] },
                    ...(constituencyIdNum
                      ? [{ $eq: ["$constituency", "$$constituencyId"] }]
                      : []),
                  ],
                },
              },
            },
            {
              $lookup: {
                from: "candidates",
                localField: "candidate",
                foreignField: "_id",
                as: "candidate",
              },
            },
            { $unwind: "$candidate" },
            {
              $lookup: {
                from: "parties",
                localField: "candidate.party",
                foreignField: "_id",
                as: "candidate.party",
              },
            },
            { $unwind: "$candidate.party" },
            ...(!constituencyIdNum
              ? [
                  {
                    $lookup: {
                      from: "constituencies",
                      localField: "constituency",
                      foreignField: "_id",
                      as: "constituency",
                    },
                  },
                  { $unwind: "$constituency" },
                ]
              : []),
          ],
          as: "candidates",
        },
      },
      {
        $project: {
          _id: 0,
          election: {
            id: "$election._id",
            state: "$election.state",
            year: "$election.year",
            type: "$election.electionType",
            totalSeats: "$election.totalSeats",
          },
          ...(constituencyIdNum
            ? {
                constituency: {
                  id: "$constituency._id",
                  name: "$constituency.name",
                  constituencyId: "$constituency.constituencyId",
                },
              }
            : {}),
          candidates: {
            $map: {
              input: "$candidates",
              as: "c",
              in: {
                candidate: {
                  id: "$$c.candidate._id",
                  name: "$$c.candidate.name",
                  party: {
                    id: "$$c.candidate.party._id",
                    name: "$$c.candidate.party.party",
                    logo: "$$c.candidate.party.party_logo",
                  },
                },
                ...(!constituencyIdNum
                  ? {
                      constituency: {
                        id: "$$c.constituency._id",
                        name: "$$c.constituency.name",
                        constituencyId: "$$c.constituency.constituencyId",
                      },
                    }
                  : {}),
                votesReceived: "$$c.votesReceived",
                status: "$$c.status",
              },
            },
          },
        },
      },
    ];

    const result = await this.tempElectionModel.aggregate(pipeline);

    if (result.length === 0) {
      throw new NotFoundException("No data found for the given parameters");
    }

    return {
      success: true,
      data: result[0],
    };
  }

  async getHotCandidates(query: HotCandidatesQuery) {
    const { state, year } = query;

    const key = `widget_bihar_hot_candidate_${state}_${year}`;
    const cachedResults = await this.redisManager.get(key);

    if (cachedResults) {
      return JSON.parse(cachedResults);
    }

    const result = await this.tempElectionModel.aggregate([
      { $match: { state: state, year: Number(year) } },
      {
        $lookup: {
          from: "candidates",
          let: { candidateIds: "$electionInfo.candidates" },
          pipeline: [
            {
              $match: {
                $expr: { $in: ["$_id", "$$candidateIds"] },
                hotCandidate: true,
              },
            },
            {
              $lookup: {
                from: "parties",
                localField: "party",
                foreignField: "_id",
                as: "party",
                pipeline: [
                  { $project: { party: 1, color_code: 1 } },
                ],
              },
            },
            {
              $lookup: {
                from: "constituencies",
                localField: "constituency",
                foreignField: "_id",
                as: "constituency",
                pipeline: [
                  { $project: { name: 1 } },
                ],
              },
            },
            {
              $project: {
                name: 1,
                image: 1,
                party: { $arrayElemAt: ["$party", 0] },
                constituency: { $arrayElemAt: ["$constituency", 0] },
              },
            },
          ],
          as: "hotCandidates",
        },
      },
      {
        $project: {
          _id: 0,
          hotCandidates: {
            name: 1,
            image: 1,
            "party.party": 1,
            "party.color_code": 1,
            "constituency.name": 1,
          },
        },
      },
    ]);

    if (!result.length) {
      throw new NotFoundException("Election not found");
    }

    const response = {
      success: true,
      data: result[0].hotCandidates,
    };

    await this.redisManager.set(key, JSON.stringify(response));
    return response;
  }

  async getTopCandidates(query: TopCandidatesQuery) {
    const { state, year } = query;

    const key = `widget_bihar_election_map_${state}_${year}`;
    const cachedResults = await this.redisManager.get(key);

    if (cachedResults) {
      return JSON.parse(cachedResults);
    }

    const election = (await this.tempElectionModel
      .findOne({
        state: state,
        year: parseInt(year),
      })
      .lean()) as any;

    if (!election) {
      throw new NotFoundException("Election not found");
    }

    const type = election.electionType;

    const allParties = await this.partyElectionModel.aggregate([
      { $match: { election: election._id } },
      {
        $lookup: {
          from: "parties",
          localField: "party",
          foreignField: "_id",
          as: "partyData",
        },
      },
      { $unwind: "$partyData" },
      {
        $project: {
          _id: 0,
          partyName: "$partyData.party",
          seatsWon: "$seatsWon",
          partyColor: "$partyData.color_code",
        },
      },
      { $sort: { seatsWon: -1 } },
    ]);

    const constituencies = await this.electionCandidateModel.aggregate([
      { $match: { election: election._id } },
      { $sort: { constituency: 1, votesReceived: -1 } },
      {
        $lookup: {
          from: "candidates",
          localField: "candidate",
          foreignField: "_id",
          as: "candidate",
        },
      },
      { $unwind: "$candidate" },
      {
        $lookup: {
          from: "parties",
          localField: "candidate.party",
          foreignField: "_id",
          as: "party",
        },
      },
      { $unwind: "$party" },
      {
        $lookup: {
          from: "constituencies",
          localField: "constituency",
          foreignField: "_id",
          as: "constituency",
        },
      },
      { $unwind: "$constituency" },
      {
        $group: {
          _id: "$constituency._id",
          constituencyName: { $first: "$constituency.name" },
          constituencyId: { $first: "$constituency.constituencyId" },
          candidates: {
            $push: {
              name: "$candidate.name",
              partyName: "$party.party",
              votesReceived: "$votesReceived",
              status: "$status",
              partyColor: "$party.color_code",
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          constituencyName: 1,
          constituencyId: 1,
          candidates: { $slice: ["$candidates", 2] },
        },
      },
    ]);

    const response = {
      success: true,
      data: {
        electionId: election._id,
        electionName: `${state} ${type} election ${year}`,
        totalSeats: election.totalSeats,
        halfWayMark: election.halfWayMark,
        constituencies: constituencies,
        parties: allParties,
      },
    };

    await this.redisManager.set(key, JSON.stringify(response));
    return response;
  }

  async getStateElections(state: string) {
    const cachedResults = await this.redisManager.get("widget_election_widget");

    if (cachedResults) {
      return cachedResults;
    }

    const results: any = await this.tempElectionModel.aggregate([
      { $match: { state } },
      { $sort: { year: 1 } },
      {
        $lookup: {
          from: "electionpartyresults",
          localField: "_id",
          foreignField: "election",
          as: "partyResults",
        },
      },
      { $unwind: { path: "$partyResults", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "parties",
          localField: "partyResults.party",
          foreignField: "_id",
          as: "partyResults.partyDetails",
        },
      },
      {
        $unwind: {
          path: "$partyResults.partyDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: "$_id",
          year: { $first: "$year" },
          state: { $first: "$state" },
          electionType: { $first: "$electionType" },
          totalSeats: { $first: "$totalSeats" },
          halfWayMark: { $first: "$halfWayMark" },
          status: { $first: "$status" },
          parties: {
            $push: {
              $cond: [
                { $ne: ["$partyResults", {}] },
                {
                  party: {
                    party: "$partyResults.partyDetails.party",
                    color_code: "$partyResults.partyDetails.color_code",
                    party_logo: "$partyResults.partyDetails.party_logo",
                  },
                  seatsWon: "$partyResults.seatsWon",
                },
                null,
              ],
            },
          },
        },
      },
      {
        $addFields: {
          parties: {
            $filter: {
              input: "$parties",
              as: "party",
              cond: { $ne: ["$$party", null] },
            },
          },
        },
      },
      {
        $addFields: {
          parties: {
            $sortArray: {
              input: "$parties",
              sortBy: { seatsWon: -1 },
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          year: 1,
          state: 1,
          electionType: 1,
          totalSeats: 1,
          halfWayMark: 1,
          status: 1,
          parties: 1,
        },
      },
    ]);

    if (!results || results.length === 0) {
      throw new NotFoundException("No elections found for the specified state");
    }

    await this.redisManager.set("widget_election_widget", results);
    return results;
  }

  async getElectionYears(state: string) {
    const key = `election_state_years:${state}`;
    const cachedResults = await this.redisManager.get(key);

    if (cachedResults) {
      return JSON.parse(cachedResults);
    }

    const result = await this.tempElectionModel.aggregate([
      {
        $match: {
          state: state,
        },
      },
      {
        $group: {
          _id: null,
          availableYears: { $addToSet: "$year" },
        },
      },
      {
        $project: {
          _id: 0,
          availableYears: {
            $sortArray: {
              input: "$availableYears",
              sortBy: -1,
            },
          },
        },
      },
    ]);

    if (result.length === 0 || result[0].availableYears.length === 0) {
      throw new NotFoundException("No election data found for the given state");
    }

    const response = {
      success: true,
      data: {
        state: state,
        availableYears: result[0].availableYears,
      },
    };

    await this.redisManager.set(key, JSON.stringify(response));
    return response;
  }

  async getCandidateDetails(query: CandidateDetailsQuery) {
    const { electionId, userRole, allowedConst } = query;
    const searchQuery: any = { electionId };

    if (userRole === 'user' && allowedConst?.length) {
      searchQuery.constituencyId = { $in: allowedConst };
    }

    return this.electionCandidateModel.find(searchQuery).exec();
  }
}
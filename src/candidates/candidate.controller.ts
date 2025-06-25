import {
  Controller,
  Get,
  Query,
  HttpException,
  HttpStatus,
  Put,
  UseInterceptors,
  Param,
  Body,
  UploadedFile,
  Req,
  Delete,
  Post,
  UseGuards,
  Res,
} from "@nestjs/common";

import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";

import { RedisManager } from "../config/redis.manager";
import { TempElectionSchema } from "src/schemas/temp-election.schema";

import { ElectionCandidateSchema } from "src/schemas/candidate-election.schema";
import { FileInterceptor } from "@nestjs/platform-express";
import { cachedKeys, getFullImagePath } from "src/utils";
import { constituencySchema } from "src/schemas/constituency.schema";
import { ConstituencyElectionSchema } from "src/schemas/constituency-election.schema";
import { candidateSchema } from "src/schemas/candidates.schema";
import { partySchema } from "src/schemas/party.schema";
import { AdminGuard } from "src/guards/admin.guard";
import { Response } from "express";

@Controller("api/candidate")
export class CandidateController {
  constructor(
    @InjectModel("TempElection")
    private tempElectionModel: Model<typeof TempElectionSchema>,
    @InjectModel("Constituency")
    private constituencyModel: Model<typeof constituencySchema>,
    @InjectModel("ElectionConstituency")
    private electionConstituencyModel: Model<typeof ConstituencyElectionSchema>,
    @InjectModel("ElectionCandidate")
    private electionCandidateModel: Model<typeof ElectionCandidateSchema>,
    @InjectModel("Candidate")
    private candidateModel: Model<typeof candidateSchema>,
    @InjectModel("Party") private partyModel: Model<typeof partySchema>,
    private readonly redisManager: RedisManager,
  ) {}

  @Get("hot-candidates")
  async getHotCandidates(@Res() res: Response) {
    try {
      const cachedData = await this.redisManager.get(cachedKeys.HOT_CANDIDATES);

      if (cachedData) {
        return res.json(cachedData);
      }

      // If not in cache, query the database
      const candidates: any = await this.candidateModel
        .find({ hotCandidate: true })
        .populate("party constituency")
        .sort({ totalVotes: -1 });

      const hotCandidates = await Promise.all(
        candidates.map(async (candidate) => {
          const constituencyId = candidate.constituency[0]?._id;

          if (constituencyId) {
            // Get all candidates in the same constituency, sorted by total votes
            const candidatesInConstituency = await this.candidateModel
              .find({
                constituency: { $eq: constituencyId },
              })
              .populate("constituency")
              .sort({ totalVotes: -1 });

            // Check if the current candidate is leading or trailing
            const isLeading = candidatesInConstituency[0]._id.equals(
              candidate._id,
            );

            return {
              ...candidate.toObject(),
              status: isLeading ? "leading" : "trailing",
            };
          } else {
            return {
              ...candidate.toObject(),
              status: "no constituency", // Handle missing constituency
            };
          }
        }),
      );

      // Cache the result for 1 hour
      // await this.redis.setWithTTL(cachedKeys.HOT_CANDIDATES, hotCandidates, 3600);
      // Send the result as a response
      res.json(hotCandidates);
    } catch (error) {
      console.error("Error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  @Get("cn-list")
  async getCandidateList(
    @Query("constituencyName") constituencyName: string,
    @Query("state") state: string,
    @Query("year") year: string,
  ) {
    if (!state || !year || !constituencyName) {
      throw new HttpException(
        "State, Year and constituencyName are required query parameters",
        HttpStatus.BAD_REQUEST,
      );
    }

    const key = `widget_cn_election_candidates_${constituencyName}_${state}_${year}`;
    const cachedResult = await this.redisManager.get(key);
    if (cachedResult) {
      return JSON.parse(cachedResult);
    }

    // Find the election to get its ID
    const election = await this.tempElectionModel
      .findOne({
        state: state,
        year: parseInt(year),
      })
      .lean()
      .exec();

    if (!election) {
      throw new HttpException("Election not found", HttpStatus.NOT_FOUND);
    }

    const constituency = await this.constituencyModel
      .findOne({
        name: constituencyName,
      })
      .exec();

    if (!constituency) {
      throw new HttpException("Constituency not found", HttpStatus.NOT_FOUND);
    }

    const electionConstituency: any = await this.electionConstituencyModel
      .findOne({
        election: election._id,
        constituency: constituency._id,
      })
      .exec();

    const candidates = await this.electionCandidateModel
      .find({
        election: election._id,
        constituency: constituency._id,
      })
      .populate({
        path: "candidate",
        populate: {
          path: "party",
          select: "party color_code",
        },
      })
      .lean()
      .exec()
      .then((results) =>
        results.map((result) => ({
          ...result,
          constituencyStatus: electionConstituency?.status || null,
        })),
      );

    await this.redisManager.set(key, JSON.stringify(candidates));

    return candidates;
  }

  @Post()
  @UseGuards(AdminGuard)
  @UseInterceptors(FileInterceptor("image"))
  async createCandidate(
    @Req() req: Request,
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const hotCandidate = body.hotCandidate === "true";

    const candidateData = {
      name: body.name,
      party: body.party,
      age: body.age,
      hotCandidate,
      gender: body.gender,
      image: file ? getFullImagePath(req, "candidates") : null,
      constituency: body.constituency,
    };
    // Create candidate
    const newCandidate = await this.candidateModel.create(candidateData);

    // Validate constituency exists
    const constituency: any = await this.constituencyModel.findById(
      candidateData.constituency,
    );
    if (!constituency) {
      throw new HttpException(
        "Invalid constituency ID",
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!newCandidate) {
      throw new HttpException(
        "could not create new Candidate",
        HttpStatus.BAD_REQUEST,
      );
    }

    // Update constituency
    constituency.candidates.push(new Types.ObjectId(newCandidate._id));
    await constituency.save();

    // Clear cache
    await this.redisManager.clearAllKeys();

    return newCandidate;
  }

  // Candidate Not Found
  @Put(":id")
  @UseGuards(AdminGuard) // Replaces isAdmin middleware
  @UseInterceptors(FileInterceptor("image")) // Handles file upload
  async updateCandidate(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    // Find existing candidate
    const existingCandidate: any = await this.candidateModel
      .findById(id)
      .exec();
    if (!existingCandidate) {
      throw new HttpException("Candidate not found", HttpStatus.NOT_FOUND);
    }

    // Prepare updates
    const candidateUpdates = {
      name: body.name,
      party: body.party,
      age: body.age,
      gender: body.gender,
      hotCandidate:
        body.hotCandidate ?? existingCandidate.hotCandidate ?? false,
      constituency: body.constituency ?? existingCandidate.constituency,
      image: file
        ? getFullImagePath(req, "candidates") // Adjust path as needed
        : (body.image ?? existingCandidate.image),
    };

    // Update candidate
    const updatedCandidate = await this.candidateModel
      .findByIdAndUpdate(id, candidateUpdates, { new: true })
      .exec();

    // Clear Redis cache
    await this.redisManager.clearAllKeys();

    return updatedCandidate;
  }

  // Candidate Not Found
  @Get(":id")
  async getCandidateById(@Param("id") id: string) {
    const candidate = await this.candidateModel.findById(id);

    if (!candidate) {
      throw new HttpException("Candidate not found", HttpStatus.NOT_FOUND);
    }

    return candidate;
  }

  @Get()
  async getCandidates(@Query("constituency") constituency?: string) {
    if (constituency) {
      // Check if the constituency list is cached

      const cachedData = await this.redisManager.get(
        `${cachedKeys.CANDIDATES}:${constituency}`,
      );
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      // If not cached, fetch from DB
      const constituencies: any = await this.constituencyModel
        .find({
          name: { $regex: constituency, $options: "i" },
        }) // Added case-insensitive search
        .populate({
          path: "candidates",
          model: "Candidate",
          populate: [
            {
              path: "party", // Populate party for each candidate
              model: "Party",
            },
            {
              path: "constituency", // Populate constituency for each candidate
              model: "Constituency",
            },
          ],
        });

      // Check if any constituencies were found
      if (constituencies.length === 0) {
        return { candidates: [] };
      }

      // Sort candidates by totalVotes in descending order
      const sortedCandidates = constituencies[0].candidates.sort(
        (a, b) => b.totalVotes - a.totalVotes,
      ); // Sort in descending order

      return sortedCandidates;
    }

    // If not cached, fetch from DB
    const candidates = await this.candidateModel
      .find()
      .populate("party constituency")
      .sort({ totalVotes: -1 }); // Sort by totalVotes in descending order

    return candidates;
  }

  @Delete(":id")
  @UseGuards(AdminGuard) // Admin authentication
  async deleteCandidate(@Param("id") id: string) {
    // Delete candidate and handle result
    const deletedCandidate = await this.candidateModel
      .findByIdAndDelete(id)
      .exec()
      .catch((error) => {
        console.error(error);
        throw new HttpException(
          "Database error while deleting candidate",
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      });
    if (!deletedCandidate) {
      throw new HttpException("Candidate not found", HttpStatus.NOT_FOUND);
    }

    // Clear Redis cache
    await this.redisManager.clearAllKeys();

    return {
      success: true,
      message: "Candidate deleted successfully",
      deletedId: deletedCandidate._id,
    };
  }
}

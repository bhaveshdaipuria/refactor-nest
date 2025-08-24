import {
  Injectable,
  HttpException,
  HttpStatus,
  UploadedFile,
  BadRequestException,
  InternalServerErrorException
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { RedisManager } from "../config/redis.manager";
import { TempElectionSchema } from "src/schemas/temp-election.schema";
import { constituencySchema } from "src/schemas/constituency.schema";
import { ConstituencyElectionSchema } from "src/schemas/constituency-election.schema";
import { ElectionCandidateSchema } from "src/schemas/candidate-election.schema";
import { candidateSchema } from "src/schemas/candidates.schema";
import { partySchema } from "src/schemas/party.schema";
import { cachedKeys, getFullImagePath } from "src/utils";
import { Request } from "express";
import xlsx from "xlsx";

@Injectable()
export class CandidateService {
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
  ) { }

  async getHotCandidates() {
    const cachedData = await this.redisManager.get(cachedKeys.HOT_CANDIDATES);
    if (cachedData) return cachedData;

    const candidates: any = await this.candidateModel
      .find({ hotCandidate: true })
      .populate("party constituency")
      .sort({ totalVotes: -1 });

    const hotCandidates = await Promise.all(
      candidates.map(async (candidate) => {
        const constituencyId = candidate.constituency[0]?._id;

        if (constituencyId) {
          const candidatesInConstituency = await this.candidateModel
            .find({ constituency: { $eq: constituencyId } })
            .populate("constituency")
            .sort({ totalVotes: -1 });

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
            status: "no constituency",
          };
        }
      }),
    );

    return hotCandidates;
  }

  async getCandidateList(constituencyName: string, state: string, year: string) {
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

    const election = await this.tempElectionModel.findOne({
      state,
      year: parseInt(year),
    });
    if (!election) throw new HttpException("Election not found", HttpStatus.NOT_FOUND);

    const constituency = await this.constituencyModel.findOne({ name: constituencyName });
    if (!constituency)
      throw new HttpException("Constituency not found", HttpStatus.NOT_FOUND);

    const electionConstituency: any = await this.electionConstituencyModel.findOne({
      election: election._id,
      constituency: constituency._id,
    });

    const candidates = await this.electionCandidateModel
      .find({
        election: election._id,
        constituency: constituency._id,
      })
      .populate({
        path: "candidate",
        populate: { path: "party", select: "party color_code" },
      })
      .lean();

    const mapped = candidates.map((result) => ({
      ...result,
      constituencyStatus: electionConstituency?.status || null,
    }));

    await this.redisManager.set(key, JSON.stringify(mapped));
    return mapped;
  }

  async createCandidate(req: Request, body: any, file?: Express.Multer.File) {
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

    const newCandidate = await this.candidateModel.create(candidateData);

    const constituency: any = await this.constituencyModel.findById(
      candidateData.constituency,
    );
    if (!constituency) {
      throw new HttpException("Invalid constituency ID", HttpStatus.BAD_REQUEST);
    }

    constituency.candidates.push(new Types.ObjectId(newCandidate._id));
    await constituency.save();

    await this.redisManager.clearAllKeys();
    return newCandidate;
  }

  async updateCandidate(req: Request, id: string, body: any, file?: Express.Multer.File) {
    const existingCandidate: any = await this.candidateModel.findById(id);
    if (!existingCandidate) {
      throw new HttpException("Candidate not found", HttpStatus.NOT_FOUND);
    }

    const candidateUpdates = {
      name: body.name,
      party: body.party,
      age: body.age,
      gender: body.gender,
      hotCandidate:
        body.hotCandidate ?? existingCandidate.hotCandidate ?? false,
      constituency: body.constituency ?? existingCandidate.constituency,
      image: file
        ? getFullImagePath(req, "candidates")
        : body.image ?? existingCandidate.image,
    };

    const updatedCandidate = await this.candidateModel.findByIdAndUpdate(
      id,
      candidateUpdates,
      { new: true },
    );

    await this.redisManager.clearAllKeys();
    return updatedCandidate;
  }

  async getCandidateById(id: string) {
    const candidate = await this.candidateModel.findById(id);
    if (!candidate)
      throw new HttpException("Candidate not found", HttpStatus.NOT_FOUND);

    return candidate;
  }

  async getCandidates(constituency?: string) {
    if (constituency) {
      const cachedData = await this.redisManager.get(
        `${cachedKeys.CANDIDATES}:${constituency}`,
      );
      if (cachedData) return JSON.parse(cachedData);

      const constituencies: any = await this.constituencyModel
        .find({
          name: { $regex: constituency, $options: "i" },
        })
        .populate({
          path: "candidates",
          model: "Candidate",
          populate: [{ path: "party" }, { path: "constituency" }],
        });

      if (constituencies.length === 0) return { candidates: [] };

      return constituencies[0].candidates.sort(
        (a, b) => b.totalVotes - a.totalVotes,
      );
    }

    return this.candidateModel
      .find()
      .populate("party constituency")
      .sort({ totalVotes: -1 });
  }

  async deleteCandidate(id: string) {
    const deletedCandidate = await this.candidateModel.findByIdAndDelete(id);
    if (!deletedCandidate) {
      throw new HttpException("Candidate not found", HttpStatus.NOT_FOUND);
    }

    await this.redisManager.clearAllKeys();

    return {
      success: true,
      message: "Candidate deleted successfully",
      deletedId: deletedCandidate._id,
    };
  }

  async addCandidatesFromExcel(file: Express.Multer.File) {
    try {
      const workBook = xlsx.read(file.buffer, { type: "buffer" });
      const sheet = workBook.SheetNames[0];
      const jsonData = xlsx.utils.sheet_to_json(workBook.Sheets[sheet]);

      const formattedJsonData = await Promise.all(
        jsonData.map(async (elem: any) => {
          const constituency = await this.constituencyModel.findOne({
            name: elem.constituency,
          });
          const party = await this.partyModel.findOne({ party: elem.party });

          if (!constituency || !party) {
            throw new BadRequestException("Bad Request. Check Your File Data And Try Again");
          }

          return new this.candidateModel({
            name: elem.name,
            constituency: [constituency._id],
            age: elem.age,
            party: party._id,
            hotCandidate: elem.hotCandidate,
            gender: elem.gender,
          });
        })
      );

      const bulkSaveCandidates = await this.candidateModel.bulkSave(formattedJsonData);
      console.log(bulkSaveCandidates.insertedCount);
      if (bulkSaveCandidates.insertedCount === 0) {
        throw new BadRequestException("Bad Request. Check Your File Data And Try Again");
      }
      return { succcess: true }
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException(error);
    }
  }
}

import { InjectRedis } from "@nestjs-modules/ioredis";
import { Controller, Delete, Get, Post, Put, Req, Res } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Request, Response } from "express";
import Redis from "ioredis";
import { Model } from "mongoose";
import { candidateSchema } from "src/schemas/candidates.schema";
import { ConstituencyElectionSchema } from "src/schemas/constituency-election.schema";
import { constituencySchema } from "src/schemas/constituency.schema";
import { TempElectionSchema } from "src/schemas/temp-election.schema";
import { RedisManager } from "../config/redis.manager";

@Controller("api/constituency")
export class ConstituencyController {
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

  @Post()
  async createConstituency(@Req() req: Request, @Res() res: Response) {
    try {
      const existingConstituency = await this.constituencyModel.findOne({
        name: req.body.name,
        state: req.body.state,
      });
      if (existingConstituency) {
        return res.redirect("/create-constituency");
      }

      const constituency = await this.constituencyModel.create(req.body);

      if (req.body.candidates) {
        for (let candidate of req.body.candidates) {
          await this.candidateModel
            .findByIdAndUpdate(
              candidate,
              { constituency: constituency._id },
              { new: true },
            )
            .exec();
        }
      }

      await this.redisManager.clearAllKeys();

      return res.status(200).json(constituency);
    } catch (error) {
      console.log(error);
      res.redirect("/create-constituency");
    }
  }

  @Get()
  async getAllConstituencies(@Req() req: Request, @Res() res: Response) {
    try {
      const { state, year } = req.query;

      const key = `widget_cn_election_constituencies_${state}_${year}`;

      const cachedResult = await this.redisManager.get(key);
      if (cachedResult) {
        return res.json(cachedResult);
      }

      if (!state || !year) {
        return res.status(400).json({
          success: false,
          message: "State, year are required query parameters",
        });
      }

      // First, find the election to get its ID
      const election = await this.tempElectionModel
        .findOne({
          state: state,
          year: year,
        })
        .lean();

      if (!election) {
        return res.status(404).json({
          success: false,
          message: "Election not found",
        });
      }

      const constituencies = await this.electionConstituencyModel
        .find({
          election: election._id,
        })
        .populate({ path: "constituency", select: "-candidates" })
        .lean()
        .then((results: any) => results.map((result) => result.constituency));

      this.redisManager.set(key, JSON.stringify(constituencies));

      return res.json(constituencies);
    } catch (error) {
      console.error("Error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  @Get(":id")
  async getConstituencyById(@Req() req: Request, @Res() res: Response) {
    try {
      const constituency = await this.constituencyModel
        .findById(req.params.id)
        .populate("candidates");
      if (!constituency) return res.status(404).send("Constituency not found");

      res.json(constituency);
    } catch (error) {
      console.error("Error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  @Put(":id")
  async updateConstituencyById(@Req() req: Request, @Res() res: Response) {
    try {
      const existingConstituency = await this.constituencyModel
        .findById(req.params.id)
        .populate("candidates");
      if (!existingConstituency)
        return res.status(404).send("Constituency not found");

      const newCandidateIds = req.body.candidates || [];
      // const removedCandidates = existingConstituency.candidates.filter(
      //     (candidate) => !newCandidateIds.includes(String(candidate._id))
      // );

      // const updatePromises = removedCandidates.map((candidate) =>
      //     Candidate.findByIdAndUpdate(candidate._id, { constituency: null })
      // );
      // await Promise.all(updatePromises);

      const updatedConstituency =
        await this.constituencyModel.findByIdAndUpdate(
          req.params.id,
          req.body,
          { new: true },
        );

      await this.redisManager.clearAllKeys();
      res.json(updatedConstituency);
    } catch (error) {
      console.error(error, "updated");

      res.redirect(`/edit-constituency/${req.params.id}`);
    }
  }

  @Delete(":id")
  async deleteConstituencyById(@Req() req: Request, @Res() res: Response) {
    try {
      const constituency = await this.constituencyModel.findByIdAndDelete(
        req.params.id,
      );
      if (!constituency) {
        return res.status(404).send("Constituency not found");
      }
      await this.redisManager.clearAllKeys();

      res.json({ message: "Constituency deleted successfully" });
    } catch (error) {
      console.log(error);
      res.status(500).send(error.message);
    }
  }
}

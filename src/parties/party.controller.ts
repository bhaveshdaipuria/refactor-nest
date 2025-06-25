import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { Response, Request } from "express";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { partySchema } from "src/schemas/party.schema";
import { constituencySchema } from "src/schemas/constituency.schema";
import { candidateSchema } from "src/schemas/candidates.schema";
import { cachedKeys, getFullImagePath } from "src/utils";
import { AdminGuard } from "src/guards/admin.guard";
import { FileInterceptor } from "@nestjs/platform-express";
import { RedisManager } from "../config/redis.manager";

@Controller("api/party")
export class PartyController {
  constructor(
    @InjectModel("Party") private partyModel: Model<typeof partySchema>,
    @InjectModel("Constituency")
    private constituencyModel: Model<typeof constituencySchema>,
    @InjectModel("Candidate")
    private candidateModel: Model<typeof candidateSchema>,
    private readonly redisManager: RedisManager,
  ) {}

  @Get("top-parties")
  async getTopParties(@Req() req: Request, @Res() res: Response) {
    const fullUrl = req.get("Referer");
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

    try {
      // Determine which state's parties to use
      const state = fullUrl?.includes("delhi") ? "delhi" : "jharkhand";
      const partyIds = AllStateParties[state];

      // Get parties in the same order as defined in AllStateParties
      const topParties = await this.partyModel.aggregate([
        {
          $match: {
            _id: { $in: partyIds.map((id) => new Types.ObjectId(id)) },
          },
        },
        {
          $addFields: {
            sortIndex: {
              $indexOfArray: [
                partyIds.map((id) => new Types.ObjectId(id)),
                "$_id",
              ],
            },
          },
        },
        {
          $sort: { sortIndex: 1 },
        },
      ]);

      // Add "Others" option
      const result = [
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

      return res.status(200).json(result);
    } catch (error) {
      console.error("top-parties error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve top parties",
        error: error.message,
      });
    }
  }

  @Get("parties-summary")
  async getPartiesSummaries(@Req() req: Request, @Res() res: Response) {
    try {
      // Cache miss, proceed to fetch data from the database
      const parties: any = await this.partyModel
        .find({
          party: { $in: ["BJP+", "JMM+", "बीजेपी+", "जेएमएम+"] },
        })
        .sort({ createdAt: -1 });

      // Map the filtered parties into the desired structure
      let partiesList = parties.map((party) => ({
        party: party.party,
        color_code: party.color_code,
        total_votes: party.total_votes,
        total_seat: party.total_seat,
        party_logo: party.party_logo
          ? getFullImagePath(req, "party_logos/" + party.party_logo)
          : null,
      }));

      // Fetch total number of constituencies
      const totalSeats = await this.constituencyModel.countDocuments();

      // Prepare the response data
      const responseData = { totalSeats, partiesList };

      res.json(responseData);
    } catch (error) {
      console.log("Error fetching parties summary:", error);
      res.status(500).json({ error: "Failed to fetch parties summary" });
    }
  }

  @Get("party-count")
  async getPartyCount(@Req() req: Request, @Res() res: Response) {
    try {
      const debugTies = await this.candidateModel.aggregate([
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
            constituenciesWon: { $addToSet: "$_id" }, // Collect unique constituencies for each party
          },
        },
        {
          $project: {
            party: "$_id",
            constituencyCount: { $size: "$constituenciesWon" }, // Count unique constituencies
          },
        },
        { $sort: { constituencyCount: -1 } }, // Sort parties by the number of constituencies
      ]);

      // const result = await Candidate.aggregate([
      //   { $unwind: '$constituency' },
      //   {
      //     $group: {
      //       _id: '$constituency',
      //       maxVotes: { $max: '$totalVotes' },
      //     },
      //   },
      //   {
      //     $lookup: {
      //       from: 'candidates',
      //       localField: '_id',
      //       foreignField: 'constituency',
      //       as: 'candidates',
      //     },
      //   },
      //   { $unwind: '$candidates' },
      //   {
      //     $match: {
      //       $expr: { $eq: ['$candidates.totalVotes', '$maxVotes'] },
      //     },
      //   },
      //   {
      //     $group: {
      //       _id: '$_id',
      //       candidate: { $first: '$candidates' }, // Ensure only one candidate per constituency
      //     },
      //   },
      //   {
      //     $lookup: {
      //       from: 'parties',
      //       localField: 'candidate.party',
      //       foreignField: '_id',
      //       as: 'partyDetails',
      //     },
      //   },
      //   { $unwind: '$partyDetails' },
      //   {
      //     $group: {
      //       _id: '$partyDetails.party',
      //       constituencyCount: { $sum: 1 },
      //     },
      //   },
      //   { $sort: { constituencyCount: -1 } },
      // ]);

      res.json(debugTies);
    } catch (error) {
      console.error("Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  @Post()
  @UseGuards(AdminGuard)
  @UseInterceptors(FileInterceptor("party_logo"))
  async createParty(@Req() req: Request, @Res() res: Response) {
    try {
      const partyData = {
        party: req.body.party,
        color_code: req.body.color_code,
        total_seat: req.body.total_seat,
        total_votes: req.body.total_votes,
        electors: req.body.electors,
        votes_percentage: req.body.votes_percentage,
      };

      if (req.file) {
        partyData["party_logo"] = getFullImagePath(req, "party_logos"); // Use file path if available
      }

      // Check if the party already exists
      const existingParty = await this.partyModel.findOne({
        party: partyData.party,
      });
      if (existingParty) {
        return res.status(400).json({ error: "Party already exists" });
      }

      // Create a new party and save it
      await this.partyModel.create(partyData);

      await this.redisManager.clearAllKeys();

      // Redirect to the list of parties (or return response if desired)
      res.redirect("/parties");
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create new party" });
    }
  }

  @Get()
  async getAllParties(@Req() req: Request, @Res() res: Response) {
    try {
      const cachedData = await this.redisManager.get(cachedKeys.PARTY);
      if (cachedData) {
        return res.json(JSON.parse(cachedData));
      }

      const parties = await this.partyModel.find();

      // Convert to JSON string before caching
      await this.redisManager.set(cachedKeys.PARTY, JSON.stringify(parties));

      console.log(parties);
      return res.json(parties);
    } catch (err) {
      console.error("Failed to retrieve parties:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve party data",
        error: err.message,
      });
    }
  }

  @Get(":id")
  async getPartyById(@Req() req: Request, @Res() res: Response) {
    try {
      const cachedData = await this.redisManager.get(
        cachedKeys.PARTY + ":" + req.params.id,
      );
      if (cachedData) {
        return res.json(cachedData);
      }
      const party = await this.partyModel.findById(req.params.id);

      if (!party) {
        return res.status(404).json({ message: "Party not found" });
      }

      await this.redisManager.set(
        cachedKeys.PARTY + ":" + req.params.id,
        JSON.stringify(party),
      ); // Cache the result

      res.json(party);
    } catch (err) {
      console.error(err); // Log the error for debugging
      res.status(500).json({ error: "Failed to retrieve party data" });
    }
  }

  @Put(":id")
  @UseGuards(AdminGuard)
  @UseInterceptors(FileInterceptor("party_logo"))
  async updatePartyById(@Req() req: Request, @Res() res: Response) {
    try {
      const partyData = {
        party: req.body.party,
        color_code: req.body.color_code,
        // total_seat: req.body.total_seat,
        // total_votes: req.body.total_votes,
        // electors: req.body.electors,
        // votes_percentage: req.body.votes_percentage,
      };

      if (req.file) {
        partyData["party_logo"] = getFullImagePath(req, "party_logos"); // Use file path if available
      }

      const party = await this.partyModel.findByIdAndUpdate(
        req.params.id,
        partyData,
        {
          new: true,
        },
      );

      if (!party) {
        return res.status(404).json({ message: "Party not found" });
      }

      await this.redisManager.clearAllKeys(); // Clear Redis cache when a party is updated or deleted

      res.json(party);
    } catch (err) {
      console.error(err); // Log the error for debugging
      res.status(500).json({ error: "Failed to update party data" });
    }
  }

  @Delete(":id")
  async deletePartyById(@Req() req: Request, @Res() res: Response) {
    try {
      const party = await this.partyModel.findByIdAndDelete(req.params.id);

      if (!party) {
        return res.status(404).json({ message: "Party not found" });
      }
      await this.redisManager.clearAllKeys();
      return res.status(200).json({ message: "Deleted party" });
    } catch (err) {
      console.error(err); // Log the error for debugging
      res.status(500).json({ error: "Failed to delete party data" });
    }
  }
}

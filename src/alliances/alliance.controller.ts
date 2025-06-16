import {
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { FileInterceptor } from "@nestjs/platform-express";
import { Request, Response } from "express";
import { Model, Types } from "mongoose";
import { AdminGuard } from "src/guards/admin.guard";
import { allianceSchema } from "src/schemas/alliance.schema";
import { TempElectionSchema } from "src/schemas/temp-election.schema";
import { getFullImagePath } from "src/utils";

@Controller("api/alliance")
export class AllianceController {
  constructor(
    @InjectModel("Alliance")
    private allianceModel: Model<typeof allianceSchema>,
    @InjectModel("TempElection")
    private tempElectionModel: Model<typeof TempElectionSchema>,
  ) {}

  @Get("parties/:electionId")
  async getElectionParties(@Req() req: Request, @Res() res: Response) {
    try {
      const electionId = req.params.electionId;

      const parties = await this.tempElectionModel.aggregate([
        {
          $match: {
            _id: new Types.ObjectId(electionId),
          },
        },

        // Step 2: Lookup all alliances for this election
        {
          $lookup: {
            from: "alliances",
            localField: "_id",
            foreignField: "election",
            as: "alliances",
          },
        },

        // Step 3: Project to get all party IDs from alliances into a single array
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

        // Step 4: Unwind the election parties
        {
          $unwind: {
            path: "$electionParties",
            preserveNullAndEmptyArrays: true,
          },
        },

        // Step 5: Filter out parties that exist in alliances
        {
          $match: {
            $expr: {
              $not: {
                $in: ["$electionParties", "$allAllianceParties"],
              },
            },
          },
        },

        // Step 6: Lookup party details
        {
          $lookup: {
            from: "parties",
            localField: "electionParties",
            foreignField: "_id",
            as: "partyDetails",
          },
        },

        // Step 7: Unwind party details
        {
          $unwind: "$partyDetails",
        },

        // Step 8: Project the final party details
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

      res.status(200).json(parties);
    } catch (error) {
      console.error(error); // Log the error for debugging
      res.status(500).json({ error: "Failed to update party data" });
    }
  }

  @Post()
  @UseGuards(AdminGuard) // Replaces isAdmin middleware
  @UseInterceptors(FileInterceptor("logo")) // Handles file upload
  async createAlliance(@Req() req: Request, @Res() res: Response) {
    try {
      const { allianceName, leaderParty, parties, election } = req.body;

      if (!parties.includes(leaderParty)) {
        return res
          .status(400)
          .json({ error: "Leader Party must be one of the selected Parties." });
      }

      const alliance = await this.allianceModel.create({
        name: allianceName,
        leaderParty: leaderParty,
        parties: parties,
        logo: getFullImagePath(req, "alliance_logos"),
        election,
      });
      console.log(alliance);

      res.redirect("/alliances");
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Failed to create new alliance" });
    }
  }

  @Delete(":id")
  async deleteAllianceById(@Req() req: Request, @Res() res: Response) {
    try {
      const alliance = await this.allianceModel.findByIdAndDelete(
        req.params.id,
      );
      if (!alliance) {
        return res.status(404).json({ message: "Alliance not found" });
      }
      return res.status(200).json({ message: "Deleted alliance" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete the alliance" });
    }
  }

  @Put(":id")
  @UseGuards(AdminGuard) // Replaces isAdmin middleware
  @UseInterceptors(FileInterceptor("logo")) // Handles file upload
  async updateAllianceById(@Req() req: Request, @Res() res: Response) {
    try {
      const { allianceName, leaderParty, parties, logo } = req.body;
      const allianceData = {
        name: allianceName,
        leaderParty: leaderParty,
        parties: parties,
        logo: logo,
      };
      if (req.file) {
        allianceData["logo"] = getFullImagePath(req, "alliance_logos"); // Use file path if available
      }

      const alliance = await this.allianceModel.findByIdAndUpdate(
        req.params.id,
        allianceData,
        {
          new: true,
        },
      );

      if (!alliance) {
        return res.status(404).json({ message: "Party not found" });
      }

      res.status(200).json(alliance);
    } catch (err) {
      console.error(err); // Log the error for debugging
      res.status(500).json({ error: "Failed to update party data" });
    }
  }
}

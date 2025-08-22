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
import { FileInterceptor } from "@nestjs/platform-express";
import { Request, Response } from "express";
import { AdminGuard } from "src/guards/admin.guard";
import { AllianceService } from "./alliance.service";

@Controller("api/alliance")
export class AllianceController {
  constructor(private readonly allianceService: AllianceService) {}

  @Get("parties/:electionId")
  async getElectionParties(@Req() req: Request, @Res() res: Response) {
    try {
      const parties = await this.allianceService.getElectionParties(
        req.params.electionId,
      );
      res.status(200).json(parties);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch election parties" });
    }
  }

  @Post()
  @UseGuards(AdminGuard)
  @UseInterceptors(FileInterceptor("logo"))
  async createAlliance(@Req() req: Request, @Res() res: Response) {
    try {
      const alliance = await this.allianceService.createAlliance(req, req.body);
      res.redirect("/alliances");
    } catch (error) {
      console.error(error);
      res
        .status(400)
        .json({ error: error.message || "Failed to create new alliance" });
    }
  }

  @Delete(":id")
  async deleteAllianceById(@Req() req: Request, @Res() res: Response) {
    try {
      const alliance = await this.allianceService.deleteAllianceById(
        req.params.id,
      );
      if (!alliance) {
        return res.status(404).json({ message: "Alliance not found" });
      }
      res.status(200).json({ message: "Deleted alliance" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete alliance" });
    }
  }

  @Put(":id")
  @UseGuards(AdminGuard)
  @UseInterceptors(FileInterceptor("logo"))
  async updateAllianceById(@Req() req: Request, @Res() res: Response) {
    try {
      const alliance = await this.allianceService.updateAllianceById(
        req,
        req.params.id,
        req.body,
      );

      if (!alliance) {
        return res.status(404).json({ message: "Alliance not found" });
      }

      res.status(200).json(alliance);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update alliance" });
    }
  }
}


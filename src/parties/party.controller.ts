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
import { PartyService } from "./party.service";
import { AdminGuard } from "src/guards/admin.guard";
import { FileInterceptor } from "@nestjs/platform-express";

@Controller("api/party")
export class PartyController {
  constructor(private readonly partyService: PartyService) {}

  @Get("top-parties")
  async getTopParties(@Req() req: Request, @Res() res: Response) {
    try {
      const result = await this.partyService.getTopParties(req.get("Referer"));
      return res.status(200).json(result);
    } catch (error) {
      return res.status(error.status || 500).json({ message: error.message });
    }
  }

  @Get("parties-summary")
  async getPartiesSummaries(@Req() req: Request, @Res() res: Response) {
    try {
      const result = await this.partyService.getPartiesSummaries(req);
      return res.json(result);
    } catch (error) {
      return res.status(error.status || 500).json({ message: error.message });
    }
  }

  @Get("party-count")
  async getPartyCount(@Res() res: Response) {
    try {
      const result = await this.partyService.getPartyCount();
      return res.json(result);
    } catch (error) {
      return res.status(error.status || 500).json({ message: error.message });
    }
  }

  @Post()
  @UseGuards(AdminGuard)
  @UseInterceptors(FileInterceptor("party_logo"))
  async createParty(@Req() req: Request, @Res() res: Response) {
    try {
      const result = await this.partyService.createParty(req);
      return res.redirect(result.redirect);
    } catch (error) {
      return res.status(error.status || 500).json({ message: error.message });
    }
  }

  @Get()
  async getAllParties(@Res() res: Response) {
    try {
      const result = await this.partyService.getAllParties();
      return res.json(result);
    } catch (error) {
      return res.status(error.status || 500).json({ message: error.message });
    }
  }

  @Get(":id")
  async getPartyById(@Param("id") id: string, @Res() res: Response) {
    try {
      const result = await this.partyService.getPartyById(id);
      return res.json(result);
    } catch (error) {
      return res.status(error.status || 500).json({ message: error.message });
    }
  }

  @Put(":id")
  @UseGuards(AdminGuard)
  @UseInterceptors(FileInterceptor("party_logo"))
  async updatePartyById(@Req() req: Request, @Res() res: Response) {
    try {
      const result = await this.partyService.updatePartyById(req);
      return res.json(result);
    } catch (error) {
      return res.status(error.status || 500).json({ message: error.message });
    }
  }

  @Delete(":id")
  async deletePartyById(@Param("id") id: string, @Res() res: Response) {
    try {
      const result = await this.partyService.deletePartyById(id);
      return res.json(result);
    } catch (error) {
      return res.status(error.status || 500).json({ message: error.message });
    }
  }
}

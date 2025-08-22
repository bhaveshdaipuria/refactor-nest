import { Controller, Delete, Get, Param, Post, Put, Query, Req, Res } from "@nestjs/common";
import { Request, Response } from "express";
import { ConstituencyService } from "./constituency.service";

@Controller("api/constituency")
export class ConstituencyController {
  constructor(private readonly constituencyService: ConstituencyService) {}

  @Post()
  async createConstituency(@Req() req: Request, @Res() res: Response) {
    try {
      const result = await this.constituencyService.createConstituency(req);
      return res.status(200).json(result);
    } catch (error) {
      console.error(error);
      return res.redirect("/create-constituency");
    }
  }

  @Get()
  async getAllConstituencies(
    @Query("state") state: string,
    @Query("year") year: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.constituencyService.getAllConstituencies(state, year);
      return res.json(result);
    } catch (error) {
      return res.status(error.status || 500).json({ message: error.message });
    }
  }

  @Get(":id")
  async getConstituencyById(@Param("id") id: string, @Res() res: Response) {
    try {
      const result = await this.constituencyService.getConstituencyById(id);
      return res.json(result);
    } catch (error) {
      return res.status(error.status || 500).json({ message: error.message });
    }
  }

  @Put(":id")
  async updateConstituencyById(@Param("id") id: string, @Req() req: Request, @Res() res: Response) {
    try {
      const result = await this.constituencyService.updateConstituencyById(id, req);
      return res.json(result);
    } catch (error) {
      console.error(error);
      return res.redirect(`/edit-constituency/${id}`);
    }
  }

  @Delete(":id")
  async deleteConstituencyById(@Param("id") id: string, @Res() res: Response) {
    try {
      const result = await this.constituencyService.deleteConstituencyById(id);
      return res.json(result);
    } catch (error) {
      return res.status(error.status || 500).send(error.message);
    }
  }
}

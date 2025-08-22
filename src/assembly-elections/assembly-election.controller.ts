import { Controller, Delete, Get, Post, Put, Req, Res } from "@nestjs/common";
import { Request, Response } from "express";
import { AssemblyElectionService } from "./assembly-election.service";

@Controller("api/assembly-election")
export class AssemblyElectionController {
  constructor(private readonly electionService: AssemblyElectionService) {}

  @Post()
  async createAssemblyElection(@Res() res: Response, @Req() req: Request) {
    try {
      await this.electionService.createElection(req.body);
      return res.status(201).redirect("/assembly-election");
    } catch (error) {
      console.error(error);
      res.status(500).send("Server Error");
    }
  }

  @Get()
  async getAllAssemblyElection(@Res() res: Response) {
    try {
      const elections = await this.electionService.getAllElections();
      res.json(elections);
    } catch (error) {
      console.error(error);
      res.status(500).send("Server Error");
    }
  }

  @Get(":id")
  async getAssemblyElectionById(@Res() res: Response, @Req() req: Request) {
    try {
      const election = await this.electionService.getElectionById(req.params.id);
      res.json(election);
    } catch (error) {
      console.error(error);
      res.status(error.status || 500).send(error.message || "Server Error");
    }
  }

  @Put(":id")
  async updateAssemblyElectionById(@Res() res: Response, @Req() req: Request) {
    try {
      const election = await this.electionService.updateElection(
        req.params.id,
        req.body,
      );
      res.json(election);
    } catch (error) {
      console.error(error);
      res.status(error.status || 500).send(error.message || "Server Error");
    }
  }

  @Delete(":id")
  async deleteAssemblyElectionById(@Res() res: Response, @Req() req: Request) {
    try {
      const result = await this.electionService.deleteElection(req.params.id);
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(error.status || 500).send(error.message || "Server Error");
    }
  }

  @Get("state/:name")
  async getStateAssemblyElection(@Res() res: Response, @Req() req: Request) {
    try {
      const stateElection = await this.electionService.getStateElection(
        req.params.name,
      );
      res.json(stateElection);
    } catch (error) {
      console.error(error);
      res.status(error.status || 500).send(error.message || "Server Error");
    }
  }
}

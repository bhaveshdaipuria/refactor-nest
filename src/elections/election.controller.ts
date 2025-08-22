import { 
  Controller, 
  Get, 
  Req, 
  Res, 
  Post, 
  Param, 
  Query, 
  Delete, 
  Patch, 
  Put, 
  Body,
  HttpStatus
} from "@nestjs/common";
import { Request, Response } from 'express';
import { ElectionService } from './election.service';
import { getEmbedding } from "src/utils";

@Controller("api/elections")
export class ElectionController {
  constructor(private readonly electionService: ElectionService) {}

  @Get("party-summary")
  async getElectionPartySummary(@Req() req: Request, @Res() res: Response) {
    try {
      const fullUrl: any = req.get("Referer");
      console.log("fullUrl -> ", fullUrl);

      const result = await this.electionService.getElectionPartySummary(fullUrl);
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      console.error(error);
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  }

  @Post('temp-elections')
  async tempElections(@Req() req: Request, @Res() res: Response) {
    try {
      const {
        state,
        halfWayMark,
        electionType,
        year,
        totalSeats,
        electionInfo,
        constituencies,
      } = req.body;

      const savedElection = await this.electionService.createTempElection({
        state,
        halfWayMark,
        electionType,
        year,
        totalSeats,
        electionInfo,
        constituencies,
      });

      return res.status(HttpStatus.OK).json(savedElection);
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      return res.status(HttpStatus.BAD_REQUEST).json({ error: error.message });
    }
  }

  @Post()
  async createElection(@Req() req: Request, @Res() res: Response) {
    try {
      const { state, totalSeats, declaredSeats, halfWayMark, parties } = req.body;

      const savedElection = await this.electionService.createElection({
        state,
        totalSeats,
        declaredSeats,
        halfWayMark,
        parties,
      });

      return res.status(HttpStatus.CREATED).json(savedElection);
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      return res.status(HttpStatus.BAD_REQUEST).json({ error: error.message });
    }
  }

  @Get('states')
  async getStates(@Req() req: Request, @Res() res: Response) {
    try {
      const statesWithSlugs = await this.electionService.getStates();
      return res.status(HttpStatus.OK).json({
        message: "States, their slugs, and ids retrieved successfully",
        data: statesWithSlugs,
      });
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  }

  @Get(':id')
  async retrieveElectionData(@Param('id') id: string, @Res() res: Response) {
    try {
      const election = await this.electionService.getElectionById(id);
      return res.status(HttpStatus.OK).json(election);
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  }

  @Get()
  async getPage(
    @Query('page') page: string, 
    @Query('limit') limit: string,
    @Res() res: Response
  ) {
    try {
      const pageInt = parseInt(page) || 1;
      const limitInt = parseInt(limit) || 10;

      const result = await this.electionService.getElectionsPaginated(pageInt, limitInt);
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
  }

  @Delete(':id')
  async deleteElection(@Param('id') id: string, @Res() res: Response) {
    try {
      const result = await this.electionService.deleteElection(id);
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  }

  @Patch('temp-election/constituencies/update-status')
  async updateStatus(@Req() req: Request, @Res() res: Response) {
    try {
      const { constituencies, redisKeys } = req.body;

      const result = await this.electionService.updateConstituencyStatus(constituencies, redisKeys);
      return res.json(result);
    } catch (error) {
      console.error("Error updating constituency statuses:", error);
      if (error.status) {
        return res.status(error.status).json({ success: false, message: error.message });
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: error.message || "An error occurred while updating constituency statuses",
      });
    }
  }

  @Patch('temp-election/party/add')
  async addParty(@Req() req: Request, @Res() res: Response) {
    try {
      const { election, parties, redisKeys } = req.body;

      const result = await this.electionService.addPartyToElection(election, parties, redisKeys);
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  }

  @Patch('temp-election/main-info-update/:id')
  async mainInfoUpdate(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    try {
      const { status, state, halfWayMark, totalSeats, year, electionType } = req.body;
      console.log(req.body);

      const result = await this.electionService.updateMainElectionInfo(id, {
        status,
        state,
        halfWayMark,
        totalSeats,
        year,
        electionType,
      });

      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  }

  @Patch('temp-election/candidate/add')
  async addCandidate(@Req() req: Request, @Res() res: Response) {
    try {
      const { election, candidates, redisKeys } = req.body;

      const result = await this.electionService.addCandidateToElection(election, candidates, redisKeys);
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  }

  @Delete('temp-election/party/delete/:partyId/:electionId')
  async deletePartyFromElection(
    @Param('partyId') partyId: string, 
    @Param('electionId') electionId: string,
    @Req() req: Request,
    @Res() res: Response
  ) {
    try {
      const { redisKeys } = req.body;

      const result = await this.electionService.deletePartyFromElection(partyId, electionId, redisKeys);
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  }

  @Delete('temp-election/candidate/delete/:candidateId/:electionId')
  async deleteCandidateFromElection(
    @Param('candidateId') candidateId: string,
    @Param('electionId') electionId: string,
    @Req() req: Request,
    @Res() res: Response
  ) {
    try {
      const { redisKeys } = req.body;

      const result = await this.electionService.deleteCandidateFromElection(candidateId, electionId, redisKeys);
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  }

  @Put('temp-election/candidate/update')
  async updateCandidateForElection(@Req() req: Request, @Res() res: Response) {
    try {
      console.log(req.body);
      const { election, candidate, votesReceived, redisKeys } = req.body;

      const updatedDocument = await this.electionService.updateCandidateVotes(
        election,
        candidate,
        votesReceived,
        redisKeys
      );

      console.log(updatedDocument);
      return res.status(HttpStatus.OK).json(updatedDocument);
    } catch (error) {
      console.error(error);
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  }

  @Put('temp-election/party/update')
  async updatePartyForElection(@Req() req: Request, @Res() res: Response) {
    try {
      const { election, party, seatsWon, redisKeys } = req.body;

      const updatedDocument = await this.electionService.updatePartySeats(
        election,
        party,
        seatsWon,
        redisKeys
      );

      return res.status(HttpStatus.OK).json(updatedDocument);
    } catch (error) {
      console.error(error);
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  }

  @Delete('temp-election-delete/:id')
  async deleteTempElection(@Param('id') id: string, @Res() res: Response) {
    try {
      const result = await this.electionService.deleteTempElection(id);
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  }

  @Put(':id')
  async updateTempElection(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    try {
      const updatedElection = await this.electionService.updateElection(id, req.body);
      return res.status(HttpStatus.OK).json(updatedElection);
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  }

  @Post('ask-chatbot')
  async askChatBot(@Body('question') question: string, @Res() res: Response) {
    try {
      const result = await this.electionService.askChatBot(question);
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ 
        error: "Failed to generate response from chatbot", 
        errorStatement: error.message 
      });
    }
  }
}
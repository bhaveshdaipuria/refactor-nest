import {
  Controller,
  Get,
  Query,
  Res,
  HttpStatus,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Response } from 'express';
import { ElectionService } from './election.service';

@Controller('api/election')
export class ElectionController {
  constructor(private readonly electionService: ElectionService) {}

  @Get('hot-candidate/result')
  async getHotCandidateResult(
    @Query('year') year: string,
    @Query('party') party?: string,
    @Query('candidateName') candidateName?: string,
  ) {
    try {
      const result = await this.electionService.getHotCandidateResult(
        year,
        party,
        candidateName,
      );
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch results');
    }
  }

  @Get('candidates')
  async getCandidatesList(
    @Res() res: Response,
    @Query('state') state: string,
    @Query('year') year: string,
    @Query('constituencyId') constituencyId?: string,
  ) {
    try {
      const result = await this.electionService.getCandidatesList(
        state,
        year,
        constituencyId,
      );
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch results');
    }
  }

  @Get('hot-candidates')
  async getHotCandidates(
    @Res() res: Response,
    @Query('state') state: string,
    @Query('year') year: string,
  ) {
    try {
      const result = await this.electionService.getHotCandidates(state, year);
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch results');
    }
  }

  @Get('map/top-candidates')
  async getTopCandidates(
    @Res() res: Response,
    @Query('state') state?: string,
    @Query('year') year?: string,
  ) {
    try {
      const result = await this.electionService.getTopCandidates(state, year);
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch results');
    }
  }
}

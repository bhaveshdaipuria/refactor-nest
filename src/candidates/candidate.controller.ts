import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Param,
  Res,
} from '@nestjs/common';
import { CandidateService } from './candidate.service';
import { Response } from 'express';

@Controller('api/candidate')
export class CandidateController {
  constructor(private readonly candidateService: CandidateService) {}

  @Get()
  async getAllCandidates() {
    try {
      const result = await this.candidateService.getAllCandidate();
      return result;
    } catch (error) {
      console.log(error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch results');
    }
  }

  @Get(':constituency')
  async getConstituencyCandidates(@Param('constituency') constituency: string) {
    try {
      const result = await this.candidateService.getAllCandidate(constituency);

      return result;
    } catch (error) {
      console.log(error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch results');
    }
  }
}

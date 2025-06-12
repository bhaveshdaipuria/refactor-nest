import { Controller, Get, HttpStatus, Param, Res } from '@nestjs/common';
import { CandidateService } from './candidate.service';
import { Response } from 'express';

@Controller('api/candidate')
export class CandidateController {
  constructor(private readonly candidateService: CandidateService) {}

  @Get()
  async getAllCandidates(@Res() res: Response) {
    try {
      return this.candidateService.getAllCandidate();
    } catch (error) {
      console.error('Error:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  @Get(':constituency')
  async getConstituencyCandidates(
    @Res() res: Response,
    @Param('constituency') constituency: string,
  ) {
    try {
      return this.candidateService.getAllCandidate(constituency);
    } catch (error) {
      console.error('Error:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }
}

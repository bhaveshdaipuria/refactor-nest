import { Controller, Post, Body } from '@nestjs/common';
import { CandidatesService } from './candidates.service';

@Controller('candidates')
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  @Post('election-details')
  async getElectionDetails(
    @Body('userType') userType: string,
    @Body('electionId') electionId: string,
    @Body('allowedConstituencies') allowedConstituencies: string[],
  ) {
    return this.candidatesService.getCandidateElectionDetails(
      userType,
      electionId,
      allowedConstituencies,
    );
  }
}

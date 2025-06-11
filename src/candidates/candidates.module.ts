import { Module } from '@nestjs/common';
import { CandidatesController } from './candidates.controller';
import { CandidatesService } from './candidates.service';
import { MongooseModule } from '@nestjs/mongoose';
import { CandidateElectionSchema } from './candidate-election.schema';
import { CandidateSchema } from './candidate.schema';
import { ConstituencySchema } from './constituency.schema';
import { PartySchema } from './party.schema';
import { ElectionCandidateSchema } from './election-candidate.schema';
import { ElectionConstituencySchema } from './election-constituency.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'CandidateElection', schema: CandidateElectionSchema },
      { name: 'Candidate', schema: CandidateSchema },
      { name: 'Constituency', schema: ConstituencySchema },
      { name: 'Party', schema: PartySchema },
      { name: 'ElectionCandidate', schema: ElectionCandidateSchema },
      { name: 'ElectionConstituency', schema: ElectionConstituencySchema },
    ]),
  ],
  controllers: [CandidatesController],
  providers: [CandidatesService]
})
export class CandidatesModule {}

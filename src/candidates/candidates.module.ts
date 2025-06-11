import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CandidateElectionSchema } from './candidate-election.schema';
import { CandidateSchema } from './candidate.schema';
import { ConstituencySchema } from './constituency.schema';
import { PartySchema } from './party.schema';
import { ElectionCandidateSchema } from './election-candidate.schema';
import { ElectionConstituencySchema } from './election-constituency.schema';
import { ElectionController } from './election.controller';
import { RedisModule } from '@nestjs-modules/ioredis';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'CandidateElection', schema: CandidateElectionSchema },
      { name: 'Candidate', schema: CandidateSchema },
      { name: 'Constituency', schema: ConstituencySchema },
      { name: 'Party', schema: PartySchema },
      { name: 'ElectionCandidate', schema: ElectionCandidateSchema },
      { name: 'ElectionConstituency', schema: ElectionConstituencySchema },
      { name: 'TempElection', schema: CandidateElectionSchema },
    ]),
    RedisModule.forRoot({
      type: 'single',
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    }),
  ],
  controllers: [ElectionController],
  providers: []
})
export class CandidatesModule {}

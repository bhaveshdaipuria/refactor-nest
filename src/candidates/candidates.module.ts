import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ElectionCandidateSchema } from './schemas/candidate.election.schema';
import { RedisModule } from '@nestjs-modules/ioredis';
import { CandidateController } from './candidate.controller';
import { CandidateService } from './candidate.service';
import { ConstituencySchema } from 'src/constituencies/schemas/constituency.schema';
import { PartySchema } from 'src/parties/schemas/party.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'ElectionCandidate', schema: ElectionCandidateSchema },
      { name: 'Candidate', schema: ElectionCandidateSchema },
      { name: 'Constituency', schema: ConstituencySchema },
      { name: 'Party', schema: PartySchema },
    ]),
    RedisModule.forRoot({
      type: 'single',
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    }),
  ],
  controllers: [CandidateController],
  providers: [CandidateService],
})
export class CandidatesModule {}

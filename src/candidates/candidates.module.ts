import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ElectionCandidateSchema } from './election-candidate.schema';
import { ElectionController } from './election.controller';
import { RedisModule } from '@nestjs-modules/ioredis';
import {ElectionPartyResultSchema} from './party-election.schema'
import {TempElectionSchema} from './temp-election.schema'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'ElectionCandidate', schema: ElectionCandidateSchema },
      { name: 'TempElection', schema: TempElectionSchema },
      { name: 'ElectionPartyResult', schema: ElectionPartyResultSchema }
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

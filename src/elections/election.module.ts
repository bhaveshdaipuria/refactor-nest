import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ElectionSchema } from '../schemas/election.schema';
import { RedisModule } from '@nestjs-modules/ioredis';
import { ElectionController } from './election.controller';
import { ElectionCandidateSchema } from 'src/schemas/candidate.election.schema';
import { ElectionPartyResultSchema } from 'src/schemas/party.election.schema';
import { ElectionService } from './election.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'ElectionCandidate', schema: ElectionCandidateSchema },
      { name: 'TempElection', schema: ElectionSchema },
      { name: 'ElectionPartyResult', schema: ElectionPartyResultSchema },
    ]),
    RedisModule.forRoot({
      type: 'single',
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    }),
  ],
  controllers: [ElectionController],
  providers: [ElectionService],
})
export class ElectionModule {}

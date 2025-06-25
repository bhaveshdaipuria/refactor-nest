import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthController } from './auth.controller';
import { userSchema } from '../schemas/user.schema';
import { ElectionCandidateSchema } from '../schemas/candidate-election.schema';
import { ElectionPartyResultSchema } from '../schemas/party-election.schema';
import { TempElectionSchema } from '../schemas/temp-election.schema';
import { ElectionSchema } from '../schemas/election.schema';
import { RedisManager } from '../config/redis.manager';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'ElectionCandidate', schema: ElectionCandidateSchema },
      { name: 'TempElection', schema: TempElectionSchema },
      { name: 'ElectionPartyResult', schema: ElectionPartyResultSchema },
      { name: 'Election', schema: ElectionSchema },
      { name: 'User', schema: userSchema }
    ])
  ],
  controllers: [AuthController],
  providers: [RedisManager],
})
export class AuthModule {}
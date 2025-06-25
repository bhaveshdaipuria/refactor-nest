import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ElectionCandidateSchema } from "../schemas/candidate-election.schema";
import { ElectionController } from "./election.controller";
import { RedisModule } from "@nestjs-modules/ioredis";
import { ElectionPartyResultSchema } from "../schemas/party-election.schema";
import { TempElectionSchema } from "../schemas/temp-election.schema";
import { RedisManager } from '../config/redis.manager';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "ElectionCandidate", schema: ElectionCandidateSchema },
      { name: "TempElection", schema: TempElectionSchema },
      { name: "ElectionPartyResult", schema: ElectionPartyResultSchema },
    ]),
    RedisModule.forRoot({
      type: "single",
      url: process.env.REDIS_URL || "redis://localhost:6379",
    }),
  ],
  controllers: [ElectionController],
  providers: [RedisManager],
})
export class WidgetsModule {}

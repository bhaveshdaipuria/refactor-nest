import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ElectionCandidateSchema } from "../schemas/candidate-election.schema";
import { ElectionController } from "./election.controller";
import { ElectionPartyResultSchema } from "../schemas/party-election.schema";
import { TempElectionSchema } from "../schemas/temp-election.schema";
import { RedisManager } from "../config/redis.manager";
import { ElectionService } from "./election.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "ElectionCandidate", schema: ElectionCandidateSchema },
      { name: "TempElection", schema: TempElectionSchema },
      { name: "ElectionPartyResult", schema: ElectionPartyResultSchema },
    ]),
  ],
  controllers: [ElectionController],
  providers: [RedisManager, ElectionService],
})
export class WidgetsModule {}

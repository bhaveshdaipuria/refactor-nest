import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { createMulterConfig } from "src/config/multer-config.factory";
import { CandidateController } from "./candidate.controller";
import { MongooseModule } from "@nestjs/mongoose";
import { TempElectionSchema } from "src/schemas/temp-election.schema";
import { ElectionCandidateSchema } from "src/schemas/candidate-election.schema";
import { constituencySchema } from "src/schemas/constituency.schema";
import { ConstituencyElectionSchema } from "src/schemas/constituency-election.schema";
import { candidateSchema } from "src/schemas/candidates.schema";
import { partySchema } from "src/schemas/party.schema";
import { RedisManager } from "src/config/redis.manager";

const candidateMulterConfig = createMulterConfig({
  destination: "public/uploads/candidates",
  useOriginalName: true, // Uses timestamp-only filename
});

@Module({
  imports: [
    MulterModule.register(candidateMulterConfig),
    MongooseModule.forFeature([
      { name: "TempElection", schema: TempElectionSchema },
      { name: "Constituency", schema: constituencySchema },
      { name: "ElectionConstituency", schema: ConstituencyElectionSchema },
      { name: "Candidate", schema: candidateSchema },
      { name: "ElectionCandidate", schema: ElectionCandidateSchema },
      { name: "Party", schema: partySchema },
    ]),
  ],
  controllers: [CandidateController],
  providers: [RedisManager]
})
export class CandidateModule {}

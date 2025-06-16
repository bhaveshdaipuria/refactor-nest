import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { candidateSchema } from "src/schemas/candidates.schema";
import { ConstituencyElectionSchema } from "src/schemas/constituency-election.schema";
import { constituencySchema } from "src/schemas/constituency.schema";
import { TempElectionSchema } from "src/schemas/temp-election.schema";
import { ConstituencyController } from "./constituency.controller";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "TempElection", schema: TempElectionSchema },
      { name: "Constituency", schema: constituencySchema },
      { name: "ElectionConstituency", schema: ConstituencyElectionSchema },
      { name: "Candidate", schema: candidateSchema },
    ]),
  ],
  controllers: [ConstituencyController],
})
export class ConstituencyModule {}

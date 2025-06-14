
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ElectionCandidateSchema } from "../schemas/candidate-election.schema";
import { DashBoardController } from "./dashboard.controller";
import { ElectionPartyResultSchema } from "../schemas/party-election.schema";
import { TempElectionSchema } from "../schemas/temp-election.schema";
import { ElectionSchema } from "src/schemas/election.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "ElectionCandidate", schema: ElectionCandidateSchema },
      { name: "TempElection", schema: TempElectionSchema },
      { name: "ElectionPartyResult", schema: ElectionPartyResultSchema },
      { name: "Election", schema: ElectionSchema }
    ]),
  ],
  controllers: [DashBoardController],
  providers: [],
})
export class DashBoardModule {}
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { DashBoardController } from "./dashboard.controller";
import { TempElectionSchema } from "src/schemas/temp-election.schema";
import { ElectionSchema } from "src/schemas/election.schema";
import { constituencySchema } from "src/schemas/constituency.schema";
import { ConstituencyElectionSchema } from "src/schemas/constituency-election.schema";
import { candidateSchema } from "src/schemas/candidates.schema";
import { ElectionCandidateSchema } from "src/schemas/candidate-election.schema";
import { partySchema } from "src/schemas/party.schema";
import { ElectionPartyResultSchema } from "src/schemas/party-election.schema";
import { userSchema } from "src/schemas/user.schema";
import { electionSchema } from "src/schemas/assembly-election.schema";
import { allianceSchema } from "src/schemas/alliance.schema";
import { RedisManager } from '../config/redis.manager';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "TempElection", schema: TempElectionSchema },
      { name: "Election", schema: ElectionSchema },
      { name: "Constituency", schema: constituencySchema },
      { name: "ElectionConstituency", schema: ConstituencyElectionSchema },
      { name: "Candidate", schema: candidateSchema },
      { name: "ElectionCandidate", schema: ElectionCandidateSchema },
      { name: "Party", schema: partySchema },
      { name: "ElectionPartyResult", schema: ElectionPartyResultSchema },
      { name: "User", schema: userSchema },
      { name: "AssemblyElection", schema: electionSchema },
      { name: 'Alliance', schema: allianceSchema }
    ]),
  ],
  controllers: [DashBoardController],
  providers: [RedisManager],
})
export class DashBoardModule {}
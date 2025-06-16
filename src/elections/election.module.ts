import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ElectionController } from "./election.controller";
import { TempElectionSchema } from "src/schemas/temp-election.schema";
import { constituencySchema } from "src/schemas/constituency.schema";
import { ConstituencyElectionSchema } from "src/schemas/constituency-election.schema";
import { candidateSchema } from "src/schemas/candidates.schema";
import { ElectionCandidateSchema } from "src/schemas/candidate-election.schema";
import { partySchema } from "src/schemas/party.schema";
import { electionSchema } from "src/schemas/assembly-election.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "TempElection", schema: TempElectionSchema },
      { name: "Election", schema: electionSchema },
      { name: "Constituency", schema: constituencySchema },
      { name: "ElectionConstituency", schema: ConstituencyElectionSchema },
      { name: "Candidate", schema: candidateSchema },
      { name: "ElectionCandidate", schema: ElectionCandidateSchema },
      { name: "Party", schema: partySchema },
    ]),
  ],
  controllers: [ElectionController],
})
export class ElectionModule {}

import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AssemblyElectionController } from "./assembly-election.controller";
import { candidateSchema } from "src/schemas/candidates.schema";
import { electionSchema } from "src/schemas/assembly-election.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "AssemblyElection", schema: electionSchema },
      { name: "Candidate", schema: candidateSchema },
    ]),
  ],
  controllers: [AssemblyElectionController],
})
export class AssemblyElectionModule {}

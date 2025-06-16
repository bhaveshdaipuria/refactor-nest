import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { MulterModule } from "@nestjs/platform-express";
import { createMulterConfig } from "src/config/multer-config.factory";
import { allianceSchema } from "src/schemas/alliance.schema";
import { TempElectionSchema } from "src/schemas/temp-election.schema";
import { AllianceController } from "./alliance.controller";

const candidateMulterConfig = createMulterConfig({
  destination: "public/uploads/alliance_logos",
});

@Module({
  imports: [
    MulterModule.register(candidateMulterConfig),
    MongooseModule.forFeature([
      { name: "TempElection", schema: TempElectionSchema },
      { name: "Alliance", schema: allianceSchema },
    ]),
  ],
  controllers: [AllianceController],
})
export class AllianceModule {}

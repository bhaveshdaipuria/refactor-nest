import { createMulterConfig } from "src/config/multer-config.factory";
import { PartyController } from "./party.controller";
import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { MongooseModule } from "@nestjs/mongoose";
import { partySchema } from "src/schemas/party.schema";
import { constituencySchema } from "src/schemas/constituency.schema";
import { candidateSchema } from "src/schemas/candidates.schema";
import { RedisManager } from "src/config/redis.manager";
import { PartyService } from "./party.service";

const partyMulterConfig = createMulterConfig({
  destination: "public/uploads/party_logos",
});

@Module({
  imports: [
    MulterModule.register(partyMulterConfig),
    MongooseModule.forFeature([
      { name: "Party", schema: partySchema },
      { name: "Constituency", schema: constituencySchema },
      { name: "Candidate", schema: candidateSchema },
    ]),
  ],
  controllers: [PartyController],
  providers: [RedisManager, PartyService],
})
export class PartyModule {}

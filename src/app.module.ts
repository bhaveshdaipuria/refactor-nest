import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { MongooseModule } from "@nestjs/mongoose";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { WidgetsModule } from "./widgets/election.module";
import { DashBoardModule } from "./dashboard/dashboard.module";
import { RedisModule } from "@nestjs-modules/ioredis";
import { AuthModule } from "./auth/auth.module";
import { CandidateModule } from "./candidates/candidate.module";
import { PartyModule } from "./parties/party.module";
import { ConstituencyModule } from "./constituencies/constituency.module";
import { AllianceModule } from "./alliances/alliance.module";
import { UserModule } from "./users/user.module";
import { AssemblyElectionModule } from "./assembly-elections/assemby-election.module";
import { ElectionModule } from "./elections/election.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>("MONGO_URI"),
        dbName: configService.get<string>("DATABASE_NAME"),
      }),
      inject: [ConfigService],
    }),

    RedisModule.forRoot({
      type: "single",
      url: process.env.REDIS_URL || "redis://localhost:6379",
    }),

    WidgetsModule,
    DashBoardModule,
    AuthModule,
    CandidateModule,
    PartyModule,
    ConstituencyModule,
    AllianceModule,
    UserModule,
    AssemblyElectionModule,
    ElectionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

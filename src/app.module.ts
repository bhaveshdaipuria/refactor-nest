import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PartiesModule } from './parties/modules/party.module';
import { ElectionModule } from './elections/election.module';
import { ConstituencyModule } from './constituencies/constituency.module';
import { CandidatesModule } from './candidates/candidates.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI'),
        dbName: configService.get<string>('DATABASE_NAME'),
      }),
      inject: [ConfigService],
    }),
    CandidatesModule,
    PartiesModule,
    ElectionModule,
    ConstituencyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

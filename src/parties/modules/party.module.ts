import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RedisModule } from '@nestjs-modules/ioredis';
import { PartySchema } from '../schemas/party.schema';
import { ElectionPartyResultSchema } from '../schemas/party.election.schema';
import { PartyController } from '../party.controller';
import { PartyService } from '../party.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Party', schema: PartySchema },
      { name: 'ElectionPartyResult', schema: ElectionPartyResultSchema },
    ]),
    RedisModule.forRoot({
      type: 'single',
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    }),
  ],
  controllers: [PartyController],
  providers: [PartyService],
})
export class PartiesModule {}

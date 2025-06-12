import { RedisModule } from '@nestjs-modules/ioredis';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConstituencySchema } from '../schemas/constituency.schema';
import { ElectionConstituencySchema } from '../schemas/constituency.election.schema';
import { ConstituencyController } from './constituency.controller';
import { ConstituencyService } from './constituency.service';
import { ElectionSchema } from 'src/schemas/election.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Constituency', schema: ConstituencySchema },
      {
        name: 'ElectionConstituency',
        schema: ElectionConstituencySchema,
      },
      { name: 'TempElection', schema: ElectionSchema },
    ]),
    RedisModule.forRoot({
      type: 'single',
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    }),
  ],
  controllers: [ConstituencyController],
  providers: [ConstituencyService],
})
export class ConstituencyModule {}

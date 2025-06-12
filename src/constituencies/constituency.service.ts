import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { ConstituencySchema } from './schemas/constituency.schema';
import { ElectionConstituencySchema } from './schemas/constituency.election.schema';
import { ElectionSchema } from 'src/elections/election.schema';
@Injectable()
export class ConstituencyService {
  constructor(
    @InjectModel('Constituency')
    private readonly constituencyModel: Model<typeof ConstituencySchema>,
    @InjectModel('ElectionConstituency')
    private readonly electionConstituencyResultModel: Model<
      typeof ElectionConstituencySchema
    >,
    @InjectModel('TempElection')
    private readonly electionModel: Model<typeof ElectionSchema>,
    @InjectRedis()
    private readonly redis: Redis,
  ) {}

  async getConstituencies(state: string, year: string) {
    // Validate required parameters
    if (!state || !year) {
      throw new HttpException(
        'State and year are required query parameters',
        HttpStatus.BAD_REQUEST,
      );
    }

    const key = `widget_cn_election_constituencies_${state}_${year}`;

    try {
      // Check cache first
      const cachedResult = await this.redis.get(key);
      if (cachedResult) {
        return JSON.parse(cachedResult);
      }

      // Find election
      const election = await this.electionModel
        .findOne({
          state: state,
          year: parseInt(year),
        })
        .lean()
        .exec();

      if (!election) {
        throw new HttpException('Election not found', HttpStatus.NOT_FOUND);
      }

      // Get constituencies
      const results = await this.electionConstituencyResultModel
        .find({ election: election._id })
        .populate<{ constituency: any }>({
          // Type assertion for populated field
          path: 'constituency',
          select: '-candidates',
          model: this.constituencyModel,
        })
        .lean()
        .exec();

      const constituencies = results.map((result) => result.constituency);

      // Cache results
      await this.redis.set(key, JSON.stringify(constituencies));

      return constituencies;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to fetch constituencies',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

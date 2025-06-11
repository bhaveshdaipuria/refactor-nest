import { Controller, Get, Query, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { CandidateSchema } from './candidate.schema';
import { PartySchema } from './party.schema';
import { ElectionCandidateSchema } from './election-candidate.schema';
import { CandidateElectionSchema } from './candidate-election.schema';

@Controller('election')
export class ElectionController {
  constructor(
    @InjectModel('Candidate') private candidateModel: Model<typeof CandidateSchema>,
    @InjectModel('Party') private partyModel: Model<typeof PartySchema>,
    @InjectModel('ElectionCandidate') private electionCandidateModel: Model<typeof ElectionCandidateSchema>,
    @InjectModel('TempElection') private tempElectionModel: Model<typeof CandidateElectionSchema>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  @Get('hot-candidate/result')
  async getHotCandidateResult(
    @Res() res: Response,
    @Query('year') year: string,
    @Query('party') party?: string,
    @Query('candidateName') candidateName?: string,
  ) {
    try {
      if (!year) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'Year parameter is required',
        });
      }

      let key = `widget_bihar_hot_candidate_result_${year}`;

      if (party) {
        key += `_${party}`;
      }
      if (candidateName) {
        key += `_${candidateName}`;
      }

      const cachedResults = await this.redis.get(key);

      if (cachedResults) {
        return res.json(JSON.parse(cachedResults));
      }

      const aggregationPipeline: PipelineStage[] = [
        {
          $match: {
            status: 'completed',
            year: parseInt(year),
          },
        },
        {
          $lookup: {
            from: 'electioncandidates',
            localField: '_id',
            foreignField: 'election',
            as: 'candidates',
          },
        },
        { $unwind: '$candidates' },
        {
          $match: {
            'candidates.status': { $in: ['Won', 'Lost'] },
          },
        },
        {
          $lookup: {
            from: 'candidates',
            localField: 'candidates.candidate',
            foreignField: '_id',
            as: 'candidateDetails',
          },
        },
        { $unwind: '$candidateDetails' },
        {
          $lookup: {
            from: 'parties',
            localField: 'candidateDetails.party',
            foreignField: '_id',
            as: 'partyDetails',
          },
        },
        { $unwind: '$partyDetails' },
        {
          $match: {
            'candidateDetails.hotCandidate': true,
          },
        },
        ...(party
          ? [
              {
                $match: {
                  'partyDetails.party': party,
                },
              },
            ]
          : []),
        ...(candidateName
          ? [
              {
                $match: {
                  'candidateDetails.name': {
                    $regex: candidateName,
                    $options: 'i',
                  },
                },
              },
            ]
          : []),
        {
          $project: {
            _id: 0,
            name: '$candidateDetails.name',
            candidateImage: '$candidateDetails.image',
            party: {
              name: '$partyDetails.party',
              color_code: '$partyDetails.color_code',
              logo: '$partyDetails.party_logo',
            },
            status: '$candidates.status',
          },
        },
        { $sort: { votesReceived: -1 } },
      ];

      const results = await this.tempElectionModel.aggregate(aggregationPipeline);

      if (!results || results.length === 0) {
        return res.status(HttpStatus.NOT_FOUND).json({
          success: false,
          message: 'No hot candidates found matching the criteria',
        });
      }

      const response = {
        success: true,
        data: results,
      };

      await this.redis.set(key, JSON.stringify(response));

      return res.status(HttpStatus.OK).json(response);
    } catch (error) {
      console.error('Error:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }
} 
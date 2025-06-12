import { InjectRedis } from '@nestjs-modules/ioredis';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import { ElectionCandidateSchema } from 'src/candidates/schemas/candidate.election.schema';
import { ElectionPartyResultSchema } from 'src/parties/schemas/party.election.schema';
import { ElectionSchema } from './election.schema';
import Redis from 'ioredis';

@Injectable()
export class ElectionService {
  constructor(
    @InjectModel('ElectionCandidate')
    private electionCandidateModel: Model<typeof ElectionCandidateSchema>,
    @InjectModel('ElectionPartyResult')
    private partyElectionModel: Model<typeof ElectionPartyResultSchema>,
    @InjectModel('TempElection')
    private ElectionModel: Model<typeof ElectionSchema>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async getHotCandidateResult(
    year: string,
    party: string | undefined,
    candidateName: string | undefined,
  ) {
    if (!year) {
      throw new BadRequestException('Year parameter is required');
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
      return JSON.parse(cachedResults);
    }

    const aggregationPipeline: PipelineStage[] = [
      // Match completed elections for the specified year
      {
        $match: {
          status: 'completed',
          year: parseInt(year),
        },
      },
      // Lookup to join with ElectionCandidate collection
      {
        $lookup: {
          from: 'electioncandidates',
          localField: '_id',
          foreignField: 'election',
          as: 'candidates',
        },
      },
      // Unwind the candidates array
      { $unwind: '$candidates' },
      // Match only Won/Lost candidates
      {
        $match: {
          'candidates.status': { $in: ['Won', 'Lost'] },
        },
      },
      // Lookup to get candidate details
      {
        $lookup: {
          from: 'candidates',
          localField: 'candidates.candidate',
          foreignField: '_id',
          as: 'candidateDetails',
        },
      },
      // Unwind candidateDetails
      { $unwind: '$candidateDetails' },
      // Lookup to get party details
      {
        $lookup: {
          from: 'parties',
          localField: 'candidateDetails.party',
          foreignField: '_id',
          as: 'partyDetails',
        },
      },
      // Unwind partyDetails
      { $unwind: '$partyDetails' },
      // Only return hot candidates (regardless of candidateName parameter)
      {
        $match: {
          'candidateDetails.hotCandidate': true,
        },
      },
      // Optional party name filter
      ...(party
        ? [
            {
              $match: {
                'partyDetails.party': party,
              },
            },
          ]
        : []),
      // Optional candidate name filter
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
      // Project the required fields
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
          // votesReceived: "$candidates.votesReceived",
          // electionYear: "$year",
        },
      },
      // Sort by votes in descending order
      { $sort: { votesReceived: -1 } },
    ];

    const results = await this.ElectionModel.aggregate(aggregationPipeline);

    if (!results || results.length === 0) {
      throw new NotFoundException(
        'No hot candidates found matching the criteria',
      );
    }
    const response = {
      success: true,
      data: results,
    };
    await this.redis.set(key, JSON.stringify(response));
    return response;
  }

  async getCandidatesList(
    state: string,
    year: string,
    constituencyId: string | undefined,
  ) {
    if (!state || !year) {
      throw new BadRequestException('State and year are required parameters');
    }

    // Convert year to number
    const yearNum = parseInt(year);
    const constituencyIdNum = constituencyId ? parseInt(constituencyId) : null;

    console.log('vefore');

    // Aggregation pipeline
    const pipeline = [
      // Stage 1: Match the election first
      {
        $lookup: {
          from: 'tempelections',
          let: { electionState: state, electionYear: yearNum },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$state', '$$electionState'] },
                    { $eq: ['$year', '$$electionYear'] },
                  ],
                },
              },
            },
          ],
          as: 'election',
        },
      },
      // Unwind the election array (since lookup returns an array)
      { $unwind: '$election' },

      // Stage 2: Handle constituency if provided
      ...(constituencyIdNum
        ? [
            {
              $lookup: {
                from: 'constituencies',
                let: { constId: constituencyIdNum, constState: state },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ['$constituencyId', '$$constId'] },
                          { $eq: ['$state', '$$constState'] },
                        ],
                      },
                    },
                  },
                ],
                as: 'constituency',
              },
            },
            { $unwind: '$constituency' },
            {
              $match: {
                constituency: { $exists: true, $ne: null },
              },
            },
          ]
        : []),

      // Stage 3: Lookup election candidates
      {
        $lookup: {
          from: 'electioncandidates',
          let: {
            electionId: '$election._id',
            ...(constituencyIdNum
              ? { constituencyId: '$constituency._id' }
              : {}),
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$election', '$$electionId'] },
                    ...(constituencyIdNum
                      ? [{ $eq: ['$constituency', '$$constituencyId'] }]
                      : []),
                  ],
                },
              },
            },
            // Populate candidate details
            {
              $lookup: {
                from: 'candidates',
                localField: 'candidate',
                foreignField: '_id',
                as: 'candidate',
              },
            },
            { $unwind: '$candidate' },
            // Populate party details
            {
              $lookup: {
                from: 'parties',
                localField: 'candidate.party',
                foreignField: '_id',
                as: 'candidate.party',
              },
            },
            { $unwind: '$candidate.party' },
            // Populate constituency if not already in pipeline
            ...(!constituencyIdNum
              ? [
                  {
                    $lookup: {
                      from: 'constituencies',
                      localField: 'constituency',
                      foreignField: '_id',
                      as: 'constituency',
                    },
                  },
                  { $unwind: '$constituency' },
                ]
              : []),
          ],
          as: 'candidates',
        },
      },

      // Stage 4: Project the final result
      {
        $project: {
          _id: 0,
          election: {
            id: '$election._id',
            state: '$election.state',
            year: '$election.year',
            type: '$election.electionType',
            totalSeats: '$election.totalSeats',
          },
          ...(constituencyIdNum
            ? {
                constituency: {
                  id: '$constituency._id',
                  name: '$constituency.name',
                  constituencyId: '$constituency.constituencyId',
                },
              }
            : {}),
          candidates: {
            $map: {
              input: '$candidates',
              as: 'c',
              in: {
                candidate: {
                  id: '$$c.candidate._id',
                  name: '$$c.candidate.name',
                  party: {
                    id: '$$c.candidate.party._id',
                    name: '$$c.candidate.party.party',
                    logo: '$$c.candidate.party.party_logo',
                    // Add other party fields as needed
                  },
                },
                ...(!constituencyIdNum
                  ? {
                      constituency: {
                        id: '$$c.constituency._id',
                        name: '$$c.constituency.name',
                        constituencyId: '$$c.constituency.constituencyId',
                      },
                    }
                  : {}),
                votesReceived: '$$c.votesReceived',
                status: '$$c.status',
              },
            },
          },
        },
      },
    ];
    const result = await this.ElectionModel.aggregate(pipeline);

    console.log('after', result);

    if (result.length === 0) {
      throw new BadRequestException('No data found for the given parameters');
    }

    return {
      success: true,
      data: result[0], // Since we're querying for one election, take the first result
    };
  }

  async getHotCandidates(state: string, year: string) {
    try {
      if (!state || !year) {
        throw new BadRequestException('State and year are required parameters');
      }

      const key = `widget_bihar_hot_candidate_${state}_${year}`;
      const cachedResults = await this.redis.get(key);

      if (cachedResults) {
        return JSON.parse(cachedResults);
      }

      const result = await this.ElectionModel.aggregate([
        // Match the election
        { $match: { state: state, year: Number(year) } },

        // Lookup candidates with population
        {
          $lookup: {
            from: 'candidates',
            let: { candidateIds: '$electionInfo.candidates' },
            pipeline: [
              {
                $match: {
                  $expr: { $in: ['$_id', '$$candidateIds'] },
                  hotCandidate: true,
                },
              },
              // Populate party
              {
                $lookup: {
                  from: 'parties',
                  localField: 'party',
                  foreignField: '_id',
                  as: 'party',
                  pipeline: [
                    { $project: { party: 1, color_code: 1 } }, // Only get party name and color
                  ],
                },
              },
              // Populate constituency
              {
                $lookup: {
                  from: 'constituencies',
                  localField: 'constituency',
                  foreignField: '_id',
                  as: 'constituency',
                  pipeline: [
                    { $project: { name: 1 } }, // Only get constituency name
                  ],
                },
              },
              // Project only needed fields
              {
                $project: {
                  name: 1,
                  image: 1,
                  party: { $arrayElemAt: ['$party', 0] }, // Unwind party
                  constituency: { $arrayElemAt: ['$constituency', 0] }, // Get first constituency
                },
              },
            ],
            as: 'hotCandidates',
          },
        },

        // Project final structure
        {
          $project: {
            _id: 0,
            hotCandidates: {
              name: 1,
              image: 1,
              'party.party': 1,
              'party.color_code': 1,
              'constituency.name': 1,
            },
          },
        },
      ]);

      if (!result.length) {
        throw new BadRequestException('Election not found');
      }
      this.redis.set(
        key,
        JSON.stringify({
          success: true,
          data: result[0].hotCandidates,
        }),
      );

      return {
        success: true,
        data: result[0].hotCandidates,
      };
    } catch (error) {
      console.error('Error:', error);
      throw new HttpException(
        'Failed to retrieve parties',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getTopCandidates(state: string | undefined, year: string | undefined) {
    try {
      if (!state || !year) {
        throw new BadRequestException(
          'State, year are required query parameters',
        );
      }

      const key = `widget_bihar_election_map_${state}_${year}`;
      const cachedResults = await this.redis.get(key);

      if (cachedResults) {
        return JSON.parse(cachedResults);
      }

      // First, find the election to get its ID
      const election = (await this.ElectionModel.findOne({
        state: state,
        year: parseInt(year),
      }).lean()) as any; // Type assertion to fix property access errors

      if (!election) {
        throw new BadRequestException('Election not found');
      }
      const type = election.electionType;

      // Get all participating parties first
      const allParties = await this.partyElectionModel.aggregate([
        { $match: { election: election._id } },
        {
          $lookup: {
            from: 'parties',
            localField: 'party',
            foreignField: '_id',
            as: 'partyData',
          },
        },
        { $unwind: '$partyData' },
        {
          $project: {
            _id: 0,
            partyName: '$partyData.party',
            seatsWon: '$seatsWon',
            partyColor: '$partyData.color_code',
          },
        },
        { $sort: { seatsWon: -1 } },
      ]);

      // Get constituency data with top candidates
      const constituencies = await this.electionCandidateModel.aggregate([
        { $match: { election: election._id } },
        { $sort: { constituency: 1, votesReceived: -1 } },
        {
          $lookup: {
            from: 'candidates',
            localField: 'candidate',
            foreignField: '_id',
            as: 'candidate',
          },
        },
        { $unwind: '$candidate' },
        {
          $lookup: {
            from: 'parties',
            localField: 'candidate.party',
            foreignField: '_id',
            as: 'party',
          },
        },
        { $unwind: '$party' },
        {
          $lookup: {
            from: 'constituencies',
            localField: 'constituency',
            foreignField: '_id',
            as: 'constituency',
          },
        },
        { $unwind: '$constituency' },
        {
          $group: {
            _id: '$constituency._id',
            constituencyName: { $first: '$constituency.name' },
            constituencyId: { $first: '$constituency.constituencyId' },

            candidates: {
              $push: {
                name: '$candidate.name',
                partyName: '$party.party',
                votesReceived: '$votesReceived',
                status: '$status',
                partyColor: '$party.color_code',
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            constituencyName: 1,
            constituencyId: 1,
            candidates: { $slice: ['$candidates', 2] },
          },
        },
      ]);

      this.redis.set(
        key,
        JSON.stringify({
          success: true,
          data: {
            electionId: election._id,
            electionName: `${state} ${type} election ${year}`,
            totalSeats: election.totalSeats,
            halfWayMark: election.halfWayMark,
            constituencies: constituencies,
            parties: allParties,
          },
        }),
      );

      return {
        success: true,
        data: {
          electionId: election._id,
          electionName: `${state} ${type} election ${year}`,
          totalSeats: election.totalSeats,
          halfWayMark: election.halfWayMark,
          constituencies: constituencies,
          parties: allParties,
        },
      };
    } catch (error) {
      console.error('Error:', error);
      throw new HttpException(
        'Failed to retrieve parties',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

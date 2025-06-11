import { Controller, Get, Query, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { CandidateSchema } from './candidate.schema';
import { PartySchema } from './party.schema';
import { ElectionCandidateSchema } from './election-candidate.schema';
import { TempElectionSchema } from "./temp-election.schema"

@Controller('election')
export class ElectionController {
  constructor(
    @InjectModel('Candidate') private candidateModel: Model<typeof CandidateSchema>,
    @InjectModel('Party') private partyModel: Model<typeof PartySchema>,
    @InjectModel('ElectionCandidate') private electionCandidateModel: Model<typeof ElectionCandidateSchema>,
    @InjectModel('TempElection') private tempElectionModel: Model<typeof TempElectionSchema>,
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

  @Get('candidates')
  async getCandidatesList(
    @Res() res: Response,
    @Query('state') state: string,
    @Query('constituencyId') constituencyId?: string,
    @Query('year') year?: string,
  ){
	  try {
	  	
		if (!state || !year) {
			return res.status(400).json({
				success: false,
				message: "State and year are required parameters",
			});
		}

		// Convert year to number
		const yearNum = parseInt(year);
		const constituencyIdNum = constituencyId ? parseInt(constituencyId) : null;

		// Aggregation pipeline
		const pipeline = [
			// Stage 1: Match the election first
			{
				$lookup: {
					from: "tempelections",
					let: { electionState: state, electionYear: yearNum },
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [
										{ $eq: ["$state", "$$electionState"] },
										{ $eq: ["$year", "$$electionYear"] },
									],
								},
							},
						},
					],
					as: "election",
				},
			},
			// Unwind the election array (since lookup returns an array)
			{ $unwind: "$election" },

			// Stage 2: Handle constituency if provided
			...(constituencyIdNum
				? [
					{
						$lookup: {
							from: "constituencies",
							let: { constId: constituencyIdNum, constState: state },
							pipeline: [
								{
									$match: {
										$expr: {
											$and: [
												{ $eq: ["$constituencyId", "$$constId"] },
												{ $eq: ["$state", "$$constState"] },
											],
										},
									},
								},
							],
							as: "constituency",
						},
					},
					{ $unwind: "$constituency" },
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
					from: "electioncandidates",
					let: {
						electionId: "$election._id",
						...(constituencyIdNum
							? { constituencyId: "$constituency._id" }
							: {}),
					},
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [
										{ $eq: ["$election", "$$electionId"] },
										...(constituencyIdNum
											? [{ $eq: ["$constituency", "$$constituencyId"] }]
											: []),
									],
								},
							},
						},
						// Populate candidate details
						{
							$lookup: {
								from: "candidates",
								localField: "candidate",
								foreignField: "_id",
								as: "candidate",
							},
						},
						{ $unwind: "$candidate" },
						// Populate party details
						{
							$lookup: {
								from: "parties",
								localField: "candidate.party",
								foreignField: "_id",
								as: "candidate.party",
							},
						},
						{ $unwind: "$candidate.party" },
						// Populate constituency if not already in pipeline
						...(!constituencyIdNum
							? [
								{
									$lookup: {
										from: "constituencies",
										localField: "constituency",
										foreignField: "_id",
										as: "constituency",
									},
								},
								{ $unwind: "$constituency" },
							]
							: []),
					],
					as: "candidates",
				},
			},

			// Stage 4: Project the final result
			{
				$project: {
					_id: 0,
					election: {
						id: "$election._id",
						state: "$election.state",
						year: "$election.year",
						type: "$election.electionType",
						totalSeats: "$election.totalSeats",
					},
					...(constituencyIdNum
						? {
							constituency: {
								id: "$constituency._id",
								name: "$constituency.name",
								constituencyId: "$constituency.constituencyId",
							},
						}
						: {}),
					candidates: {
						$map: {
							input: "$candidates",
							as: "c",
							in: {
								candidate: {
									id: "$$c.candidate._id",
									name: "$$c.candidate.name",
									party: {
										id: "$$c.candidate.party._id",
										name: "$$c.candidate.party.party",
										logo: "$$c.candidate.party.party_logo",
										// Add other party fields as needed
									},
								},
								...(!constituencyIdNum
									? {
										constituency: {
											id: "$$c.constituency._id",
											name: "$$c.constituency.name",
											constituencyId: "$$c.constituency.constituencyId",
										},
									}
									: {}),
								votesReceived: "$$c.votesReceived",
								status: "$$c.status",
							},
						},
					},
				},
			},
		];

		const result = await this.tempElectionModel.aggregate(pipeline);

		if (result.length === 0) {
			return res.status(404).json({
				success: false,
				message: "No data found for the given parameters",
			});
		}

		res.json({
			success: true,
			data: result[0], // Since we're querying for one election, take the first result
		});
	  } catch (error) {
	  	
	  }
  }

  @Get('hot-candidates')
  async getHotCandidates(
	@Res() res: Response,
	@Query('state') state: String,
	@Query('year') year: String
  ){
	try {

		if(!state || !year){
			return res.status(400).json({
				success: false,
				message: "State and year are required parameters",
			});
		}

		const key = `widget_bihar_hot_candidate_${state}_${year}`;
		const cachedResults = await this.redis.get(key);

		if (cachedResults) {
			return res.json(JSON.parse(cachedResults));
		}

		const result = await this.tempElectionModel.aggregate([
			// Match the election
			{ $match: { state: state, year: Number(year) } },

			// Lookup candidates with population
			{
				$lookup: {
					from: "candidates",
					let: { candidateIds: "$electionInfo.candidates" },
					pipeline: [
						{
							$match: {
								$expr: { $in: ["$_id", "$$candidateIds"] },
								hotCandidate: true,
							},
						},
						// Populate party
						{
							$lookup: {
								from: "parties",
								localField: "party",
								foreignField: "_id",
								as: "party",
								pipeline: [
									{ $project: { party: 1, color_code: 1 } }, // Only get party name and color
								],
							},
						},
						// Populate constituency
						{
							$lookup: {
								from: "constituencies",
								localField: "constituency",
								foreignField: "_id",
								as: "constituency",
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
								party: { $arrayElemAt: ["$party", 0] }, // Unwind party
								constituency: { $arrayElemAt: ["$constituency", 0] }, // Get first constituency
							},
						},
					],
					as: "hotCandidates",
				},
			},

			// Project final structure
			{
				$project: {
					_id: 0,
					hotCandidates: {
						name: 1,
						image: 1,
						"party.party": 1,
						"party.color_code": 1,
						"constituency.name": 1,
					},
				},
			},
		]);


		if (!result.length) {
			return res.status(404).json({
				success: false,
				message: "Election not found",
			});
		}
		this.redis.set(key, JSON.stringify({
			success: true,
			data: result[0].hotCandidates,
		}));

		return res.json({
			success: true,
			data: result[0].hotCandidates,
		});
	} catch (error) {
		console.error("Error:", error);
		res.status(500).json({
			success: false,
			message: "Internal server error",
		});
	}

  }
} 
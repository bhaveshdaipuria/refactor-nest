import { Controller, Get, Query, Res, HttpStatus, Param, Req } from "@nestjs/common";
import { Response, Request } from "express";
import { InjectModel } from "@nestjs/mongoose";
import { Model, PipelineStage } from "mongoose";
import { RedisManager } from "../config/redis.manager";
import { ElectionCandidateSchema } from "../schemas/candidate-election.schema";
import { TempElectionSchema } from "../schemas/temp-election.schema";
import { ElectionPartyResultSchema } from "../schemas/party-election.schema";

@Controller('')
export class ElectionController {
	constructor(
		@InjectModel("ElectionCandidate")
		private electionCandidateModel: Model<typeof ElectionCandidateSchema>,
		@InjectModel("ElectionPartyResult")
		private partyElectionModel: Model<typeof ElectionPartyResultSchema>,
		@InjectModel("TempElection")
		private tempElectionModel: Model<typeof TempElectionSchema>,
		private readonly redisManager: RedisManager
	) { }

	@Get("election/hot-candidate/result")
	async getHotCandidateResult(
		@Res() res: Response,
		@Query("year") year: string,
		@Query("party") party?: string,
		@Query("candidateName") candidateName?: string,
	) {
		try {
			if (!year) {
				return res.status(HttpStatus.BAD_REQUEST).json({
					success: false,
					message: "Year parameter is required",
				});
			}

			let key = `widget_bihar_hot_candidate_result_${year}`;

			if (party) {
				key += `_${party}`;
			}
			if (candidateName) {
				key += `_${candidateName}`;
			}

			const cachedResults = await this.redisManager.get(key);

			if (cachedResults) {
				return res.json(JSON.parse(cachedResults));
			}

			const aggregationPipeline: PipelineStage[] = [
				{
					$match: {
						status: "completed",
						year: parseInt(year),
					},
				},
				{
					$lookup: {
						from: "electioncandidates",
						localField: "_id",
						foreignField: "election",
						as: "candidates",
					},
				},
				{ $unwind: "$candidates" },
				{
					$match: {
						"candidates.status": { $in: ["Won", "Lost"] },
					},
				},
				{
					$lookup: {
						from: "candidates",
						localField: "candidates.candidate",
						foreignField: "_id",
						as: "candidateDetails",
					},
				},
				{ $unwind: "$candidateDetails" },
				{
					$lookup: {
						from: "parties",
						localField: "candidateDetails.party",
						foreignField: "_id",
						as: "partyDetails",
					},
				},
				{ $unwind: "$partyDetails" },
				{
					$match: {
						"candidateDetails.hotCandidate": true,
					},
				},
				...(party
					? [
						{
							$match: {
								"partyDetails.party": party,
							},
						},
					]
					: []),
				...(candidateName
					? [
						{
							$match: {
								"candidateDetails.name": {
									$regex: candidateName,
									$options: "i",
								},
							},
						},
					]
					: []),
				{
					$project: {
						_id: 0,
						name: "$candidateDetails.name",
						candidateImage: "$candidateDetails.image",
						party: {
							name: "$partyDetails.party",
							color_code: "$partyDetails.color_code",
							logo: "$partyDetails.party_logo",
						},
						status: "$candidates.status",
					},
				},
				{ $sort: { votesReceived: -1 } },
			];

			const results =
				await this.tempElectionModel.aggregate(aggregationPipeline);

			if (!results || results.length === 0) {
				return res.status(HttpStatus.NOT_FOUND).json({
					success: false,
					message: "No hot candidates found matching the criteria",
				});
			}

			const response = {
				success: true,
				data: results,
			};

			await this.redisManager.set(key, JSON.stringify(response));

			return res.status(HttpStatus.OK).json(response);
		} catch (error) {
			console.error("Error:", error);
			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
				success: false,
				message: "Internal server error",
			});
		}
	}

	@Get("election/candidates")
	async getCandidatesList(
		@Res() res: Response,
		@Query("state") state: string,
		@Query("constituencyId") constituencyId?: string,
		@Query("year") year?: string,
	) {
		try {
			if (!state || !year) {
				return res.status(400).json({
					success: false,
					message: "State and year are required parameters",
				});
			}

			// Convert year to number
			const yearNum = parseInt(year);
			const constituencyIdNum = constituencyId
				? parseInt(constituencyId)
				: null;

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
		} catch (error) { }
	}

	@Get("election/hot-candidates")
	async getHotCandidates(
		@Res() res: Response,
		@Query("state") state: String,
		@Query("year") year: String,
	) {
		try {
			if (!state || !year) {
				return res.status(400).json({
					success: false,
					message: "State and year are required parameters",
				});
			}

			const key = `widget_bihar_hot_candidate_${state}_${year}`;
			const cachedResults = await this.redisManager.get(key);

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
			this.redisManager.set(
				key,
				JSON.stringify({
					success: true,
					data: result[0].hotCandidates,
				}),
			);

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

	@Get("elections/map/top-candidates")
	async getTopCandidates(
		@Res() res: Response,
		@Query("state") state?: string,
		@Query("year") year?: string,
	) {
		try {
			if (!state || !year) {
				return res.status(400).json({
					success: false,
					message: "State, year are required query parameters",
				});
			}

			const key = `widget_bihar_election_map_${state}_${year}`;
			const cachedResults = await this.redisManager.get(key);

			if (cachedResults) {
				return res.json(JSON.parse(cachedResults));
			}

			// First, find the election to get its ID
			const election = (await this.tempElectionModel
				.findOne({
					state: state,
					year: parseInt(year),
				})
				.lean()) as any; // Type assertion to fix property access errors

			if (!election) {
				return res.status(404).json({
					success: false,
					message: "Election not found",
				});
			}
			const type = election.electionType;

			// Get all participating parties first
			const allParties = await this.partyElectionModel.aggregate([
				{ $match: { election: election._id } },
				{
					$lookup: {
						from: "parties",
						localField: "party",
						foreignField: "_id",
						as: "partyData",
					},
				},
				{ $unwind: "$partyData" },
				{
					$project: {
						_id: 0,
						partyName: "$partyData.party",
						seatsWon: "$seatsWon",
						partyColor: "$partyData.color_code",
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
						from: "candidates",
						localField: "candidate",
						foreignField: "_id",
						as: "candidate",
					},
				},
				{ $unwind: "$candidate" },
				{
					$lookup: {
						from: "parties",
						localField: "candidate.party",
						foreignField: "_id",
						as: "party",
					},
				},
				{ $unwind: "$party" },
				{
					$lookup: {
						from: "constituencies",
						localField: "constituency",
						foreignField: "_id",
						as: "constituency",
					},
				},
				{ $unwind: "$constituency" },
				{
					$group: {
						_id: "$constituency._id",
						constituencyName: { $first: "$constituency.name" },
						constituencyId: { $first: "$constituency.constituencyId" },

						candidates: {
							$push: {
								name: "$candidate.name",
								partyName: "$party.party",
								votesReceived: "$votesReceived",
								status: "$status",
								partyColor: "$party.color_code",
							},
						},
					},
				},
				{
					$project: {
						_id: 0,
						constituencyName: 1,
						constituencyId: 1,
						candidates: { $slice: ["$candidates", 2] },
					},
				},
			]);

			this.redisManager.set(
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

			res.status(200).json({
				success: true,
				data: {
					electionId: election._id,
					electionName: `${state} ${type} election ${year}`,
					totalSeats: election.totalSeats,
					halfWayMark: election.halfWayMark,
					constituencies: constituencies,
					parties: allParties,
				},
			});
		} catch (error) {
			console.error("Error:", error);
			res.status(500).json({
				success: false,
				message: "Internal server error",
			});
		}
	}
	@Get('elections/state-elections')
	async getStateElections(
		@Res() res: Response, 
		@Query('state') state: string,
	){
		try {

		if (!state) {
			return res.status(400).json({ message: "State parameter is required" });
		}

		const cachedResults = await this.redisManager.get("widget_election_widget");

		if (cachedResults) {
			return res.json(cachedResults);
		}

		const results: any = await this.tempElectionModel.aggregate([
			// Match elections for the requested state
			{ $match: { state } },

			// Sort by year ascending
			{ $sort: { year: 1 } },

			// Lookup party results for each election
			{
				$lookup: {
					from: "electionpartyresults",
					localField: "_id",
					foreignField: "election",
					as: "partyResults",
				},
			},

			// Unwind the party results array
			{ $unwind: { path: "$partyResults", preserveNullAndEmptyArrays: true } },

			// Lookup party details for each result
			{
				$lookup: {
					from: "parties",
					localField: "partyResults.party",
					foreignField: "_id",
					as: "partyResults.partyDetails",
				},
			},

			// Unwind the party details (since lookup returns an array)
			{
				$unwind: {
					path: "$partyResults.partyDetails",
					preserveNullAndEmptyArrays: true,
				},
			},

			// Group back by election and collect party results
			{
				$group: {
					_id: "$_id",
					year: { $first: "$year" },
					state: { $first: "$state" },
					electionType: { $first: "$electionType" },
					totalSeats: { $first: "$totalSeats" },
					halfWayMark: { $first: "$halfWayMark" },
					status: { $first: "$status" },
					parties: {
						$push: {
							$cond: [
								{ $ne: ["$partyResults", {}] },
								{
									party: {
										party: "$partyResults.partyDetails.party",
										color_code: "$partyResults.partyDetails.color_code",
										party_logo: "$partyResults.partyDetails.party_logo",
									},
									seatsWon: "$partyResults.seatsWon",
								},
								null,
							],
						},
					},
				},
			},

			// Filter out null values from parties array
			{
				$addFields: {
					parties: {
						$filter: {
							input: "$parties",
							as: "party",
							cond: { $ne: ["$$party", null] },
						},
					},
				},
			},

			{
				$addFields: {
					parties: {
						$sortArray: {
							input: "$parties",
							sortBy: { seatsWon: -1 },
						},
					},
				},
			},

			// Project to clean up the output
			{
				$project: {
					_id: 0,
					year: 1,
					state: 1,
					electionType: 1,
					totalSeats: 1,
					halfWayMark: 1,
					status: 1,
					parties: 1,
				},
			},
		]);

		if (!results || results.length === 0) {
			return res
				.status(404)
				.json({ message: "No elections found for the specified state" });
		}

		this.redisManager.set("widget_election_widget", results);

		res.json(results);
		} catch (error) {
		console.error("Error fetching state elections:", error);
		res.status(500).json({ message: "Internal server error" });
			
		}
	}

	@Get('election/years/:state')
	async electionYears(
		@Res() res: Response,
		@Param() params: {state: string}
	){
		const {state} = params
		try {
		if (!state) {
			return res.status(400).json({
				success: false,
				message: "State parameter is required",
			});
		}
		const key = `election_state_years:${state}`;
		const cachedResults = await this.redisManager.get(key);

		if (cachedResults) {
			return res.json(JSON.parse(cachedResults));
		}

		const result = await this.tempElectionModel.aggregate([
			{
				$match: {
					state: state,
				},
			},
			{
				$group: {
					_id: null,
					availableYears: { $addToSet: "$year" },
				},
			},
			{
				$project: {
					_id: 0,
					availableYears: {
						$sortArray: {
							input: "$availableYears",
							sortBy: -1, // -1 for descending (most recent first), 1 for ascending
						},
					},
				},
			},
		]);

		this.redisManager.set(key, JSON.stringify({
			success: true,
			data: {
				state: state,
				availableYears: result[0].availableYears,
			},
		}));

		if (result.length === 0 || result[0].availableYears.length === 0) {
			return res.status(404).json({
				success: false,
				message: "No election data found for the given state",
			});
		}

		res.json({
			success: true,
			data: {
				state: state,
				availableYears: result[0].availableYears,
			},
		});

			
		} catch (error) {
		console.error("Error fetching available years:", error);
		res.status(500).json({
			success: false,
			message: "Internal server error",
		});
		}
	}

	@Get(':electionId/candidates')
	async getCandidateDetails(@Req() req: Request & { userRole: string, allowedConst: string[] }, @Param('electionId') electionId: string) {
		const query: any = { electionId };

		// If user is not admin/superadmin, restrict to their allowed constituencies
		if (req.userRole === 'user' && req.allowedConst?.length) {
			query.constituencyId = { $in: req.allowedConst };
		}

		return this.electionCandidateModel.find(query).exec();
	}
}

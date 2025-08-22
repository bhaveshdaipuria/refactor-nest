import { Injectable } from "@nestjs/common";
import { Response, Request, NextFunction } from "express";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { TempElectionSchema } from "src/schemas/temp-election.schema";
import { constituencySchema } from "src/schemas/constituency.schema";
import { ConstituencyElectionSchema } from "src/schemas/constituency-election.schema";
import { candidateSchema } from "src/schemas/candidates.schema";
import { ElectionCandidateSchema } from "src/schemas/candidate-election.schema";
import { partySchema } from "src/schemas/party.schema";
import { electionSchema } from "src/schemas/assembly-election.schema";
import { ElectionPartyResultSchema } from "src/schemas/party-election.schema";
import { userSchema } from "src/schemas/user.schema";
import { ElectionSchema } from "src/schemas/election.schema";
import mongoose from "mongoose";
import { allianceSchema } from "src/schemas/alliance.schema";
import { RedisManager } from "../config/redis.manager";

@Injectable()
export class DashBoardService {
	constructor(
		@InjectModel("TempElection")
		private tempElectionModel: Model<typeof TempElectionSchema>,
		@InjectModel("Election")
		private electionModel: Model<typeof ElectionSchema>,
		@InjectModel("Constituency")
		private constituencyModel: Model<typeof constituencySchema>,
		@InjectModel("ElectionConstituency")
		private electionConsituencyModel: Model<typeof ConstituencyElectionSchema>,
		@InjectModel("Candidate")
		private candidateModel: Model<typeof candidateSchema>,
		@InjectModel("ElectionCandidate")
		private electionCandidateModel: Model<typeof ElectionCandidateSchema>,
		@InjectModel("Party")
		private partyModel: Model<typeof partySchema>,
		@InjectModel("ElectionPartyResult")
		private electionPartyResultModel: Model<typeof ElectionPartyResultSchema>,
		@InjectModel("User")
		private userModel: Model<typeof userSchema>,
		@InjectModel("AssemblyElection")
		private assemblyElectionModel: Model<typeof electionSchema>,
		@InjectModel("Alliance")
		private allianceModel: Model<typeof allianceSchema>,
		private readonly redisManager: RedisManager,
	) { }

	async getCandidateElectionDetails(
		userType: any,
		electionId: any,
		allowedConstituencies: any,
	) {
		const pipeline = [
			{ $match: { election: new mongoose.Types.ObjectId(electionId) } },

			{
				$lookup: {
					from: "candidates",
					localField: "candidate",
					foreignField: "_id",
					as: "candidateInfo",
				},
			},
			{ $unwind: "$candidateInfo" },

			// Add user-specific filtering if needed
			...(userType === "user"
				? [
					{
						$match: {
							"candidateInfo.constituency": {
								$in: allowedConstituencies.map((id) =>
									typeof id === "string"
										? new mongoose.Types.ObjectId(id)
										: id,
								),
							},
						},
					},
				]
				: []),

			// Lookup constituency data
			{
				$lookup: {
					from: "constituencies",
					localField: "candidateInfo.constituency",
					foreignField: "_id",
					as: "constituencyInfo",
				},
			},
			{ $unwind: "$constituencyInfo" },

			// Lookup party data
			{
				$lookup: {
					from: "parties",
					localField: "candidateInfo.party",
					foreignField: "_id",
					as: "partyInfo",
				},
			},
			{ $unwind: { path: "$partyInfo", preserveNullAndEmptyArrays: true } },

			// Lookup votes from electioncandidates
			{
				$lookup: {
					from: "electioncandidates",
					let: { candidateId: "$candidateInfo._id" },
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [
										{
											$eq: [
												"$election",
												new mongoose.Types.ObjectId(electionId),
											],
										},
										{ $eq: ["$candidate", "$$candidateId"] },
									],
								},
							},
						},
						{
							$project: {
								votesReceived: 1,
							},
						},
					],
					as: "voteInfo",
				},
			},
			{
				$unwind: {
					path: "$voteInfo",
					preserveNullAndEmptyArrays: true,
				},
			},

			// Fixed lookup for election constituencies - removed $toObjectId conversion
			{
				$lookup: {
					from: "electionconstituencies",
					let: {
						electionId: new mongoose.Types.ObjectId(electionId),
						constituencyId: "$candidateInfo.constituency", // Directly use the field as it's already an ObjectId
					},
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [
										{ $eq: ["$election", "$$electionId"] },
										{ $eq: ["$constituency", "$$constituencyId"] },
									],
								},
							},
						},
					],
					as: "constituencyElectionStatus",
				},
			},
			{
				$unwind: {
					path: "$constituencyElectionStatus",
					preserveNullAndEmptyArrays: true,
				},
			},

			// Project the final structure with votesReceived
			{
				$project: {
					_id: 1,
					election: 1,
					candidate: {
						_id: "$candidateInfo._id",
						name: "$candidateInfo.name",
						constituency: "$constituencyInfo",
						party: "$partyInfo",
						votesReceived: {
							$ifNull: ["$voteInfo.votesReceived", 0],
						},
					},
					constituencyStatus: {
						$cond: {
							if: { $ifNull: ["$constituencyElectionStatus", false] },
							then: "$constituencyElectionStatus.status",
							else: "unknown",
						},
					},
				},
			},
		];

		// Execute the aggregation
		const candidateElections =
			await this.electionCandidateModel.aggregate(pipeline);

		return candidateElections;
	}

	afterLogin(req: Request, res: Response) {
		if (!req.session.user) {
			return res.redirect("/login");
		}
		res.redirect("/temp-election-list");
	}

	async editElection(req: Request & { session: { user?: any } }, id: string) {
		try {
			const electionId = id;
			console.log(electionId);
			const election = await this.electionModel.findById(electionId);
			console.log(election);
			if (!election) {
				throw new Error("Election not found");
			}
			return { election, user: req.session.user };
		} catch (error) {
			console.error("Error in editElection:", error);
			throw error;
		}
	}

	loginPage(req: Request & { session: { user?: any } }, res: Response) {
		if (req.session.user) {
			return res.redirect("/temp-election-list");
		}
		return res.render("login");
	}

	async accountsList(req: Request, res: Response) {
		const users = await this.userModel.find({}).populate(
			"allowedConstituencies",
			"name",
		);
		const constituencies = await this.constituencyModel.find({}, "_id name");

		console.log(users);

		res.render("accounts-list.ejs", {
			users,
			availableConstituencies: constituencies,
			userRole: req.userRole,
		});
	}

	async createAccount(req: Request, res: Response) {
		const constituencies = await this.constituencyModel.find({}, "_id name");
		res.render("create-accounts.ejs", { constituencies, userRole: req.userRole });
	}

	async createElection(req: Request, res: Response) {
		return res.render("create-election.ejs", { userRole: req.userRole });
	}

	async getAllianceElectionData(electionId: string, req: Request, res: Response) {
		const alliancesData = await this.allianceModel.aggregate([
			// Match alliances for this election
			{ $match: { election: new mongoose.Types.ObjectId(electionId) } },

			{
				$lookup: {
					from: "parties",
					localField: "parties",
					foreignField: "_id",
					as: "populatedParties",
				},
			},

			{ $unwind: "$populatedParties" },

			{
				$lookup: {
					from: "electionpartyresults",
					let: {
						partyId: "$populatedParties._id",
						electionId: "$election",
					},
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [
										{ $eq: ["$party", "$$partyId"] },
										{ $eq: ["$election", "$$electionId"] },
									],
								},
							},
						},
						{ $project: { seatsWon: 1, _id: 0 } },
					],
					as: "partyResults",
				},
			},

			{
				$addFields: {
					seatsWon: {
						$ifNull: [{ $arrayElemAt: ["$partyResults.seatsWon", 0] }, 0],
					},
				},
			},

			{
				$group: {
					_id: "$_id",
					name: { $first: "$name" },
					election: { $first: "$election" },
					parties: {
						$push: {
							$mergeObjects: ["$populatedParties", { seatsWon: "$seatsWon" }],
						},
					},
				},
			},

			{
				$project: {
					_id: 1,
					name: 1,
					election: 1,
					parties: 1,
				},
			},
		]);

		console.log("This is alliances data -> ", alliancesData);
		return res.render("alliance-election", {
			alliancesData,
			userRole: req.userRole,
		});
	}

	async getDashboardData(req: Request, res: Response) {
		if (!req.session.user) {
			return res.redirect("/login");
		}
		if (!req.session.user || req.session.user.role !== "admin") {
			return res.render("dashboard.ejs", {
				error: "you are not authorized to use this resource",
			});
		}
		res.render("dashboard.ejs", { error: null, userRole: req.userRole });
	}

	async getAlliancesData(req: Request, res: Response) {
		const alliances = await this.allianceModel.find()
			.populate("leaderParty", "party")
			.populate("parties")
			.populate("election", "electionSlug");

		res.render("alliance.ejs", { alliances, userRole: req.userRole });
	}

	async getEditAllianceData(req: Request, res: Response, id: string) {
		const alliance = await this.allianceModel.findById(id)
			.populate("parties", "party")
			.populate("leaderParty", "party");

		console.log(alliance);

		const allParties = await this.partyModel.find({}, "_id party");
		res.render("edit-alliance", { alliance, allParties, userRole: req.userRole });
	}

	async getCreateAllianceData(req: Request, res: Response) {
		const ongoingElections = await this.electionModel.find({ status: "ongoing" });
		res.render("create-alliance.ejs", {
			parties: [],
			userRole: req.userRole,
			ongoingElections,
		});
	}

	async getTempCreateElectionData(req: Request, res: Response) {
		const parties = await this.partyModel.find({}, "_id party");
		const candidates = await this.candidateModel.find()
			.populate("party", "party")
			.populate("constituency", "name");
		res.render("temp-create-election.ejs", {
			parties,
			candidates,
			userRole: req.userRole,
		});
	}

	async getTempEditElectionData(req: Request, res: Response, next: NextFunction, id: string) {
		try {
			const electionId = id;

			const election = await this.tempElectionModel.findById(electionId)
				.populate("electionInfo.partyIds")
				.populate({
					path: "electionInfo.candidates",
					populate: [{ path: "party" }, { path: "constituency" }],
				});

			if (!election) {
				return res.status(404).send("Election not found");
			}
			const electionConstituencies = await this.electionConsituencyModel.find({
				election: electionId,
			}).populate("constituency");

			let partyElectionDetails: any;
			let candidateElectionDetails: any;

			if (req.userRole === "user") {
				candidateElectionDetails = await this.getCandidateElectionDetails(
					req.userRole,
					electionId,
					req.allowedConst,
				);

				candidateElectionDetails = candidateElectionDetails.filter(
					(doc: any) => doc.candidate !== null,
				);

				const allowedParties = candidateElectionDetails.map(
					(candidate: any) => candidate.candidate.party._id,
				);

				partyElectionDetails = await this.electionPartyResultModel.find({
					party: { $in: allowedParties },
					election: electionId,
				}).populate("party");
			} else {
				partyElectionDetails = await this.electionPartyResultModel.find({
					election: electionId,
				}).populate("party");

				candidateElectionDetails = await this.getCandidateElectionDetails(
					req.userRole,
					electionId,
					req.allowedConst,
				);
			}

			const partyIdsInElection = partyElectionDetails.map((partyElection) =>
				partyElection.party._id.toString(),
			);

			const candidatesInElection = candidateElectionDetails.map(
				(candidateElection: any) => candidateElection.candidate._id.toString(),
			);

			const allPartiesList = await this.partyModel.find(
				{ _id: { $nin: partyIdsInElection } },
				"party",
			);

			const candidatesQuery = {
				_id: { $nin: candidatesInElection },
				party: { $in: partyIdsInElection },
			};

			const allCandidatesList = await this.candidateModel.find(candidatesQuery, "name")
				.populate("party", "party")
				.populate("constituency", "name");

			res.render("temp-edit-election.ejs", {
				election,
				user: req.session.user,
				partyElectionDetails,
				candidateElectionDetails,
				allPartiesList,
				allCandidatesList,
				electionConstituencies,
				userRole: req.userRole,
			});
		} catch (error) {
			next(error);
		}
	}

	async getTempElectionListData(req: Request, res: Response) {
		try {
			const elections = await this.tempElectionModel.aggregate([
				{
					$lookup: {
						from: "electionpartyresults",
						localField: "electionInfo.partyIds",
						foreignField: "party",
						as: "partyResults",
					},
				},
				{
					$lookup: {
						from: "electioncandidates",
						localField: "electionInfo.candidates",
						foreignField: "candidate",
						as: "candidateResults",
					},
				},
				{
					$lookup: {
						from: "parties",
						localField: "electionInfo.partyIds",
						foreignField: "_id",
						as: "parties",
					},
				},
				{
					$lookup: {
						from: "candidates",
						localField: "electionInfo.candidates",
						foreignField: "_id",
						as: "candidates",
					},
				},
				{
					$lookup: {
						from: "constituencies",
						localField: "candidates.constituency", // Changed from candidates.constituency.0
						foreignField: "_id",
						as: "constituencies",
					},
				},
				{
					$addFields: {
						"electionInfo.partyIds": {
							$map: {
								input: "$parties",
								as: "party",
								in: {
									$mergeObjects: [
										"$$party",
										{
											seatsWon: {
												$let: {
													vars: {
														result: {
															$arrayElemAt: [
																{
																	$filter: {
																		input: "$partyResults",
																		as: "result",
																		cond: {
																			$eq: ["$$result.party", "$$party._id"],
																		},
																	},
																},
																0,
															],
														},
													},
													in: "$$result.seatsWon",
												},
											},
											votes: {
												$sum: {
													$map: {
														input: {
															$filter: {
																input: "$candidates",
																as: "candidate",
																cond: {
																	$eq: ["$$candidate.party", "$$party._id"],
																},
															},
														},
														as: "candidate",
														in: {
															$let: {
																vars: {
																	result: {
																		$arrayElemAt: [
																			{
																				$filter: {
																					input: "$candidateResults",
																					as: "result",
																					cond: {
																						$eq: [
																							"$$result.candidate",
																							"$$candidate._id",
																						],
																					},
																				},
																			},
																			0,
																		],
																	},
																},
																in: "$$result.votesReceived",
															},
														},
													},
												},
											},
										},
									],
								},
							},
						},
						"electionInfo.candidates": {
							$map: {
								input: "$candidates",
								as: "candidate",
								in: {
									$mergeObjects: [
										"$$candidate",
										{
											votesReceived: {
												$let: {
													vars: {
														result: {
															$arrayElemAt: [
																{
																	$filter: {
																		input: "$candidateResults",
																		as: "result",
																		cond: {
																			$eq: [
																				"$$result.candidate",
																				"$$candidate._id",
																			],
																		},
																	},
																},
																0,
															],
														},
													},
													in: "$$result.votesReceived",
												},
											},
											party: {
												$arrayElemAt: [
													{
														$filter: {
															input: "$parties",
															as: "party",
															cond: {
																$eq: ["$$party._id", "$$candidate.party"],
															},
														},
													},
													0,
												],
											},
											constituency: {
												// Changed from array to direct object
												$arrayElemAt: [
													{
														$filter: {
															input: "$constituencies",
															as: "constituency",
															cond: {
																$eq: [
																	"$$constituency._id",
																	"$$candidate.constituency",
																], // Direct comparison now
															},
														},
													},
													0,
												],
											},
										},
									],
								},
							},
						},
					},
				},
				{
					$project: {
						partyResults: 0,
						candidateResults: 0,
						parties: 0,
						candidates: 0,
						constituencies: 0,
					},
				},
			]);
			// console.log(elections[0].electionInfo.candidates[0]);

			// Render the template with the elections data
			res.render("temp-election-list.ejs", { elections, userRole: req.userRole });
		} catch (error) {
			console.error("Error fetching elections:", error);
			res.status(500).render("error.ejs", {
				message: "Failed to fetch elections data",
				error,
			});
		}
	}

	async getPartiesData(req: Request, res: Response) {
		try {
			const parties = await this.partyModel.find(); // Fetch all parties from the database
			return res.render("party.ejs", { parties, userRole: req.userRole });
		} catch (error) {
			console.log(error);
			res.status(500).send("Error fetching parties");
		}
	}

	async getCreatePartyData(req: Request, res: Response) {
		res.render("create-party.ejs", { userRole: req.userRole });
	}

	async getEditPartyData(req: Request, res: Response, next: NextFunction, id: string) {
		try {
			const partyId = id;
			const party = await this.partyModel.findById(partyId);
			if (!party) {
				return res.status(404).send("Party not found");
			}
			res.render("edit-party.ejs", { party, userRole: req.userRole });
		} catch (error) {
			next(error);
		}
	}

	async getConstituencyData(req: Request, res: Response) {
		try {
			const constituencies = await this.constituencyModel.find()
				.populate({
					path: "candidates",
					model: "Candidate",
					populate: {
						path: "party",
						model: "Party",
					},
				})
				.sort({ name: 1 }); // Fetch all constituencies from the database

			return res.render("constituency.ejs", {
				constituencies,
				userRole: req.userRole,
			});
		} catch (error) {
			console.log(error);
			res.status(500).send("Error fetching constituencies");
		}
	}

	async getCreateConstituencyData(req: Request, res: Response) {
		const candidates = await this.candidateModel.find();
		const errorMessages = req.flash("error");
		res.render("create-constituency.ejs", {
			candidates,
			error: errorMessages,
			userRole: req.userRole,
		});
	}

	async getEditConstituencyData(req: Request, res: Response, id: string) {
		try {
			const constituencyId = id;
			const constituency = await this.constituencyModel.findById(constituencyId).populate(
				{
					path: "candidates",
					model: "Candidate",
					populate: {
						path: "party",
						model: "Party",
					},
				},
			);
			if (!constituency) {
				return res.status(404).send("Constituency not found");
			}
			// get all the candidates
			const candidates = await this.candidateModel.find().populate("party");
			res.render("edit-constituency.ejs", {
				constituency,
				candidates,
				error: null,
				userRole: req.userRole,
			});
		} catch (error) {
			console.log(error);
		}
	}

	async getCandidatesData(req: Request, res: Response) {
		try {
			const page = parseInt(req.query.page as string) || 1; // Get the current page number from query params
			const limit = parseInt(req.query.limit as string) || 10; // Set the limit of items per page
			const search = (req.query.search as string) || ""; // Get the search term from query params
			const skip = (page - 1) * limit; // Calculate the number of items to skip

			const cacheKey = `candidates:${page}:${limit}:${search}`; // Cache key based on page, limit, and search term

			// Try to fetch data from Redis cache
			const cachedData: any = await this.redisManager.get(cacheKey);

			if (cachedData) {
				// If data is found in the cache, return it
				return res.render("candidate.ejs", {
					candidates: JSON.parse(cachedData).candidates,
					currentPage: page,
					totalPages: JSON.parse(cachedData).totalPages,
					userRole: req.userRole,
					limit,
					search,
				});
			}

			// Create a search filter for MongoDB
			const searchFilter = search
				? {
					$or: [
						{ name: { $regex: search, $options: "i" } }, // Case-insensitive search in name
						{ "party.name": { $regex: search, $options: "i" } }, // Search in party name
						{ "constituency.name": { $regex: search, $options: "i" } }, // Search in constituency name
					],
				}
				: {};

			// Query the database
			const candidates = await this.candidateModel.find(searchFilter)
				.populate("party constituency")
				.skip(skip) // Skip the items based on pagination
				.limit(limit); // Limit the number of items returned

			const totalCandidates = await this.candidateModel.countDocuments(searchFilter); // Get the total number of candidates matching the search

			// Calculate total pages
			const totalPages = Math.ceil(totalCandidates / limit);

			// Store the data in Redis with TTL of 3600 seconds (1 hour)
			const dataToCache = {
				candidates,
				totalPages,
			};
			await this.redisManager.setWithTTL(cacheKey, dataToCache, 3600);

			return res.render("candidate.ejs", {
				candidates: candidates || [],
				currentPage: page,
				totalPages,
				limit,
				search,
				userRole: req.userRole,
			});
		} catch (error) {
			console.log(error);
			res.status(500).send("Error fetching candidates");
		}
	}

	async getCreateCandidateData(req: Request, res: Response) {
		try {
			const parties = await this.partyModel.find(); // Fetch all parties
			const constituencies = await this.constituencyModel.find(); // Fetch all constituencies
			return res.render("create-candidate.ejs", {
				parties,
				constituencies,
				error: null,
				userRole: req.userRole,
			});
		} catch (error) {
			console.log(error);
			res.status(500).send("Error fetching data for creating candidate");
		}
	}

	async getEditCandidateData(req: Request, res: Response, id: string) {
		try {
			const candidateId = id;
			const candidate =
				await this.candidateModel.findById(candidateId).populate("party constituency");
			if (!candidate) {
				return res.status(404).send("Candidate not found");
			}
			const parties = await this.partyModel.find(); // Fetch all parties
			const constituencies = await this.constituencyModel.find(); // Fetch all constituencies
			res.render("edit-candidate.ejs", {
				candidate,
				parties,
				constituencies,
				userRole: req.userRole,
			});
		} catch (error) {
			console.log(error);
			res.status(500).send("Error fetching data for editing candidate");
		}
	}

	async getCreateAssemblyElectionData(req: Request, res: Response) {
		try {
			const constituencies = await this.constituencyModel.find(); // Fetch all constituencies
			return res.render("create-assembly-election.ejs", {
				constituencies,
				error: null,
			});
		} catch (error) {
			console.log(error);
			res
				.status(500)
				.send("Error fetching data for creating assembly election");
		}
	}

	async getEditAssemblyElectionData(req: Request, res: Response, id: string) {
		try {
			const electionId = id
			const assemblyElection = await this.assemblyElectionModel.findById(electionId);
			if (!assemblyElection) {
				return res.status(404).send("Assembly election not found");
			}
			const elections = await this.electionModel.find(); // Fetch all elections
			const constituencies = await this.constituencyModel.find(); // Fetch all constituencies
			res.render("edit-assembly-election.ejs", {
				assemblyElection,
				elections,
				constituencies,
				userRole: req.userRole,
			});
		} catch (error) {
			console.log(error);
			res.status(500).send("Error fetching data for editing assembly election");
		}
	}

	async getAssemblyElectionData(req: Request, res: Response) {
		try {
			const assemblyElections =
				await this.assemblyElectionModel.find().populate("constituencies"); // Fetch all elections
			res.render("assembly-election.ejs", {
				assemblyElections,
				userRole: req.userRole,
			});
		} catch (error) {
			console.log(error);
			res.status(500).send("Error fetching assembly election");
		}
	}

	async getConsCandidatesData(req: Request, res: Response) {
		try {
			const constituencies = await this.constituencyModel.find().sort({ name: 1 });
			const parties = await this.partyModel.find();

			if (req.query.cons) {
				// Find constituency by name (case-insensitive) and fetch candidates associated with it
				const constituency = await this.constituencyModel.findOne({
					name: { $regex: req.query.cons, $options: "i" },
				});

				// If the constituency does not exist, render empty candidates array
				const candidates = constituency
					? await this.candidateModel.find({ constituency: constituency._id })
						.populate("party")
						.sort({ totalVotes: -1 }) // Sort candidates by totalVotes in descending order
					: [];

				return res.render("cons-candidates.ejs", {
					candidates,
					constituencies,
					parties,
					selectedCons: req.query.cons, // Pass selected constituency name to the template
				});
			}

			// Render with all candidates if no constituency selected
			const candidates = await this.candidateModel.find()
				.populate("party")
				.sort({ totalVotes: -1 }); // Sort all candidates by totalVotes in descending order

			res.render("cons-candidates.ejs", {
				candidates,
				constituencies,
				parties,
				selectedCons: "", // No constituency selected by default
				userRole: req.userRole,
			});
		} catch (error) {
			console.log(error);
			res.status(500).send("Error fetching candidates.");
		}
	}

	async getElectionChatbotData(req: Request, res: Response) {
		try {
			res.render("election-chatbot.ejs", { userRole: req.userRole });
		} catch (error) {
			console.log(error);
			res.status(500).send("Error fetching candidates.");
		}
	}
}
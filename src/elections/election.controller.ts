import { Controller, Get, Req, Res, Post, Param, RequestTimeoutException, Query, Delete, Patch, Put } from "@nestjs/common";
import { Request, Response, NextFunction } from 'express'
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
import { cachedKeys } from "src/utils";
import { RedisManager } from "src/config/redis.manager";
import { allianceSchema } from "src/schemas/alliance.schema";

@Controller("api/elections")
export class ElectionController {
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
  ) {}

  @Get("party-summary")
  async getElectionPartySummary(@Req() req: Request, @Res() res: Response) {
    const fullUrl = req.get("Referer");
    console.log("fullUrl -> ", fullUrl);

    const stateName = { delhi: "दिल्ली 2025", jharkhand: "झारखंड 2024" };

    const state = fullUrl?.includes("delhi")
      ? stateName["delhi"]
      : stateName["jharkhand"];
    try {
      const election: any = await this.electionModel.findOne({
        state: state,
      });

      if (!election) {
        return res.status(404).json({ error: "Election not found" });
      }

      // Filter for BJP+ and JMM+ parties
      // const filteredParties = election.parties.filter(party =>
      //   party.name === 'BJP+' || party.name === 'JMM+'
      // );

      res.status(200).json({
        state: election.state,
        totalSeats: election.totalSeats,
        declaredSeats: election.declaredSeats,
        parties: election.parties,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  }

  @Post('temp-elections')
  async tempElections(@Req() req: Request, @Res() res: Response){
  try {
    const {
      state,
      halfWayMark,
      electionType,
      year,
      totalSeats,
      electionInfo,
      constituencies,
    } = req.body;

    const electionSlug = `${state.toLowerCase()}_${year}`;

    // Check if an election for the given state already exists
    const existingElection = await this.tempElectionModel.findOne({ electionSlug });
    if (existingElection) {
      return res
        .status(409)
        .json({ error: "Election for this state already exists" });
    }

    const election = new this.tempElectionModel({
      state,
      year,
      electionSlug,
      totalSeats,
      electionType,
      halfWayMark,
      electionInfo,
    });

    const savedElection = await election.save();
    if (!savedElection) {
      return res.status(400).json({ message: "Bad request" });
    }
    const parties = electionInfo.partyIds.map(
      (partyId: any) =>
        new this.electionPartyResultModel({
          election: savedElection._id,
          party: partyId,
        })
    );
    await this.electionPartyResultModel.bulkSave(parties);

    const candidates = electionInfo.candidates.map(
      (canId: any) =>
        new this.electionCandidateModel({
          election: savedElection._id,
          candidate: canId,
        })
    );

    const constituencyElections = constituencies.map(
      (constituencyId: any) =>
        new this.electionConsituencyModel({
          election: savedElection._id,
          constituency: constituencyId,
        })
    );

    await this.electionConsituencyModel.bulkSave(constituencyElections);

    await this.electionCandidateModel.bulkSave(candidates);

    return res.status(200).json(savedElection);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }


  }

  @Post()
  async createElection(@Req() req: Request, @Res() res: Response){
  try {
    const { state, totalSeats, declaredSeats, halfWayMark, parties } = req.body;
    const stateSlug = state.toLowerCase().replace(/ /g, "_");

    // Check if an election for the given state already exists
    const existingElection = await this.electionModel.findOne({ stateSlug });
    if (existingElection) {
      return res
        .status(409)
        .json({ error: "Election for this state already exists" });
    }

    const election = new this.electionModel({
      state,
      stateSlug,
      totalSeats,
      declaredSeats,
      halfWayMark,
      parties,
    });

    const savedElection = await election.save();
    await this.redisManager.clearAllKeys(); // Clear all Redis keys when a new election is created
    res.status(201).json(savedElection);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }

  }

  @Get('states')
  async postStates(@Req() req: Request, @Res() res: Response){
  try {
    const states: any = await this.electionModel.find({}).sort({ createdAt: -1 });
    const statesWithSlugs = states.map((state) => ({
      name: state.state,
      slug: state.stateSlug,
      id: state._id,
    }));
    return res.status(200).json({
      message: "States, their slugs, and ids retrieved successfully",
      data: statesWithSlugs,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
  }

  @Get(':id')
  async retrieveElectionData(@Req() req: Request, @Res() res: Response, @Param('id') id: string){
  try {
    // Check if data exists in Redis cache
    const cachedData = await this.redisManager.get(cachedKeys.ASSEMBLY_ELECTION + ":" + id);
    if (cachedData) {
      return res.json(cachedData);
    }

    // Fetch election data from database
    const election: any = await this.electionModel.findById(id);

    if (!election) {
      return res.status(404).json({ message: "Election data not found" });
    }

    // Sort parties and their subParties by 'won' in descending order
    if (election.parties && election.parties.length > 0) {
      election.parties.sort((a: any, b: any) => b.won - a.won); // Sort parties

      election.parties.forEach((party: any) => {
        if (party.subParties && party.subParties.length > 0) {
          party.subParties.sort((a: any, b: any) => b.won - a.won); // Sort subParties
        }
      });
    }

    // Cache the sorted data for 1 hour (3600 seconds)
    await this.redisManager.setWithTTL(
      cachedKeys.ASSEMBLY_ELECTION + ":" + id,
      election,
      3600
    );

    res.status(200).json(election);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }

  }

  @Get()
  async getPage(@Req() req: Request, @Res() res: Response, @Query('page') page: string, @Query('limit') limit: string){
  try {
    const pageInt = parseInt(page) || 1;
    const limitInt = parseInt(limit) || 10;
    const startIndex = (pageInt - 1) * limitInt;
    const endIndex = pageInt * limitInt;

    const elections = await this.electionModel.find().sort({ createdAt: -1 });
    const paginatedData = elections.slice(startIndex, endIndex);

    if (!paginatedData) {
      return res.status(404).json({ message: "No elections found" });
    }

    const result = {
      currentPage: pageInt,
      totalPages: Math.ceil(elections.length / limitInt),
      totalItems: elections.length,
      data: paginatedData,
    };

    return res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }

  }

  @Delete(':id')
  async deleteElection(@Req() req: Request, @Res() res: Response, @Param('id') id: string){
  try {
    const election = await this.electionModel.findByIdAndDelete(id);

    if (!election) {
      return res.status(404).json({ message: "Election not found" });
    }

    await this.redisManager.clearAllKeys(); // Clear Redis cache when an election is deleted

    res.status(200).json({ message: "Election successfully deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
  }

  @Patch('temp-election/constituencies/update-status')
  async updateStatus(@Req() req: Request, @Res() res: Response){
    try {
      const { constituencies, redisKeys } = req.body;

      if (!constituencies || Object.keys(constituencies).length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "No constituency data provided" });
      }

      const updatePromises = Object.entries(constituencies).map(
        ([documentId, status]) => {
          return this.electionConsituencyModel.findByIdAndUpdate(
            documentId,
            { status: status },
            { new: true }
          );
        }
      );

      await Promise.all(updatePromises);

      const { state, year, type } = redisKeys;

      // clear the election widgets cached result from redis
      this.redisManager.delete(`widget_election_widget`);
      this.redisManager.delete(`widget_bihar_election_map_${state}_${year}_${type}`);
      this.redisManager.delete(
        `widget_cn_election_constituencies_${state}_${year}_${type}`
      );
      this.redisManager.deleteByPattern(
        `widget_cn_election_candidates_*_${state}_${year}_${type}`
      );

      return res.json({
        success: true,
        message: "Constituency statuses updated successfully",
      });
    } catch (error) {
      console.error("Error updating constituency statuses:", error);
      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "An error occurred while updating constituency statuses",
      });
    }
  }

  @Patch('temp-election/party/add')
  async addParty(@Req() req: Request, @Res() res: Response){
  try {
    const { election, parties, redisKeys } = req.body;
    const updatedElection = await this.tempElectionModel.findByIdAndUpdate(
      election,
      { $push: { "electionInfo.partyIds": parties } },
      { new: true }
    );
    const newParties = parties.map(
      (partyId: any) => new this.electionPartyResultModel({ election, party: partyId })
    );

    const newAddedParties: any = await this.electionPartyResultModel.bulkSave(newParties);
    if (!updatedElection || newAddedParties.insertedCount === 0) {
      return res.status(400).json({ message: "Bad Request" });
    }

    const { state, year, type } = redisKeys;

    // clear the election widgets cached result from redis
    this.redisManager.delete(`widget_election_widget`);
    this.redisManager.delete(`widget_bihar_election_map_${state}_${year}_${type}`);
    this.redisManager.delete(`widget_cn_election_constituencies_${state}_${year}_${type}`);
    this.redisManager.deleteByPattern(
      `widget_cn_election_candidates_*_${state}_${year}_${type}`
    );

    return res.status(200).json({ message: "Party added successfully" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }

  }

  @Patch('temp-election/main-info-update/:id')
  async mainInfoUpdate(@Req() req: Request, @Res() res: Response, @Param('id') id: string){

  try {
    const { status, state, halfWayMark, totalSeats, year, electionType } =
      req.body;
    console.log(req.body);

    const electionSlug = `${state.toLowerCase()}_${year}`;

    const updatedElectionInfo = await this.tempElectionModel.findByIdAndUpdate(
      id,
      {
        $set: {
          status: status.toLowerCase(),
          state,
          halfWayMark,
          totalSeats,
          year,
          electionSlug,
          electionType,
        },
      },
      { new: true }
    );

    if (!updatedElectionInfo) {
      return res.status(400).json({ message: "Bad Request" });
    }

    // clear the election widgets cached result from redis
    this.redisManager.delete(`widget_election_widget`);
    this.redisManager.delete(`widget_bihar_election_map_${state}_${year}_${electionType}`);
    this.redisManager.delete(
      `widget_cn_election_constituencies_${state}_${year}_${electionType}`
    );
    this.redisManager.deleteByPattern(
      `widget_cn_election_candidates_*_${state}_${year}_${electionType}`
    );

    return res
      .status(200)
      .json({ success: true, message: "Updated Successfully" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }


  }

  @Patch('temp-election/candidate/add')
  async addCandidate(@Req() req: Request, @Res() res: Response){
  try {
    const { election, candidates, redisKeys } = req.body;
    const updatedElection = await this.tempElectionModel.findByIdAndUpdate(
      election,
      { $push: { "electionInfo.candidates": candidates } },
      { new: true }
    );
    const newCandidates = candidates.map(
      (candidateId) =>
        new this.electionCandidateModel({ election, candidate: candidateId })
    );

    const newAddedCandidates = await this.electionCandidateModel.bulkSave(
      newCandidates
    );

    for (let i = 0; i < candidates.length; i++) {
      const candidate: any = await this.electionCandidateModel.findById(candidates[i]).select(
        "constituency"
      );
      const isFound = await this.electionConsituencyModel.findOne({
        election,
        constituency: candidate.constituency[0],
      });
      if (!isFound) {
        await new this.electionConsituencyModel({
          election,
          constituency: candidate.constituency[0],
        }).save();
      }
    }

    console.log(
      "newAddedCandidates.insertedCount -> ",
      newAddedCandidates.insertedCount
    );

    if (
      !updatedElection ||
      newAddedCandidates.insertedCount === 0 ||
      candidates.length <= 0
    ) {
      return res.status(400).json({ message: "Bad Request" });
    }

    const { state, year, type } = redisKeys;

    // clear the election widgets cached result from redis
    this.redisManager.delete(`widget_election_widget`);
    this.redisManager.delete(`widget_bihar_election_map_${state}_${year}_${type}`);
    this.redisManager.delete(`widget_cn_election_constituencies_${state}_${year}_${type}`);
    this.redisManager.deleteByPattern(
      `widget_cn_election_candidates_*_${state}_${year}_${type}`
    );

    return res.status(200).json({ message: "Party added successfully" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }

  }

  @Delete('temp-election/party/delete/:partyId/:electionId')
  async deletePartyFromElection(@Req() req: Request, @Res() res: Response, @Param('partyId') partyId: string, @Param('electionId') electionId: string){ 
    try {
      const { redisKeys } = req.body;

      if (!partyId || !electionId) {
        return res.status(400).json({ message: "Missing required parameters" });
      }

      const deletedPartyElection = await this.electionPartyResultModel.findOneAndDelete({
        election: electionId,
        party: partyId,
      });

      if (!deletedPartyElection) {
        return res.status(400).json({ message: "Party election not found" });
      }

      const election: any = await this.tempElectionModel.findById(electionId).populate({
        path: "electionInfo.candidates",
        match: { party: partyId },
      });

      if (
        election &&
        election.electionInfo &&
        election.electionInfo.candidates
      ) {
        const candidateIds = election.electionInfo.candidates.map(
          (candidate) => candidate._id
        );

        if (candidateIds.length > 0) {
          await this.electionCandidateModel.deleteMany({
            election: electionId,
            candidate: { $in: candidateIds },
          });
        }

        await this.tempElectionModel.findByIdAndUpdate(
          electionId,
          {
            $pull: {
              "electionInfo.candidates": { $in: candidateIds },
              "electionInfo.partyIds": partyId,
            },
          },
          { new: true }
        );
      } else {
        await this.tempElectionModel.findByIdAndUpdate(
          electionId,
          { $pull: { "electionInfo.partyIds": partyId } },
          { new: true }
        );
      }

      const { state, year, type } = redisKeys;

      // clear the election widgets cached result from redis
      this.redisManager.delete(`widget_election_widget`);
      this.redisManager.delete(`widget_bihar_election_map_${state}_${year}_${type}`);
      this.redisManager.delete(
        `widget_cn_election_constituencies_${state}_${year}_${type}`
      );
      this.redisManager.deleteByPattern(
        `widget_cn_election_candidates_*_${state}_${year}_${type}`
      );

      return res.status(200).send({ success: true });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  @Delete('temp-election/candidate/delete/:candidateId/:electionId')
  async deleteCandidateFromElection(@Req() req: Request, @Res() res: Response, @Param('candidateId') candidateId: string, @Param('electionId') electionId: string){

    try {
      const { redisKeys } = req.body;

      if (!candidateId || !electionId) {
        return res.status(400).json({ message: "Missing required parameters" });
      }

      const deletedPartyCandidate =
        await this.electionCandidateModel.findOneAndDelete({
          election: electionId,

          candidate: candidateId,
        });

      if (!deletedPartyCandidate) {
        return res.status(400).json({ message: "Party election not found" });
      }

      await this.tempElectionModel.findByIdAndUpdate(
        electionId,

        { $pull: { "electionInfo.candidates": candidateId } },

        { new: true }
      );

      const { state, year, type } = redisKeys;

      // clear the election widgets cached result from redis
      this.redisManager.delete(`widget_election_widget`);
      this.redisManager.delete(`widget_bihar_election_map_${state}_${year}_${type}`);
      this.redisManager.delete(
        `widget_cn_election_constituencies_${state}_${year}_${type}`
      );
      this.redisManager.deleteByPattern(
        `widget_cn_election_candidates_*_${state}_${year}_${type}`
      );

      return res.status(200).send({ success: true });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  @Put('temp-election/candidate/update')
  async updateCandidateForElection(@Req() req: Request, @Res() res: Response){
  try {
    console.log(req.body);

    const { election, candidate, votesReceived, redisKeys } = req.body;

    const query = {
      election: election,
      candidate: candidate,
    };

    const updatedDocument = await this.electionCandidateModel.findOneAndUpdate(
      query,
      { $set: { votesReceived } },
      { new: true }
    );
    if (!updatedDocument) {
      return res.status(400).json({ message: "Bad Request" });
    }
    console.log(updatedDocument);

    const { state, year, type } = redisKeys;

    // clear the election widgets cached result from redis
    this.redisManager.delete(`widget_election_widget`);
    this.redisManager.delete(`widget_bihar_election_map_${state}_${year}_${type}`);
    this.redisManager.delete(`widget_cn_election_constituencies_${state}_${year}_${type}`);
    this.redisManager.deleteByPattern(
      `widget_cn_election_candidates_*_${state}_${year}_${type}`
    );

    return res.status(200).json(updatedDocument);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
  }

  @Put('temp-election/party/update')
  async updatePartyForElection(@Req() req: Request, @Res() res: Response){
  try {
    const { election, party, seatsWon, redisKeys } = req.body;

    const query = {
      election: election,
      party: party,
    };

    const updatedDocument = await this.electionPartyResultModel.findOneAndUpdate(
      query,
      { $set: { seatsWon } },
      { new: true }
    );
    if (!updatedDocument) {
      return res.status(400).json({ message: "Bad Request" });
    }

    const { state, year, type } = redisKeys;

    // clear the election widgets cached result from redis
    this.redisManager.delete(`widget_election_widget`);
    this.redisManager.delete(`widget_bihar_election_map_${state}_${year}_${type}`);
    this.redisManager.delete(`widget_cn_election_constituencies_${state}_${year}_${type}`);
    this.redisManager.deleteByPattern(
      `widget_cn_election_candidates_*_${state}_${year}_${type}`
    );

    return res.status(200).json(updatedDocument);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
  }


  @Delete('temp-election-delete/:id')
  async deleteTempElection(@Req() req: Request, @Res() res: Response, @Param('id') id: string){
  try {
    const { id } = req.params;
    const election = await this.tempElectionModel.findByIdAndDelete(id);

    await this.electionPartyResultModel.deleteMany({
      election: id,
    });

    await this.electionCandidateModel.deleteMany({
      election: id,
    });

    await this.electionConsituencyModel.deleteMany({
      election: id,
    });

    await this.allianceModel.deleteMany({
      election: id,
    });

    if (!election) {
      return res.status(404).json({ message: "Election not found" });
    }

    res.status(200).json({ message: "Election successfully deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
  }

  @Put(':id')
  async updateTempElection(@Req() req: Request, @Res() res: Response, @Param('id') id: string){

  try {
    const updatedElection = await this.electionModel.findByIdAndUpdate(id, req.body, {
      new: true,
    });

    if (!updatedElection) {
      return res.status(404).json({ message: "Election not found" });
    }

    await this.redisManager.clearAllKeys(); // Clear Redis cache when an election is updated
    res.status(200).json(updatedElection);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
  }


}

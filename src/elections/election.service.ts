import { Injectable, NotFoundException, ConflictException, BadRequestException } from "@nestjs/common";
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
import { GenerateContentResponse, GoogleGenAI } from "@google/genai";
import { ConfigService } from "@nestjs/config";
import { chatbotQuestionSchema } from "src/schemas/chatbot-question.schema";
import { getEmbedding, measureSimilarity, generateChatbotResponse } from "src/utils";
import OpenAI from "openai";

@Injectable()
export class ElectionService {
  private electionChatbot: GoogleGenAI | OpenAI;

  constructor(
    private readonly configService: ConfigService,
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
    @InjectModel("ChatbotQuestion")
    private chatbotQuestionModel: Model<typeof chatbotQuestionSchema>,
    private readonly redisManager: RedisManager,
  ) {
	if(this.configService.get<string>("CURRENT_CHATBOT") === "OPENAI") {
	      this.electionChatbot = new OpenAI({
        apiKey: this.configService.get<string>("OPENAI_KEY"),
	})
	}else{
	    this.electionChatbot = new GoogleGenAI({
	      apiKey: this.configService.get<string>("GEMINI_API_KEY"),
	    });
	}
  }

  async getElectionPartySummary(referer: string) {
    const stateName = { delhi: "दिल्ली 2025", jharkhand: "झारखंड 2024" };
    const state = referer?.includes("delhi")
      ? stateName["delhi"]
      : stateName["jharkhand"];

    const election: any = await this.electionModel.findOne({ state });
    
    if (!election) {
      throw new NotFoundException("Election not found");
    }

    return {
      state: election.state,
      totalSeats: election.totalSeats,
      declaredSeats: election.declaredSeats,
      parties: election.parties,
    };
  }

  async createTempElection(data: {
    state: string;
    halfWayMark: number;
    electionType: string;
    year: number;
    totalSeats: number;
    electionInfo: any;
    constituencies: string[];
  }) {
    const { state, halfWayMark, electionType, year, totalSeats, electionInfo, constituencies } = data;
    const electionSlug = `${state.toLowerCase()}_${year}`;

    // Check if election already exists
    const existingElection = await this.tempElectionModel.findOne({ electionSlug });
    if (existingElection) {
      throw new ConflictException("Election for this state already exists");
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
      throw new BadRequestException("Failed to create election");
    }

    // Create party results
    const parties = electionInfo.partyIds.map(
      (partyId: any) => new this.electionPartyResultModel({
        election: savedElection._id,
        party: partyId,
      })
    );
    await this.electionPartyResultModel.bulkSave(parties);

    // Create candidate elections
    const candidates = electionInfo.candidates.map(
      (canId: any) => new this.electionCandidateModel({
        election: savedElection._id,
        candidate: canId,
      })
    );

    // Create constituency elections
    const constituencyElections = constituencies.map(
      (constituencyId: any) => new this.electionConsituencyModel({
        election: savedElection._id,
        constituency: constituencyId,
      })
    );

    await this.electionConsituencyModel.bulkSave(constituencyElections);
    await this.electionCandidateModel.bulkSave(candidates);

    return savedElection;
  }

  async createElection(data: {
    state: string;
    totalSeats: number;
    declaredSeats: number;
    halfWayMark: number;
    parties: any[];
  }) {
    const { state, totalSeats, declaredSeats, halfWayMark, parties } = data;
    const stateSlug = state.toLowerCase().replace(/ /g, "_");

    // Check if election already exists
    const existingElection = await this.electionModel.findOne({ stateSlug });
    if (existingElection) {
      throw new ConflictException("Election for this state already exists");
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
    await this.redisManager.clearAllKeys();
    return savedElection;
  }

  async getStates() {
    const states: any = await this.electionModel.find({}).sort({ createdAt: -1 });
    return states.map((state) => ({
      name: state.state,
      slug: state.stateSlug,
      id: state._id,
    }));
  }

  async getElectionById(id: string) {
    // Check Redis cache first
    const cachedData = await this.redisManager.get(cachedKeys.ASSEMBLY_ELECTION + ":" + id);
    if (cachedData) {
      return cachedData;
    }

    // Fetch from database
    const election: any = await this.electionModel.findById(id);
    if (!election) {
      throw new NotFoundException("Election data not found");
    }

    // Sort parties and subParties by 'won' in descending order
    if (election.parties && election.parties.length > 0) {
      election.parties.sort((a: any, b: any) => b.won - a.won);
      election.parties.forEach((party: any) => {
        if (party.subParties && party.subParties.length > 0) {
          party.subParties.sort((a: any, b: any) => b.won - a.won);
        }
      });
    }

    // Cache the result
    await this.redisManager.setWithTTL(
      cachedKeys.ASSEMBLY_ELECTION + ":" + id,
      election,
      3600
    );

    return election;
  }

  async getElectionsPaginated(page: number = 1, limit: number = 10) {
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    const elections = await this.electionModel.find().sort({ createdAt: -1 });
    const paginatedData = elections.slice(startIndex, endIndex);

    if (!paginatedData.length) {
      throw new NotFoundException("No elections found");
    }

    return {
      currentPage: page,
      totalPages: Math.ceil(elections.length / limit),
      totalItems: elections.length,
      data: paginatedData,
    };
  }

  async deleteElection(id: string) {
    const election = await this.electionModel.findByIdAndDelete(id);
    if (!election) {
      throw new NotFoundException("Election not found");
    }

    await this.redisManager.clearAllKeys();
    return { message: "Election successfully deleted" };
  }

  async updateConstituencyStatus(constituencies: Record<string, any>, redisKeys: { state: string; year: string; type: string }) {
    if (!constituencies || Object.keys(constituencies).length === 0) {
      throw new BadRequestException("No constituency data provided");
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
    await this.clearElectionCache(redisKeys);

    return { success: true, message: "Constituency statuses updated successfully" };
  }

  async addPartyToElection(election: string, parties: string[], redisKeys: { state: string; year: string; type: string }) {
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
      throw new BadRequestException("Failed to add party");
    }

    await this.clearElectionCache(redisKeys);
    return { message: "Party added successfully" };
  }

  async updateMainElectionInfo(id: string, data: {
    status: string;
    state: string;
    halfWayMark: number;
    totalSeats: number;
    year: number;
    electionType: string;
  }) {
    const { status, state, halfWayMark, totalSeats, year, electionType } = data;
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
      throw new BadRequestException("Failed to update election info");
    }

    await this.clearElectionCache({ state, year: year.toString(), type: electionType });
    return { success: true, message: "Updated Successfully" };
  }

  async addCandidateToElection(election: string, candidates: string[], redisKeys: { state: string; year: string; type: string }) {
    const updatedElection = await this.tempElectionModel.findByIdAndUpdate(
      election,
      { $push: { "electionInfo.candidates": candidates } },
      { new: true }
    );

    const newCandidates = candidates.map(
      (candidateId) => new this.electionCandidateModel({ election, candidate: candidateId })
    );

    const newAddedCandidates = await this.electionCandidateModel.bulkSave(newCandidates);

    // Add constituencies for candidates
    for (let i = 0; i < candidates.length; i++) {
      const candidate: any = await this.electionCandidateModel.findById(candidates[i]).select("constituency");
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

    if (!updatedElection || newAddedCandidates.insertedCount === 0 || candidates.length <= 0) {
      throw new BadRequestException("Failed to add candidates");
    }

    await this.clearElectionCache(redisKeys);
    return { message: "Candidates added successfully" };
  }

  async deletePartyFromElection(partyId: string, electionId: string, redisKeys: { state: string; year: string; type: string }) {
    if (!partyId || !electionId) {
      throw new BadRequestException("Missing required parameters");
    }

    const deletedPartyElection = await this.electionPartyResultModel.findOneAndDelete({
      election: electionId,
      party: partyId,
    });

    if (!deletedPartyElection) {
      throw new BadRequestException("Party election not found");
    }

    const election: any = await this.tempElectionModel.findById(electionId).populate({
      path: "electionInfo.candidates",
      match: { party: partyId },
    });

    if (election && election.electionInfo && election.electionInfo.candidates) {
      const candidateIds = election.electionInfo.candidates.map((candidate) => candidate._id);

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

    await this.clearElectionCache(redisKeys);
    return { success: true };
  }

  async deleteCandidateFromElection(candidateId: string, electionId: string, redisKeys: { state: string; year: string; type: string }) {
    if (!candidateId || !electionId) {
      throw new BadRequestException("Missing required parameters");
    }

    const deletedPartyCandidate = await this.electionCandidateModel.findOneAndDelete({
      election: electionId,
      candidate: candidateId,
    });

    if (!deletedPartyCandidate) {
      throw new BadRequestException("Candidate election not found");
    }

    await this.tempElectionModel.findByIdAndUpdate(
      electionId,
      { $pull: { "electionInfo.candidates": candidateId } },
      { new: true }
    );

    await this.clearElectionCache(redisKeys);
    return { success: true };
  }

  async updateCandidateVotes(election: string, candidate: string, votesReceived: number, redisKeys: { state: string; year: string; type: string }) {
    const query = { election, candidate };
    const updatedDocument = await this.electionCandidateModel.findOneAndUpdate(
      query,
      { $set: { votesReceived } },
      { new: true }
    );

    if (!updatedDocument) {
      throw new BadRequestException("Failed to update candidate votes");
    }

    await this.clearElectionCache(redisKeys);
    return updatedDocument;
  }

  async updatePartySeats(election: string, party: string, seatsWon: number, redisKeys: { state: string; year: string; type: string }) {
    const query = { election, party };
    const updatedDocument = await this.electionPartyResultModel.findOneAndUpdate(
      query,
      { $set: { seatsWon } },
      { new: true }
    );

    if (!updatedDocument) {
      throw new BadRequestException("Failed to update party seats");
    }

    await this.clearElectionCache(redisKeys);
    return updatedDocument;
  }

  async deleteTempElection(id: string) {
    const election = await this.tempElectionModel.findByIdAndDelete(id);

    await Promise.all([
      this.electionPartyResultModel.deleteMany({ election: id }),
      this.electionCandidateModel.deleteMany({ election: id }),
      this.electionConsituencyModel.deleteMany({ election: id }),
      this.allianceModel.deleteMany({ election: id }),
    ]);

    if (!election) {
      throw new NotFoundException("Election not found");
    }

    return { message: "Election successfully deleted" };
  }

  async updateElection(id: string, updateData: any) {
    const updatedElection = await this.electionModel.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!updatedElection) {
      throw new NotFoundException("Election not found");
    }

    await this.redisManager.clearAllKeys();
    return updatedElection;
  }

  async askChatBot(question: string) {
    try {
      // Using Gemini Bot
      const questionEmedding = await getEmbedding(question, this.electionChatbot, this.configService.get<string>("CURRENT_CHATBOT") as string)
      const storedQuestions: any = await this.chatbotQuestionModel.find().lean()
      let bestMatch: any = null;
      let bestScore = -1;

      for (const q of storedQuestions) {
        const sim: any = measureSimilarity(questionEmedding, q.embedding);
        if (sim > bestScore) {
          bestScore = sim;
          bestMatch = q;
        }
      }

      // 3. If similarity is high enough, return the stored answer
      if (bestMatch && bestScore >= 0.8) {
        console.log('got answer from the db')
        return { response: bestMatch.answer, fromDb: true, similarity: bestScore };
      }

      const answer: string = await generateChatbotResponse(question, this.configService.get<string>("CURRENT_CHATBOT") as string, this.electionChatbot) 

      await this.chatbotQuestionModel.create({
        question,
        embedding: questionEmedding,
        answer,
      });

      return { response: answer, fromDb: false, similarity: null };


      // Alternative OpenAI implementation (commented out)
      // const response = await this.openaiChatbot.chat.completions.create({
      //   model: this.configService.get<string>('OPENAI_MODEL') as string,
      //   messages: [
      //     { role: "system", content: `You are a Bihar election assistant. Answer only questions related to Bihar elections factually and concisely. If the question is unrelated to Bihar elections, reply with: "I can only answer questions about the Bihar elections".` },
      //     { role: "user", content: question }
      //   ]
      // });
      // return { response: response.choices[0].message.content };

    } catch (error) {
      throw new Error(`Failed to generate response from chatbot: ${error.message}`);
    }
  }

  private async clearElectionCache(redisKeys: { state: string; year: string; type: string }) {
    const { state, year, type } = redisKeys;
    
    await Promise.all([
      this.redisManager.delete('widget_election_widget'),
      this.redisManager.delete(`widget_bihar_election_map_${state}_${year}_${type}`),
      this.redisManager.delete(`widget_cn_election_constituencies_${state}_${year}_${type}`),
      this.redisManager.deleteByPattern(`widget_cn_election_candidates_*_${state}_${year}_${type}`)
    ]);
  }
}

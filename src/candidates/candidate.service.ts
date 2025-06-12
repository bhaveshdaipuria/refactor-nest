import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CandidateSchema } from '../schemas/candidate.schema';
import { ConstituencySchema } from 'src/schemas/constituency.schema';
import { PartySchema } from 'src/schemas/party.schema';

@Injectable()
export class CandidateService {
  constructor(
    @InjectModel('Candidate')
    private CandidateModel: Model<typeof CandidateSchema>,
    @InjectModel('Constituency')
    private ConstituencyModel: Model<typeof ConstituencySchema>,
    @InjectModel('Party') private PartyModel: Model<typeof PartySchema>, // Add Party model
  ) {}

  async getAllCandidate(constituency?: string) {
    if (constituency) {
      console.log('inside');
      // const constituencies = await this.ConstituencyModel.find({
      //   name: { $regex: constituency, $options: 'i' },
      // }) // Added case-insensitive search
      //   .populate<{
      //     candidates: Array<{
      //       _id: Types.ObjectId;
      //       name: string;
      //       totalVotes: number;
      //       party: {
      //         _id: Types.ObjectId;
      //         name: string;
      //         // other Party fields you need
      //       };
      //       constituency: {
      //         _id: Types.ObjectId;
      //         name: string;
      //         state: string;
      //         // other Constituency fields you need
      //       };
      //     }>;
      //   }>({
      //     path: 'candidates',
      //     model: 'Candidate',
      //     populate: [
      //       { path: 'party', model: 'Party' },
      //       { path: 'constituency', model: 'Constituency' },
      //     ],
      //   });
      const constituencies = await this.ConstituencyModel.find({
        name: { $regex: constituency, $options: 'i' },
      }).populate<{
        candidates: Array<{
          _id: Types.ObjectId;
          name: string;
          totalVotes: number;
          party: {
            _id: Types.ObjectId;
            name: string;
            // other Party fields you need
          };
          constituency: {
            _id: Types.ObjectId;
            name: string;
            state: string;
            // other Constituency fields you need
          };
        }>;
      }>({
        path: 'candidates',
        populate: ['party', 'constituency'],
      });
      console.log('outside', constituencies);

      // Check if any constituencies were found
      if (constituencies.length === 0) {
        return { candidates: [] };
      }

      // Sort candidates by totalVotes in descending order
      const sortedCandidates = constituencies[0].candidates.sort(
        (a, b) => b.totalVotes - a.totalVotes,
      ); // Sort in descending order

      return sortedCandidates;
    }

    // If not cached, fetch from DB
    const candidates = await this.CandidateModel.find()
      .populate('party constituency')
      .sort({ totalVotes: -1 }); // Sort by totalVotes in descending order

    return candidates;
  }
}

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

@Injectable()
export class CandidatesService {
  constructor(
    @InjectModel('CandidateElection') private candidateElectionModel: Model<any>,
  ) {}

  async getCandidateElectionDetails(
    userType: string,
    electionId: string,
    allowedConstituencies: string[],
  ) {
    const pipeline = [
      { $match: { election: new Types.ObjectId(electionId) } },
      {
        $lookup: {
          from: 'candidates',
          localField: 'candidate',
          foreignField: '_id',
          as: 'candidateInfo',
        },
      },
      { $unwind: '$candidateInfo' },
      ...(userType === 'user'
        ? [
            {
              $match: {
                'candidateInfo.constituency': {
                  $in: allowedConstituencies.map((id) =>
                    typeof id === 'string' ? new Types.ObjectId(id) : id,
                  ),
                },
              },
            },
          ]
        : []),
      {
        $lookup: {
          from: 'constituencies',
          localField: 'candidateInfo.constituency',
          foreignField: '_id',
          as: 'constituencyInfo',
        },
      },
      { $unwind: '$constituencyInfo' },
      {
        $lookup: {
          from: 'parties',
          localField: 'candidateInfo.party',
          foreignField: '_id',
          as: 'partyInfo',
        },
      },
      { $unwind: { path: '$partyInfo', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'electioncandidates',
          let: { candidateId: '$candidateInfo._id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$election', new Types.ObjectId(electionId)] },
                    { $eq: ['$candidate', '$$candidateId'] },
                  ],
                },
              },
            },
            { $project: { votesReceived: 1 } },
          ],
          as: 'voteInfo',
        },
      },
      {
        $unwind: {
          path: '$voteInfo',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'electionconstituencies',
          let: {
            electionId: new Types.ObjectId(electionId),
            constituencyId: '$candidateInfo.constituency',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$election', '$$electionId'] },
                    { $eq: ['$constituency', '$$constituencyId'] },
                  ],
                },
              },
            },
          ],
          as: 'constituencyElectionStatus',
        },
      },
      {
        $unwind: {
          path: '$constituencyElectionStatus',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          election: 1,
          candidate: {
            _id: '$candidateInfo._id',
            name: '$candidateInfo.name',
            constituency: '$constituencyInfo',
            party: '$partyInfo',
            votesReceived: { $ifNull: ['$voteInfo.votesReceived', 0] },
          },
          constituencyStatus: {
            $cond: {
              if: { $ifNull: ['$constituencyElectionStatus', false] },
              then: '$constituencyElectionStatus.status',
              else: 'unknown',
            },
          },
        },
      },
    ];
    return this.candidateElectionModel.aggregate(pipeline);
  }
}

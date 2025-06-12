import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Res,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PartySchema } from '../schemas/party.schema';
import { ElectionPartyResultSchema } from '../schemas/party.election.schema';

@Injectable()
export class PartyService {
  constructor(
    @InjectModel('Party') private PartyModel: Model<typeof PartySchema>,
    @InjectModel('ElectionPartyResult')
    private ElectionPartyModel: Model<typeof ElectionPartyResultSchema>,
  ) {}

  async getAllParties() {
    try {
      const parties = await this.PartyModel.find();
      return {
        statusCode: HttpStatus.OK,
        message: 'Parties retrieved successfully',
        data: parties,
      };
    } catch (err) {
      throw new HttpException(
        'Failed to retrieve parties',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getPartyById(id: string) {
    try {
      const party = await this.PartyModel.findById(id).exec();

      if (!party) {
        throw new HttpException('Party not found', HttpStatus.NOT_FOUND);
      }

      return party;
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve party',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updatePartyById(
    id: string,
    body: { party: string; color_code: string },
  ) {
    try {
      const partyData = {
        party: body.party,
        color_code: body.color_code,
        // total_seat: req.body.total_seat,
        // total_votes: req.body.total_votes,
        // electors: req.body.electors,
        // votes_percentage: req.body.votes_percentage,
      };

      const party = await this.PartyModel.findByIdAndUpdate(id, partyData, {
        new: true,
      });

      if (!party) {
        throw new BadRequestException('Party not found');
      }

      return party;
    } catch (err) {
      throw new HttpException(
        'Failed to retrieve parties',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deletePartyById(id: string) {
    try {
      const party = await this.PartyModel.findByIdAndDelete(id);

      if (!party) {
        throw new BadRequestException('Party not found');
      }

      return { message: 'Deleted party' };
    } catch (err) {
      throw new HttpException(
        'Failed to retrieve parties',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

import {
  Controller,
  Get,
  Query,
  Res,
  HttpStatus,
  HttpException,
  Param,
  Delete,
  Put,
  Body,
} from '@nestjs/common';

import { PartyService } from './party.service';

@Controller('api/party')
export class PartyController {
  constructor(private readonly partyService: PartyService) {}

  @Get('')
  async getAllParties() {
    try {
      return await this.partyService.getAllParties();
    } catch (error) {
      throw new HttpException(
        error.message || 'Internal server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  async getPartyId(@Param('id') id: string) {
    try {
      return await this.partyService.getPartyById(id);
    } catch (error) {
      throw new HttpException(
        error.message || 'Internal server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':id')
  async updatePartyById(
    @Param('id') id: string,
    @Body() body: { party: string; color_code: string },
  ) {
    try {
      return this.partyService.updatePartyById(id, body);
    } catch (error) {
      throw new HttpException(
        error.message || 'Internal server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  async deletePartyById(@Param('id') id: string) {
    try {
      return this.partyService.deletePartyById(id);
    } catch (error) {
      throw new HttpException(
        error.message || 'Internal server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

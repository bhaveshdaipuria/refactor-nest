import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Query,
  Res,
} from '@nestjs/common';
import { ConstituencyService } from './constituency.service';
import { Response } from 'express';

@Controller('api/constituency')
export class ConstituencyController {
  constructor(private readonly constituencyService: ConstituencyService) {}
  @Get('')
  async getConstituencies(
    @Res() res: Response,
    @Query('state') state: string,
    @Query('year') year: string,
  ) {
    try {
      const result = await this.constituencyService.getConstituencies(
        state,
        year,
      );
      return result;
    } catch (error) {
      console.log(error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch results');
    }
  }
}

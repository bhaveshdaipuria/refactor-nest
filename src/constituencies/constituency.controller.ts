import { Controller, Get, HttpStatus, Query, Res } from '@nestjs/common';
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
      return this.constituencyService.getConstituencies(state, year);
    } catch (error) {
      console.error('Error:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }
}

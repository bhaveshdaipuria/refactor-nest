import {
  Controller,
  Get,
  Query,
  HttpException,
  HttpStatus,
  Put,
  UseInterceptors,
  Param,
  Body,
  UploadedFile,
  Req,
  Delete,
  Post,
  UseGuards,
  Res,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { AdminGuard } from "src/guards/admin.guard";
import { Response, Request } from "express";
import { CandidateService } from "./controller.service";

@Controller("api/candidate")
export class CandidateController {
  constructor(private readonly candidateService: CandidateService) {}

  @Get("hot-candidates")
  async getHotCandidates(@Res() res: Response) {
    try {
      const result = await this.candidateService.getHotCandidates();
      res.json(result);
    } catch (error) {
      console.error("Error:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  @Get("cn-list")
  async getCandidateList(
    @Query("constituencyName") constituencyName: string,
    @Query("state") state: string,
    @Query("year") year: string,
  ) {
    return this.candidateService.getCandidateList(constituencyName, state, year);
  }

  @Post()
  @UseGuards(AdminGuard)
  @UseInterceptors(FileInterceptor("image"))
  async createCandidate(
    @Req() req: Request,
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.candidateService.createCandidate(req, body, file);
  }

  @Put(":id")
  @UseGuards(AdminGuard)
  @UseInterceptors(FileInterceptor("image"))
  async updateCandidate(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.candidateService.updateCandidate(req, id, body, file);
  }

  @Get(":id")
  async getCandidateById(@Param("id") id: string) {
    return this.candidateService.getCandidateById(id);
  }

  @Get()
  async getCandidates(@Query("constituency") constituency?: string) {
    return this.candidateService.getCandidates(constituency);
  }

  @Delete(":id")
  @UseGuards(AdminGuard)
  async deleteCandidate(@Param("id") id: string) {
    return this.candidateService.deleteCandidate(id);
  }
}

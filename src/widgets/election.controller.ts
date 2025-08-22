import { Controller, Get, Query, Res, HttpStatus, Param, Req, BadRequestException } from "@nestjs/common";
import { Response, Request } from "express";
import { ElectionService } from "./election.service";

@Controller('')
export class ElectionController {
	constructor(
		private readonly electionService: ElectionService
	) { }

	@Get("election/hot-candidate/result")
	async getHotCandidateResult(
		@Res() res: Response,
		@Query("year") year: string,
		@Query("party") party?: string,
		@Query("candidateName") candidateName?: string,
	) {
		try {
			if (!year) {
				return res.status(HttpStatus.BAD_REQUEST).json({
					success: false,
					message: "Year parameter is required",
				});
			}

			const result = await this.electionService.getHotCandidateResult({
				year,
				party,
				candidateName
			});

			return res.status(HttpStatus.OK).json(result);
		} catch (error) {
			console.error("Error:", error);
			
			if (error.message === "No hot candidates found matching the criteria") {
				return res.status(HttpStatus.NOT_FOUND).json({
					success: false,
					message: error.message,
				});
			}

			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
				success: false,
				message: "Internal server error",
			});
		}
	}

	@Get("election/candidates")
	async getCandidatesList(
		@Res() res: Response,
		@Query("state") state: string,
		@Query("constituencyId") constituencyId?: string,
		@Query("year") year?: string,
	) {
		try {
			if (!state || !year) {
				return res.status(HttpStatus.BAD_REQUEST).json({
					success: false,
					message: "State and year are required parameters",
				});
			}

			const result = await this.electionService.getCandidatesList({
				state,
				constituencyId,
				year
			});

			return res.json(result);
		} catch (error) {
			console.error("Error:", error);
			
			if (error.message === "No data found for the given parameters") {
				return res.status(HttpStatus.NOT_FOUND).json({
					success: false,
					message: error.message,
				});
			}

			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
				success: false,
				message: "Internal server error",
			});
		}
	}

	@Get("election/hot-candidates")
	async getHotCandidates(
		@Res() res: Response,
		@Query("state") state: string,
		@Query("year") year: string,
	) {
		try {
			if (!state || !year) {
				return res.status(HttpStatus.BAD_REQUEST).json({
					success: false,
					message: "State and year are required parameters",
				});
			}

			const result = await this.electionService.getHotCandidates({
				state,
				year
			});

			return res.json(result);
		} catch (error) {
			console.error("Error:", error);
			
			if (error.message === "Election not found") {
				return res.status(HttpStatus.NOT_FOUND).json({
					success: false,
					message: error.message,
				});
			}

			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
				success: false,
				message: "Internal server error",
			});
		}
	}

	@Get("elections/map/top-candidates")
	async getTopCandidates(
		@Res() res: Response,
		@Query("state") state?: string,
		@Query("year") year?: string,
	) {
		try {
			if (!state || !year) {
				return res.status(HttpStatus.BAD_REQUEST).json({
					success: false,
					message: "State, year are required query parameters",
				});
			}

			const result = await this.electionService.getTopCandidates({
				state,
				year
			});

			return res.status(HttpStatus.OK).json(result);
		} catch (error) {
			console.error("Error:", error);
			
			if (error.message === "Election not found") {
				return res.status(HttpStatus.NOT_FOUND).json({
					success: false,
					message: error.message,
				});
			}

			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
				success: false,
				message: "Internal server error",
			});
		}
	}

	@Get('elections/state-elections')
	async getStateElections(
		@Res() res: Response, 
		@Query('state') state: string,
	) {
		try {
			if (!state) {
				return res.status(HttpStatus.BAD_REQUEST).json({ 
					success: false,
					message: "State parameter is required" 
				});
			}

			const result = await this.electionService.getStateElections(state);
			return res.json(result);
		} catch (error) {
			console.error("Error fetching state elections:", error);
			
			if (error.message === "No elections found for the specified state") {
				return res.status(HttpStatus.NOT_FOUND).json({ 
					success: false,
					message: error.message 
				});
			}

			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ 
				success: false,
				message: "Internal server error" 
			});
		}
	}

	@Get('election/years/:state')
	async electionYears(
		@Res() res: Response,
		@Param('state') state: string
	) {
		try {
			if (!state) {
				return res.status(HttpStatus.BAD_REQUEST).json({
					success: false,
					message: "State parameter is required",
				});
			}

			const result = await this.electionService.getElectionYears(state);
			return res.json(result);
		} catch (error) {
			console.error("Error fetching available years:", error);
			
			if (error.message === "No election data found for the given state") {
				return res.status(HttpStatus.NOT_FOUND).json({
					success: false,
					message: error.message,
				});
			}

			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
				success: false,
				message: "Internal server error",
			});
		}
	}

	@Get(':electionId/candidates')
	async getCandidateDetails(
		@Req() req: Request & { userRole: string, allowedConst: string[] }, 
		@Param('electionId') electionId: string
	) {
		try {
			const result = await this.electionService.getCandidateDetails({
				electionId,
				userRole: req.userRole,
				allowedConst: req.allowedConst
			});

			return result;
		} catch (error) {
			console.error("Error fetching candidate details:", error);
			throw new BadRequestException("Failed to fetch candidate details");
		}
	}
}
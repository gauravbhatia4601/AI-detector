import { Controller, Get, Inject, NotFoundException, Param } from "@nestjs/common";

import { ReportResponseDto } from "../dto/report-response.dto.js";
import { InspectionService } from "../services/inspection.service.js";

@Controller("report")
export class ReportController {
  constructor(
    @Inject(InspectionService)
    private readonly inspectionService: InspectionService,
  ) {}

  @Get(":assetId")
  async getReport(@Param("assetId") assetId: string): Promise<ReportResponseDto> {
    const report = await this.inspectionService.getReport(assetId);
    if (!report) {
      throw new NotFoundException(`report not found for asset ${assetId}`);
    }
    return {
      assetId: report.assetId,
      verdict: report.verdict,
      confidence: report.confidence,
      evidence: report.evidence,
      metadata: report.metadata,
      storedAt: report.storedAt.toISOString(),
      storageLocation: report.storageLocation,
    };
  }
}

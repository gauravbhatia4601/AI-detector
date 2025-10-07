import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from "@nestjs/common";

import { InspectRequestDto } from "../dto/inspect-request.dto.js";
import { InspectResponseDto } from "../dto/inspect-response.dto.js";
import { InspectionService } from "../services/inspection.service.js";

@Controller("inspect")
export class InspectController {
  constructor(
    @Inject(InspectionService)
    private readonly inspectionService: InspectionService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async inspect(@Body() body: InspectRequestDto): Promise<InspectResponseDto> {
    return this.inspectionService.inspect(body);
  }
}

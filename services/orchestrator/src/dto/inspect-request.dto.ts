import { IsBase64, IsEnum, IsObject, IsOptional, IsString } from "class-validator";

import type { Modality } from "../config.js";

export class InspectRequestDto {
  @IsString()
  assetId!: string;

  @IsOptional()
  @IsBase64()
  base64?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsEnum(["image", "video", "audio"], {
    message: "modality must be one of image, video, audio",
  })
  modality?: Modality;

  @IsOptional()
  @IsString()
  contentType?: string;

  @IsOptional()
  @IsString()
  watermarkSignal?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

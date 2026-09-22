import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsInt, IsPositive, IsString, MinLength, ValidateNested } from "class-validator";

export class CompletedPartDto {
  @IsInt()
  @IsPositive()
  partNumber!: number;

  @IsString()
  @MinLength(1)
  etag!: string;
}

export class CompleteUploadDto {
  @IsString()
  @MinLength(1)
  uploadId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CompletedPartDto)
  parts!: CompletedPartDto[];
}

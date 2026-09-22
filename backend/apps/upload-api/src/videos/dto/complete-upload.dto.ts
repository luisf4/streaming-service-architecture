import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsInt, IsPositive, IsString, MinLength, ValidateNested } from "class-validator";

export class CompletedPartDto {
  @ApiProperty()
  @IsInt()
  @IsPositive()
  partNumber!: number;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  etag!: string;
}

export class CompleteUploadDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  uploadId!: string;

  @ApiProperty({ type: [CompletedPartDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CompletedPartDto)
  parts!: CompletedPartDto[];
}

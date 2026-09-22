import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsPositive, IsString, MinLength } from "class-validator";

export class CreateVideoDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  originalFilename!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  contentType!: string;

  @ApiProperty()
  @IsInt()
  @IsPositive()
  sizeBytes!: number;
}

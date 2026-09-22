import { IsInt, IsOptional, IsPositive, IsString, MinLength } from "class-validator";

export class CreateVideoDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @MinLength(1)
  originalFilename!: string;

  @IsString()
  @MinLength(1)
  contentType!: string;

  @IsInt()
  @IsPositive()
  sizeBytes!: number;
}

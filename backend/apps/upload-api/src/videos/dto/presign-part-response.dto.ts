import { ApiProperty } from "@nestjs/swagger";

export class PresignPartResponseDto {
  @ApiProperty()
  url!: string;
}

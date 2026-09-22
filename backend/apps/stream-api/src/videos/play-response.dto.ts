import { ApiProperty } from "@nestjs/swagger";

export class PlayResponseDto {
  @ApiProperty({ description: "Presigned URL for the video's HLS master playlist" })
  manifestUrl!: string;

  @ApiProperty({ description: "Seconds until manifestUrl expires" })
  expiresInSec!: number;
}

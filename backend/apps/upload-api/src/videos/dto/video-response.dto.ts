import { ApiProperty } from "@nestjs/swagger";
import { VideoStatus } from "@video-streaming/database";

export class VideoResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ enum: VideoStatus })
  status!: VideoStatus;

  @ApiProperty({ type: Number, nullable: true })
  durationSec!: number | null;

  @ApiProperty({ type: String, nullable: true })
  manifestKey!: string | null;

  @ApiProperty({ type: String, nullable: true })
  failureReason!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

import { ApiProperty } from "@nestjs/swagger";
import { VideoStatus, type Video } from "@video-streaming/database";

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

/**
 * Video (Prisma) also carries sizeBytes as a BigInt, which JSON.stringify
 * can't serialize - returning the row as-is 500s on the first real
 * completeUpload/getVideo call. Mapping explicitly drops it (and
 * originalFilename, not part of the public contract) instead of letting it
 * ride along.
 */
export function toVideoResponseDto(video: Video): VideoResponseDto {
  return {
    id: video.id,
    title: video.title,
    description: video.description,
    status: video.status,
    durationSec: video.durationSec,
    manifestKey: video.manifestKey,
    failureReason: video.failureReason,
    createdAt: video.createdAt,
    updatedAt: video.updatedAt,
  };
}

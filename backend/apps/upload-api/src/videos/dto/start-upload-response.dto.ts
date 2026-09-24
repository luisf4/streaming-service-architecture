import { ApiProperty } from "@nestjs/swagger";

export class StartUploadResponseDto {
  @ApiProperty()
  videoId!: string;

  @ApiProperty()
  uploadId!: string;

  @ApiProperty()
  bucket!: string;

  @ApiProperty()
  key!: string;
}

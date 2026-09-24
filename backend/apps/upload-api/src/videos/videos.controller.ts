import { Body, Controller, Get, Param, ParseIntPipe, Post, Sse } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { map, type Observable } from "rxjs";
import { CompleteUploadDto } from "./dto/complete-upload.dto";
import { CreateVideoDto } from "./dto/create-video.dto";
import { PresignPartResponseDto } from "./dto/presign-part-response.dto";
import { StartUploadResponseDto } from "./dto/start-upload-response.dto";
import { toVideoResponseDto, VideoResponseDto } from "./dto/video-response.dto";
import type { StatusPayload } from "../status/status-stream";
import { VideosService } from "./videos.service";

interface MessageEvent {
  data: StatusPayload;
}

@ApiTags("videos")
@Controller("videos")
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Post()
  @ApiOperation({ summary: "Create a video and start a multipart upload" })
  @ApiCreatedResponse({ type: StartUploadResponseDto })
  startUpload(@Body() dto: CreateVideoDto): Promise<StartUploadResponseDto> {
    return this.videosService.startUpload(dto);
  }

  @Post(":id/uploads/:uploadId/parts/:partNumber/presign")
  @ApiOperation({ summary: "Get a presigned URL for one multipart upload part" })
  @ApiCreatedResponse({ type: PresignPartResponseDto })
  presignPart(
    @Param("id") id: string,
    @Param("uploadId") uploadId: string,
    @Param("partNumber", ParseIntPipe) partNumber: number,
  ): Promise<PresignPartResponseDto> {
    return this.videosService.presignPart(id, uploadId, partNumber);
  }

  @Post(":id/complete")
  @ApiOperation({ summary: "Complete a multipart upload and mark the video UPLOADED" })
  @ApiCreatedResponse({ type: VideoResponseDto })
  async completeUpload(@Param("id") id: string, @Body() dto: CompleteUploadDto): Promise<VideoResponseDto> {
    return toVideoResponseDto(await this.videosService.completeUpload(id, dto));
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a video by id" })
  @ApiParam({ name: "id", description: "Video id" })
  @ApiOkResponse({ type: VideoResponseDto })
  async getVideo(@Param("id") id: string): Promise<VideoResponseDto> {
    return toVideoResponseDto(await this.videosService.getVideo(id));
  }

  @Sse(":id/events")
  streamStatus(@Param("id") id: string): Observable<MessageEvent> {
    return this.videosService.streamStatus(id).pipe(map((data) => ({ data })));
  }
}

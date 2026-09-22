import { Body, Controller, Get, Param, ParseIntPipe, Post, Sse } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Video } from "@video-streaming/database";
import { map, type Observable } from "rxjs";
import { CompleteUploadDto } from "./dto/complete-upload.dto";
import { CreateVideoDto } from "./dto/create-video.dto";
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
  startUpload(@Body() dto: CreateVideoDto) {
    return this.videosService.startUpload(dto);
  }

  @Post(":id/uploads/:uploadId/parts/:partNumber/presign")
  presignPart(
    @Param("id") id: string,
    @Param("uploadId") uploadId: string,
    @Param("partNumber", ParseIntPipe) partNumber: number,
  ) {
    return this.videosService.presignPart(id, uploadId, partNumber);
  }

  @Post(":id/complete")
  completeUpload(@Param("id") id: string, @Body() dto: CompleteUploadDto): Promise<Video> {
    return this.videosService.completeUpload(id, dto);
  }

  @Get(":id")
  getVideo(@Param("id") id: string): Promise<Video> {
    return this.videosService.getVideo(id);
  }

  @Sse(":id/events")
  streamStatus(@Param("id") id: string): Observable<MessageEvent> {
    return this.videosService.streamStatus(id).pipe(map((data) => ({ data })));
  }
}

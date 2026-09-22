import { Body, Controller, Get, Param, ParseIntPipe, Post } from "@nestjs/common";
import type { Video } from "@video-streaming/database";
import { CompleteUploadDto } from "./dto/complete-upload.dto";
import { CreateVideoDto } from "./dto/create-video.dto";
import { VideosService } from "./videos.service";

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
}

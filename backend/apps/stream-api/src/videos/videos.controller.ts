import { Controller, Get, Param } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { PlayResponseDto } from "./play-response.dto";
import { VideosService } from "./videos.service";

@ApiTags("videos")
@Controller("videos")
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Get(":id/play")
  @ApiOperation({ summary: "Get a presigned URL for a ready video's HLS master playlist" })
  @ApiParam({ name: "id", description: "Video id" })
  @ApiOkResponse({ type: PlayResponseDto })
  getPlayUrl(@Param("id") id: string): Promise<PlayResponseDto> {
    return this.videosService.getPlayUrl(id);
  }
}

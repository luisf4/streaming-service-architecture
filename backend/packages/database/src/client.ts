import { PrismaClient } from "@prisma/client";

export function createPrismaClient(options?: ConstructorParameters<typeof PrismaClient>[0]): PrismaClient {
  return new PrismaClient(options);
}

export { PrismaClient, Prisma, VideoStatus, TranscodeJobStatus } from "@prisma/client";
export type { Video, Chunk, TranscodeJob, Rendition, OutboxMessage, ProcessedEvent } from "@prisma/client";

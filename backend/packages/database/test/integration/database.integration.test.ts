import { execSync } from "node:child_process";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { OutboxRepository } from "../../src/outbox";
import { PrismaIdempotencyStore } from "../../src/idempotency";
import { VideoRepository } from "../../src/video-repository";
import { isDockerAvailable } from "../docker";

const dockerAvailable = isDockerAvailable();

describe.skipIf(!dockerAvailable)("database integration (Testcontainers Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    const databaseUrl = container.getConnectionUri();

    execSync("npx prisma db push --skip-generate --accept-data-loss", {
      cwd: path.resolve(__dirname, "../.."),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "inherit",
    });

    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  it("round-trips a video through the repository", async () => {
    const repository = new VideoRepository();
    const video = await repository.create(prisma, { title: "Integration video" });

    const found = await repository.findById(prisma, video.id);
    expect(found?.status).toBe("UPLOADING");

    const updated = await repository.updateStatus(prisma, video.id, "READY", {
      manifestKey: "hls/x/master.m3u8",
    });
    expect(updated.status).toBe("READY");
    expect(updated.manifestKey).toBe("hls/x/master.m3u8");
  });

  it("enqueues and publishes outbox messages in FIFO order", async () => {
    const repository = new OutboxRepository();
    await repository.enqueue(prisma, {
      exchange: "video.events",
      routingKey: "video.uploaded",
      payload: { videoId: "a" },
    });
    await repository.enqueue(prisma, {
      exchange: "video.events",
      routingKey: "video.uploaded",
      payload: { videoId: "b" },
    });

    const pending = await repository.fetchUnpublished(prisma, 10);
    expect(pending.length).toBeGreaterThanOrEqual(2);
    expect(pending[0].createdAt.getTime()).toBeLessThanOrEqual(pending[1].createdAt.getTime());

    await repository.markPublished(prisma, pending[0].id);
    const remaining = await repository.fetchUnpublished(prisma, 10);
    expect(remaining.find((m) => m.id === pending[0].id)).toBeUndefined();
  });

  it("marking the same event processed twice never throws (idempotency)", async () => {
    const store = new PrismaIdempotencyStore(prisma, "video.uploaded");
    const eventId = randomUUID();

    await store.markProcessed(eventId);
    await store.markProcessed(eventId);

    expect(await store.hasProcessed(eventId)).toBe(true);
  });
});

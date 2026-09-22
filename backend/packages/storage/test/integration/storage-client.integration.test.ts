import { MinioContainer, type StartedMinioContainer } from "@testcontainers/minio";
import { S3Client } from "@aws-sdk/client-s3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { StorageClient } from "../../src/storage-client";
import { isDockerAvailable } from "../docker";

const dockerAvailable = isDockerAvailable();
const BUCKET = "raw";

describe.skipIf(!dockerAvailable)("StorageClient integration (Testcontainers MinIO)", () => {
  let container: StartedMinioContainer;
  let s3: S3Client;
  let client: StorageClient;

  beforeAll(async () => {
    container = await new MinioContainer("minio/minio:latest").start();

    s3 = new S3Client({
      endpoint: container.getConnectionUrl(),
      region: "us-east-1",
      forcePathStyle: true,
      credentials: {
        accessKeyId: container.getUsername(),
        secretAccessKey: container.getPassword(),
      },
    });

    const { CreateBucketCommand } = await import("@aws-sdk/client-s3");
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));

    client = new StorageClient(s3, BUCKET);
  }, 120_000);

  afterAll(async () => {
    await container?.stop();
  });

  it("completes a real multipart upload and reads the object back", async () => {
    const key = "videos/integration.txt";
    const uploadId = await client.createMultipartUpload(key, "text/plain");

    const partBody = Buffer.alloc(5 * 1024 * 1024, "a");
    const uploadUrl = await client.presignUploadPart(key, uploadId, 1, 300);
    const response = await fetch(uploadUrl, { method: "PUT", body: partBody });
    expect(response.ok).toBe(true);
    const etag = response.headers.get("etag");
    expect(etag).toBeTruthy();

    await client.completeMultipartUpload(key, uploadId, [
      { partNumber: 1, etag: etag!.replaceAll('"', "") },
    ]);

    const downloadUrl = await client.presignGetObject(key, 300);
    const downloaded = await fetch(downloadUrl);
    expect(downloaded.ok).toBe(true);
    const body = Buffer.from(await downloaded.arrayBuffer());
    expect(body.length).toBe(partBody.length);
  }, 60_000);

  it("aborts a multipart upload so listing parts afterwards fails", async () => {
    const key = "videos/aborted.txt";
    const uploadId = await client.createMultipartUpload(key, "text/plain");

    await client.abortMultipartUpload(key, uploadId);

    const { ListPartsCommand } = await import("@aws-sdk/client-s3");
    await expect(s3.send(new ListPartsCommand({ Bucket: BUCKET, Key: key, UploadId: uploadId }))).rejects.toThrow();
  }, 30_000);
});

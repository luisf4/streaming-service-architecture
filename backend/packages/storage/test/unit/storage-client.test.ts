import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { StorageClient } from "../../src/storage-client";

const s3Mock = mockClient(S3Client);

describe("StorageClient", () => {
  beforeEach(() => {
    s3Mock.reset();
  });

  it("creates a multipart upload and returns the uploadId", async () => {
    s3Mock.on(CreateMultipartUploadCommand).resolves({ UploadId: "upload-1" });
    const client = new StorageClient(new S3Client({ region: "us-east-1", credentials: { accessKeyId: "test", secretAccessKey: "test" } }), "raw");

    const uploadId = await client.createMultipartUpload("videos/a.mp4", "video/mp4");

    expect(uploadId).toBe("upload-1");
    const call = s3Mock.commandCalls(CreateMultipartUploadCommand)[0].args[0].input;
    expect(call).toMatchObject({ Bucket: "raw", Key: "videos/a.mp4", ContentType: "video/mp4" });
  });

  it("throws if S3 does not return an UploadId", async () => {
    s3Mock.on(CreateMultipartUploadCommand).resolves({});
    const client = new StorageClient(new S3Client({ region: "us-east-1", credentials: { accessKeyId: "test", secretAccessKey: "test" } }), "raw");

    await expect(client.createMultipartUpload("videos/a.mp4")).rejects.toThrow(/UploadId/);
  });

  it("completes a multipart upload with parts sorted by part number", async () => {
    s3Mock.on(CompleteMultipartUploadCommand).resolves({});
    const client = new StorageClient(new S3Client({ region: "us-east-1", credentials: { accessKeyId: "test", secretAccessKey: "test" } }), "raw");

    await client.completeMultipartUpload("videos/a.mp4", "upload-1", [
      { partNumber: 2, etag: "etag-2" },
      { partNumber: 1, etag: "etag-1" },
    ]);

    const call = s3Mock.commandCalls(CompleteMultipartUploadCommand)[0].args[0].input;
    expect(call.MultipartUpload?.Parts).toEqual([
      { PartNumber: 1, ETag: "etag-1" },
      { PartNumber: 2, ETag: "etag-2" },
    ]);
  });

  it("aborts a multipart upload", async () => {
    s3Mock.on(AbortMultipartUploadCommand).resolves({});
    const client = new StorageClient(new S3Client({ region: "us-east-1", credentials: { accessKeyId: "test", secretAccessKey: "test" } }), "raw");

    await client.abortMultipartUpload("videos/a.mp4", "upload-1");

    expect(s3Mock.commandCalls(AbortMultipartUploadCommand)).toHaveLength(1);
  });

  it("puts an object directly", async () => {
    s3Mock.on(PutObjectCommand).resolves({});
    const client = new StorageClient(new S3Client({ region: "us-east-1", credentials: { accessKeyId: "test", secretAccessKey: "test" } }), "hls");

    await client.putObject("videos/a/segment-0.ts", Buffer.from("data"), "video/mp2t");

    expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(1);
  });

  it("presigns an upload-part URL scoped to the bucket, key and upload id", async () => {
    const client = new StorageClient(new S3Client({ region: "us-east-1", credentials: { accessKeyId: "test", secretAccessKey: "test" } }), "raw");

    const url = await client.presignUploadPart("videos/a.mp4", "upload-1", 3, 900);

    expect(url).toContain("videos/a.mp4");
    expect(url).toContain("uploadId=upload-1");
    expect(url).toContain("partNumber=3");
    expect(url).toContain("X-Amz-Expires=900");
  });

  it("presigns a get-object URL scoped to the bucket and key", async () => {
    const client = new StorageClient(new S3Client({ region: "us-east-1", credentials: { accessKeyId: "test", secretAccessKey: "test" } }), "hls");

    const url = await client.presignGetObject("videos/a/master.m3u8", 60);

    expect(url).toContain("videos/a/master.m3u8");
    expect(url).toContain("X-Amz-Expires=60");
  });
});

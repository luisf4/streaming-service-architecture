import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface CompletedPart {
  partNumber: number;
  etag: string;
}

export class StorageClient {
  /**
   * `presignS3` signs URLs handed to a browser, so it needs to be built
   * against a host the browser can actually reach - in docker-compose that's
   * Nginx (localhost:8080) in front of MinIO, not the internal `minio:9000`
   * `s3` itself talks to for server-to-server calls. Defaults to `s3` for
   * every other caller, where both are already the same reachable endpoint.
   */
  constructor(
    private readonly s3: S3Client,
    private readonly bucket: string,
    private readonly presignS3: S3Client = s3,
  ) {}

  async createMultipartUpload(key: string, contentType?: string): Promise<string> {
    const result = await this.s3.send(
      new CreateMultipartUploadCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
    );
    if (!result.UploadId) {
      throw new Error(`S3 did not return an UploadId for key ${key}`);
    }
    return result.UploadId;
  }

  async presignUploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    expiresInSec = 3600,
  ): Promise<string> {
    const command = new UploadPartCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });
    return getSignedUrl(this.presignS3, command, { expiresIn: expiresInSec });
  }

  async completeMultipartUpload(key: string, uploadId: string, parts: CompletedPart[]): Promise<void> {
    await this.s3.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: [...parts]
            .sort((a, b) => a.partNumber - b.partNumber)
            .map((part) => ({ PartNumber: part.partNumber, ETag: part.etag })),
        },
      }),
    );
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    await this.s3.send(
      new AbortMultipartUploadCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId }),
    );
  }

  async putObject(key: string, body: Uint8Array | Buffer | string, contentType?: string): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async presignGetObject(key: string, expiresInSec = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.presignS3, command, { expiresIn: expiresInSec });
  }
}

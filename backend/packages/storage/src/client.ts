import { S3Client } from "@aws-sdk/client-s3";

export interface S3ClientOptions {
  endpoint?: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
}

export function createS3Client(options: S3ClientOptions): S3Client {
  return new S3Client({
    endpoint: options.endpoint,
    region: options.region,
    credentials: {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
    },
    forcePathStyle: options.forcePathStyle ?? true,
    // SDK v3's default ("WHEN_SUPPORTED") bakes an x-amz-checksum-crc32
    // requirement into every presigned PUT URL it signs - but the actual
    // upload (a plain browser fetch/PUT, see upload.ts) never computes or
    // sends that checksum, so MinIO rejects it with SignatureDoesNotMatch.
    requestChecksumCalculation: "WHEN_REQUIRED",
  });
}

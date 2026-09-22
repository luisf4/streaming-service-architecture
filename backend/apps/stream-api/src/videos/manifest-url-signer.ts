import { getSignedUrl } from "@aws-sdk/cloudfront-signer";
import type { StorageClient } from "@video-streaming/storage";

export interface ManifestUrlSigner {
  sign(key: string, expiresInSec: number): Promise<string>;
}

/** Local/dev default: a plain S3 (MinIO) presigned GET URL. */
export class S3ManifestUrlSigner implements ManifestUrlSigner {
  constructor(private readonly storage: StorageClient) {}

  async sign(key: string, expiresInSec: number): Promise<string> {
    return this.storage.presignGetObject(key, expiresInSec);
  }
}

export interface CloudFrontSignerConfig {
  domainName: string;
  keyPairId: string;
  privateKey: string;
}

/** Production (Fase 10): CloudFront signed URL against the HLS distribution's OAC-protected origin. */
export class CloudFrontManifestUrlSigner implements ManifestUrlSigner {
  constructor(private readonly config: CloudFrontSignerConfig) {}

  async sign(key: string, expiresInSec: number): Promise<string> {
    const url = `https://${this.config.domainName}/${key}`;
    const dateLessThan = new Date(Date.now() + expiresInSec * 1000).toISOString();
    return getSignedUrl({
      url,
      keyPairId: this.config.keyPairId,
      privateKey: this.config.privateKey,
      dateLessThan,
    });
  }
}

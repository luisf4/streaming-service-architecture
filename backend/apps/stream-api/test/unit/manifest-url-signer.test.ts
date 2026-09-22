import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { StorageClient } from "@video-streaming/storage";
import { CloudFrontManifestUrlSigner, S3ManifestUrlSigner } from "../../src/videos/manifest-url-signer";

describe("S3ManifestUrlSigner", () => {
  it("delegates to the storage client's presignGetObject", async () => {
    const storage = { presignGetObject: vi.fn().mockResolvedValue("https://example.test/x") } as unknown as StorageClient;
    const signer = new S3ManifestUrlSigner(storage);

    const url = await signer.sign("videos/v1/master.m3u8", 60);

    expect(storage.presignGetObject).toHaveBeenCalledWith("videos/v1/master.m3u8", 60);
    expect(url).toBe("https://example.test/x");
  });
});

describe("CloudFrontManifestUrlSigner", () => {
  it("produces a CloudFront-signed URL scoped to the domain, path and expiry", async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const privateKeyPem = privateKey.export({ type: "pkcs1", format: "pem" }).toString();

    const signer = new CloudFrontManifestUrlSigner({
      domainName: "d123.cloudfront.net",
      keyPairId: "KPID123",
      privateKey: privateKeyPem,
    });

    const url = await signer.sign("videos/v1/master.m3u8", 300);

    expect(url).toMatch(/^https:\/\/d123\.cloudfront\.net\/videos\/v1\/master\.m3u8\?/);
    expect(url).toContain("Key-Pair-Id=KPID123");
    expect(url).toContain("Signature=");
  });
});

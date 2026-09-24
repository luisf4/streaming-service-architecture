export interface AppConfig {
  port: number;
  database: {
    url: string;
  };
  storage: {
    endpoint?: string;
    /** Host presigned manifest GET URLs are signed against - see StorageClient's presignS3. */
    publicEndpoint?: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    hlsBucket: string;
  };
  manifestUrlExpirySec: number;
  cdn?: {
    domainName: string;
    keyPairId: string;
    privateKey: string;
  };
}

function loadCdnConfig(): AppConfig["cdn"] {
  const domainName = process.env.CDN_DOMAIN_NAME;
  const keyPairId = process.env.CDN_KEY_PAIR_ID;
  const privateKey = process.env.CDN_SIGNING_PRIVATE_KEY;
  if (!domainName || !keyPairId || !privateKey) return undefined;
  return { domainName, keyPairId, privateKey };
}

export default (): AppConfig => ({
  port: Number(process.env.PORT ?? 3002),
  database: {
    url: process.env.DATABASE_URL ?? "",
  },
  storage: {
    endpoint: process.env.S3_ENDPOINT,
    publicEndpoint: process.env.S3_PUBLIC_ENDPOINT,
    region: process.env.S3_REGION ?? "us-east-1",
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "streaming",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "streamingsecret",
    hlsBucket: process.env.S3_HLS_BUCKET ?? "hls",
  },
  manifestUrlExpirySec: Number(process.env.MANIFEST_URL_EXPIRY_SEC ?? 3600),
  cdn: loadCdnConfig(),
});

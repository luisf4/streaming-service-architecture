export interface AppConfig {
  port: number;
  database: {
    url: string;
  };
  storage: {
    endpoint?: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    hlsBucket: string;
  };
  manifestUrlExpirySec: number;
}

export default (): AppConfig => ({
  port: Number(process.env.PORT ?? 3002),
  database: {
    url: process.env.DATABASE_URL ?? "",
  },
  storage: {
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "us-east-1",
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "streaming",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "streamingsecret",
    hlsBucket: process.env.S3_HLS_BUCKET ?? "hls",
  },
  manifestUrlExpirySec: Number(process.env.MANIFEST_URL_EXPIRY_SEC ?? 3600),
});

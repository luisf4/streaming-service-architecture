export interface AppConfig {
  port: number;
  rabbitmqUrl: string;
  outboxPollIntervalMs: number;
  maxAttempts: number;
  database: {
    url: string;
  };
  storage: {
    endpoint?: string;
    /** Host presigned upload-part URLs are signed against - see StorageClient's presignS3. */
    publicEndpoint?: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    rawBucket: string;
  };
}

export default (): AppConfig => ({
  port: Number(process.env.PORT ?? 3001),
  rabbitmqUrl: process.env.RABBITMQ_URL ?? "amqp://streaming:streaming@localhost:5672",
  outboxPollIntervalMs: Number(process.env.OUTBOX_POLL_INTERVAL_MS ?? 1000),
  maxAttempts: Number(process.env.STATUS_CONSUMER_MAX_ATTEMPTS ?? 3),
  database: {
    url: process.env.DATABASE_URL ?? "",
  },
  storage: {
    endpoint: process.env.S3_ENDPOINT,
    publicEndpoint: process.env.S3_PUBLIC_ENDPOINT,
    region: process.env.S3_REGION ?? "us-east-1",
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "streaming",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "streamingsecret",
    rawBucket: process.env.S3_RAW_BUCKET ?? "raw",
  },
});

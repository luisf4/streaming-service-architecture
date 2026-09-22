export interface ValidatorConfig {
  rabbitmqUrl: string;
  databaseUrl: string;
  maxAttempts: number;
  ffprobePath: string;
  storage: {
    endpoint?: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    rawBucket: string;
  };
}

export function loadConfig(): ValidatorConfig {
  return {
    rabbitmqUrl: process.env.RABBITMQ_URL ?? "amqp://streaming:streaming@localhost:5672",
    databaseUrl: process.env.DATABASE_URL ?? "",
    maxAttempts: Number(process.env.VALIDATOR_MAX_ATTEMPTS ?? 3),
    ffprobePath: process.env.FFPROBE_PATH ?? "ffprobe",
    storage: {
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION ?? "us-east-1",
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "streaming",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "streamingsecret",
      rawBucket: process.env.S3_RAW_BUCKET ?? "raw",
    },
  };
}

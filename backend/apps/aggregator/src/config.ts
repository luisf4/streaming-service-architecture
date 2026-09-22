export interface AggregatorConfig {
  rabbitmqUrl: string;
  databaseUrl: string;
  maxAttempts: number;
  storage: {
    endpoint?: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    hlsBucket: string;
  };
}

export function loadConfig(): AggregatorConfig {
  return {
    rabbitmqUrl: process.env.RABBITMQ_URL ?? "amqp://streaming:streaming@localhost:5672",
    databaseUrl: process.env.DATABASE_URL ?? "",
    maxAttempts: Number(process.env.AGGREGATOR_MAX_ATTEMPTS ?? 3),
    storage: {
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION ?? "us-east-1",
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "streaming",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "streamingsecret",
      hlsBucket: process.env.S3_HLS_BUCKET ?? "hls",
    },
  };
}

export interface TranscoderConfig {
  rabbitmqUrl: string;
  databaseUrl: string;
  maxAttempts: number;
  prefetch: number;
  ffmpegPath: string;
  storage: {
    endpoint?: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    rawBucket: string;
    hlsBucket: string;
  };
}

export function loadConfig(): TranscoderConfig {
  return {
    rabbitmqUrl: process.env.RABBITMQ_URL ?? "amqp://streaming:streaming@localhost:5672",
    databaseUrl: process.env.DATABASE_URL ?? "",
    maxAttempts: Number(process.env.TRANSCODER_MAX_ATTEMPTS ?? 3),
    prefetch: Number(process.env.TRANSCODER_PREFETCH ?? 1),
    ffmpegPath: process.env.FFMPEG_PATH ?? "ffmpeg",
    storage: {
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION ?? "us-east-1",
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "streaming",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "streamingsecret",
      rawBucket: process.env.S3_RAW_BUCKET ?? "raw",
      hlsBucket: process.env.S3_HLS_BUCKET ?? "hls",
    },
  };
}

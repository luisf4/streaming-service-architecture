# Video Streaming - Plano

## Decisões

- Backend: Node/NestJS
- Frontend: Next.js + hls.js
- Monorepo: Turborepo + pnpm
- ORM: Prisma
- Broker: RabbitMQ
- Auth: sem auth (foco no pipeline)
- Transcoding: paralelo por chunk + resolução
- Local: Docker Compose
- AWS: EC2 + Docker, Terraform
- Região: sa-east-1 aplicada, us-east-1 só no Terraform (plan)

## Estrutura do repo

```
video-streaming/
  backend/
    apps/
      upload-api/     presigned URL, CRUD de vídeo, outbox relay, consome status
      stream-api/     GET /videos/:id/play, retorna URL assinada
      validator/      ffprobe, valida formato/duração
      dispatcher/     quebra em chunks + fan-out dos jobs
      transcoder/     worker FFmpeg (escala horizontal)
      aggregator/     fan-in, playlists por resolução, {id}.m3u8
    packages/
      contracts/      tipos + JSON Schema dos eventos, versionados
      messaging/      wrapper RabbitMQ: publish, consume, retry, DLQ, idempotência
      database/       schema Prisma + client
      storage/        wrapper S3/MinIO
      observability/  setup OpenTelemetry + métricas
  frontend/
    web/              Next.js, upload com progresso, player
  packages/
    config/           tsconfig, eslint compartilhados
  infra/
    docker/           docker-compose local
    terraform/        modules/ + envs/sa-east-1 + envs/us-east-1
  load-tests/         k6
  docs/               ADRs, diagramas Mermaid
  pnpm-workspace.yaml
  turbo.json
```

```yaml
# pnpm-workspace.yaml
packages:
  - "backend/apps/*"
  - "backend/packages/*"
  - "frontend/*"
  - "packages/*"
```

Front não importa nada do backend. Tipos da API vêm do OpenAPI gerado pelo Nest (@nestjs/swagger) e o front gera o client com openapi-typescript. Contrato entre os dois é só HTTP.

## Topologia RabbitMQ

```
exchange video.events (topic)
  video.uploaded      -> validator.q
  video.validated     -> dispatcher.q
  chunk.transcoded    -> aggregator.q
  video.ready         -> upload-api.status.q
  video.*.failed      -> upload-api.status.q

exchange transcode.jobs (direct)
  transcode.requested -> transcode.q (prefetch 1, N workers)
  falha               -> transcode.retry.q (TTL, backoff) -> volta pro transcode.q
  3 tentativas        -> transcode.dlq
```

## Banco

- videos (com status)
- renditions
- chunks
- transcode_jobs
- outbox
- processed_events

```sql
CREATE TYPE video_status AS ENUM ('UPLOADING', 'UPLOADED', 'PROCESSING', 'READY', 'FAILED');

CREATE TABLE videos (
  id              UUID PRIMARY KEY,
  title           TEXT NOT NULL,
  description     TEXT,
  status          video_status NOT NULL DEFAULT 'UPLOADING',
  duration_sec    INT,
  manifest_key    TEXT,
  failure_reason  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Quem muda o status:

```
UPLOADING   upload-api cria o registro e gera presigned URL
UPLOADED    upload terminou, publica video.uploaded
PROCESSING  dispatcher começou o fan-out
READY       upload-api consome video.ready
FAILED      upload-api consome qualquer *.failed
```

## Fases

### 0. Setup
- Turborepo, pnpm workspaces
- docker-compose: Postgres, RabbitMQ (management + plugin prometheus), MinIO, Nginx
- GitHub Actions: lint, test, build
- Pronto quando: `docker compose up` sobe tudo e o CI passa

### 1. Upload
- Presigned multipart no MinIO
- Endpoint de complete
- Tabela videos
- Outbox + relay publicando video.uploaded
- Pronto quando: sobe vídeo de 500 MB por script e o evento aparece no painel do Rabbit

### 2. Pacote messaging
- Publish/consume tipado com contracts
- Idempotência via processed_events
- Retry com backoff, DLQ
- correlationId em todos os eventos
- Testes com Testcontainers
- Pronto quando: consumir o mesmo evento 2x não duplica nada e falha forçada vai pra DLQ depois de 3 tentativas

### 3. Validator
- ffprobe
- Publica video.validated ou video.validation.failed

### 4. Dispatcher + spike de chunking
- Spike isolado primeiro: quebrar em chunks alinhados em keyframe, transcodificar separado e ver se o HLS toca sem travar na emenda (ponto mais arriscado, resolver cedo)
- Grava chunks e transcode_jobs
- Publica chunks x resoluções jobs

### 5. Transcoder
- Consome transcode.q
- FFmpeg por chunk/resolução
- Sobe segmento no MinIO
- Publica chunk.transcoded
- Graceful shutdown (termina o job antes de morrer)

### 6. Aggregator + status
- Conta chunks por resolução
- Gera playlist da resolução, depois {id}.m3u8
- Publica video.ready
- upload-api consome e atualiza status
- Pronto quando: vídeo sai de UPLOADING até READY sozinho

### 7. Stream API + frontend
- Endpoint de play com URL assinada
- Nginx como CDN local na frente do MinIO
- OpenAPI no backend, client gerado no front
- Tela de upload com status em tempo real (SSE)
- Player trocando qualidade

### 8. Observabilidade
- OpenTelemetry com trace propagado pelos headers das mensagens até o Jaeger
- Prometheus + Grafana: profundidade das filas, jobs/s, tempo por chunk, tempo total por vídeo, taxa de DLQ

### 9. Escala e resiliência
- k6 com 10, 50, 200 uploads
- `--scale transcoder=1,5,10` e tabela de resultado
- Autoscaler simples por profundidade de fila
- Chaos: matar worker no meio do job, derrubar Rabbit, derrubar Postgres, mostrar que tudo termina

### 10. AWS
- Terraform com módulos: VPC, S3 (raw + hls), CloudFront com OAC e signed URLs, ECR, EC2 pros serviços
- Auto Scaling Group dos transcoders escalando por métrica de fila no CloudWatch
- Postgres (RDS ou container no EC2, mais barato)
- Deploy via GitHub Actions
- envs/us-east-1 só com terraform plan mostrando que replica
- Budget alarm + terraform destroy fácil

### 11. README e ADRs
- Diagramas
- Tabela de benchmark
- GIF do player
- Prints do Jaeger e Grafana
- Seção "o que acontece quando X falha"
- ADRs: RabbitMQ vs Kafka, chunk + resolução, outbox, EC2 vs ECS, sem auth, front separado via OpenAPI
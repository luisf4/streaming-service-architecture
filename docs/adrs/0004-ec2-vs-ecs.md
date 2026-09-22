# 0004 - EC2 (one core host + an ASG) instead of ECS

## Status

Accepted.

## Context

Fase 10 needed to run 8 services (upload-api, stream-api, validator,
dispatcher, transcoder, aggregator, web, plus Postgres/RabbitMQ/Jaeger) on
AWS, with the transcoder fleet scaling horizontally by queue depth, on a
minimal budget (there's a Budgets alarm at $25/month).

## Decision

Plain EC2, not ECS/Fargate. One "core" `t3.small` instance runs everything
except transcoder as individual `docker run` containers (Postgres,
RabbitMQ, the five other services, Jaeger) via user-data
(`infra/terraform/modules/compute/templates/core-user-data.sh.tftpl`); the
transcoder fleet is a plain EC2 Auto Scaling Group with its own launch
template, scaling on a CloudWatch alarm watching a custom `QueueDepth`
metric (`infra/terraform/modules/compute/asg.tf`).

- **ECS/Fargate bills per task, all the time.** Seven low-traffic services
  running as separate Fargate tasks costs meaningfully more than the same
  seven processes sharing one EC2 instance's already-paid-for CPU/memory.
- **Only transcoder actually needs to scale independently** - it's the one
  service with bursty, CPU-bound load (ffmpeg). Everything else is
  low-traffic enough that one shared host is plenty, which is exactly what
  ECS's per-task billing doesn't reward.
- **No container orchestration control plane to run or pay for.** A single
  EC2 host with `docker run` commands in user-data is the whole
  "orchestration layer" the core services need; the ASG is the only place
  actual autoscaling logic (CloudWatch alarm -> scaling policy) is
  needed, and EC2 ASGs do that natively.

## Consequences

- No rolling deploys, health-check-based container replacement, or
  service mesh - a new `image_tag` means re-running `terraform apply`
  and the instance re-running its (fixed) user-data only on next launch,
  not a live redeploy. Fine for a project this size; would need real work
  (or an actual move to ECS) before this could call itself production-grade.
- The core host is a single point of failure for Postgres/RabbitMQ/five
  services at once. Acceptable for a cost-constrained demo; a production
  version would split Postgres out to RDS (multi-AZ) at minimum before
  this tradeoff would be defensible at real stakes.
- Scaling is coarse (whole EC2 instances, `t3.medium` each) compared to
  Fargate's per-task granularity - the tradeoff made explicitly for
  transcoder, where a whole instance's CPU going to one ffmpeg-heavy
  workload is exactly the point.

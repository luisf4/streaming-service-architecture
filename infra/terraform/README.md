# Terraform (Fase 10)

```
modules/
  network   VPC, public subnets (no NAT - keeps this cheap), IGW, routes
  storage   S3 raw (uploads, expires after N days) + hls (CloudFront-only) buckets
  cdn       CloudFront distribution + OAC + signed-URL key group for the hls bucket
  ecr       one repo per app (upload-api, stream-api, validator, dispatcher,
            transcoder, aggregator, web)
  compute   IAM role, security groups, the "core" EC2 host (Postgres,
            RabbitMQ, every service except transcoder, Jaeger), and the
            transcoder Auto Scaling Group + CloudWatch alarms on
            transcode.q depth (published by a systemd timer on the core
            host, since RabbitMQ has no native CloudWatch integration)
  budget    AWS Budgets alert at 80%/100% of a monthly USD limit
envs/
  sa-east-1   applied - the real deployment
  us-east-1   plan only, never applied (see its README) - proves the stack
              replicates into a second region
```

## Why EC2 + one core host instead of ECS/RDS

Cost. A single core EC2 instance runs Postgres, RabbitMQ and every
stateless service except transcoder; only the transcoder fleet scales
horizontally via its own ASG. See `docs/adrs/` for the full tradeoff
(this is also why there's no NAT gateway - subnets are public with
security groups doing the restricting).

## Usage

```bash
cd envs/sa-east-1
terraform init
terraform plan -var="alert_email=you@example.com"
terraform apply -var="alert_email=you@example.com"
```

Images are built and pushed to the ECR repos this creates (`ecr_repository_urls`
output) by CI; `image_tag` (default `latest`) controls what the core host
and transcoder ASG actually pull. Redeploying a new tag today means
updating `image_tag` and re-applying (rolling deploys aren't wired up yet
- a real target for a follow-up).

Tear down: `terraform destroy -var="alert_email=you@example.com"`.

**Not validated end to end**: `terraform validate` passes and `terraform
plan` gets as far as AWS credentials allow in this environment (none are
configured here), but nothing here has been `apply`'d against a real AWS
account. Review before trusting it with real spend.

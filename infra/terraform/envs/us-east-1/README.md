# us-east-1 - plan only, never apply

This env exists purely to prove the sa-east-1 stack (network, storage,
CDN, ECR, compute, budget modules) replicates cleanly into a second
region. Per the plan, it is only ever `terraform plan`'d, never applied:

```bash
cd infra/terraform/envs/us-east-1
terraform init
terraform plan -var="alert_email=you@example.com"
```

If this ever needs to become a real second region, drop this note and
treat it like sa-east-1 (remote state, real `terraform apply`, its own
budget alert, etc).

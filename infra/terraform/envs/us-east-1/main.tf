module "network" {
  source = "../../modules/network"

  name = var.name
  azs  = var.azs
}

module "storage" {
  source = "../../modules/storage"

  name = var.name
}

module "cdn" {
  source = "../../modules/cdn"

  name                            = var.name
  hls_bucket_id                   = module.storage.hls_bucket_id
  hls_bucket_arn                  = module.storage.hls_bucket_arn
  hls_bucket_regional_domain_name = module.storage.hls_bucket_regional_domain_name
}

module "ecr" {
  source = "../../modules/ecr"

  name = var.name
}

module "compute" {
  source = "../../modules/compute"

  name       = var.name
  region     = var.region
  vpc_id     = module.network.vpc_id
  subnet_ids = module.network.public_subnet_ids

  ecr_repository_urls = module.ecr.repository_urls
  image_tag           = var.image_tag

  raw_bucket_name = module.storage.raw_bucket_name
  hls_bucket_name = module.storage.hls_bucket_name

  cdn_domain_name               = module.cdn.distribution_domain_name
  cdn_key_pair_id               = module.cdn.key_pair_id
  cdn_signing_key_ssm_parameter = module.cdn.signing_private_key_ssm_parameter

  ssh_key_name     = var.ssh_key_name
  allowed_ssh_cidr = var.allowed_ssh_cidr
}

module "budget" {
  source = "../../modules/budget"

  name              = var.name
  monthly_limit_usd = var.monthly_budget_usd
  alert_email       = var.alert_email
}

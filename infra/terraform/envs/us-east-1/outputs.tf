output "core_public_ip" {
  value = module.compute.core_public_ip
}

output "web_url" {
  value = "http://${module.compute.core_public_ip}:3003"
}

output "upload_api_url" {
  value = "http://${module.compute.core_public_ip}:3001"
}

output "stream_api_url" {
  value = "http://${module.compute.core_public_ip}:3002"
}

output "cdn_domain_name" {
  value = module.cdn.distribution_domain_name
}

output "ecr_repository_urls" {
  value = module.ecr.repository_urls
}

output "raw_bucket_name" {
  value = module.storage.raw_bucket_name
}

output "hls_bucket_name" {
  value = module.storage.hls_bucket_name
}

variable "name" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "region" {
  type = string
}

variable "ecr_repository_urls" {
  description = "Map of app name -> ECR repository URL (from the ecr module)."
  type        = map(string)
}

variable "image_tag" {
  description = "Tag to deploy across every service - a CI run sets this to the commit SHA it just pushed."
  type        = string
  default     = "latest"
}

variable "raw_bucket_name" {
  type = string
}

variable "hls_bucket_name" {
  type = string
}

variable "cdn_domain_name" {
  type = string
}

variable "cdn_key_pair_id" {
  type = string
}

variable "cdn_signing_key_ssm_parameter" {
  type = string
}

variable "otlp_endpoint" {
  description = "Where services send traces - defaults to the Jaeger container running on the core host itself."
  type        = string
  default     = "http://localhost:4318/v1/traces"
}

variable "core_instance_type" {
  type    = string
  default = "t3.small"
}

variable "transcoder_instance_type" {
  type    = string
  default = "t3.medium"
}

variable "transcoder_min_size" {
  type    = number
  default = 1
}

variable "transcoder_max_size" {
  type    = number
  default = 10
}

variable "ssh_key_name" {
  description = "Existing EC2 key pair name for SSH access. Leave null to disable SSH."
  type        = string
  default     = null
}

variable "allowed_ssh_cidr" {
  type    = list(string)
  default = []
}

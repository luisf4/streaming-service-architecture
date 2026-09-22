variable "name" {
  description = "Prefix used to name every resource this module creates."
  type        = string
}

variable "hls_bucket_id" {
  description = "S3 bucket id (name) holding the HLS output, from the storage module."
  type        = string
}

variable "hls_bucket_arn" {
  type = string
}

variable "hls_bucket_regional_domain_name" {
  type = string
}

variable "price_class" {
  description = "CloudFront price class - PriceClass_100 keeps this cheap (US/Canada/Europe edge locations only)."
  type        = string
  default     = "PriceClass_100"
}

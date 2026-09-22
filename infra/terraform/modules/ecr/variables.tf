variable "name" {
  description = "Prefix used to name every repository this module creates."
  type        = string
}

variable "repositories" {
  description = "Short names, one ECR repo per app - the final repo name is '<name>/<short-name>'."
  type        = list(string)
  default     = ["upload-api", "stream-api", "validator", "dispatcher", "transcoder", "aggregator", "web"]
}

variable "untagged_image_expiry_days" {
  type    = number
  default = 7
}

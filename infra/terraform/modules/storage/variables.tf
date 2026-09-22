variable "name" {
  description = "Prefix used to name every bucket this module creates."
  type        = string
}

variable "raw_retention_days" {
  description = "Days to keep the original uploaded file before it's expired (it's only needed until the pipeline finishes transcoding)."
  type        = number
  default     = 14
}

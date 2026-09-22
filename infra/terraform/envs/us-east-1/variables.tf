variable "region" {
  type    = string
  default = "us-east-1"
}

variable "azs" {
  type    = list(string)
  default = ["us-east-1a", "us-east-1b"]
}

variable "name" {
  description = "Prefix applied to every resource name (also the S3 bucket prefix, so it must be globally unique)."
  type        = string
  default     = "video-streaming-replica"
}

variable "alert_email" {
  description = "Email for the monthly budget alarm."
  type        = string
}

variable "monthly_budget_usd" {
  type    = number
  default = 25
}

variable "image_tag" {
  description = "Image tag to deploy - CI sets this to the commit SHA it just built and pushed to ECR."
  type        = string
  default     = "latest"
}

variable "ssh_key_name" {
  description = "Existing EC2 key pair name. Leave null to disable SSH entirely."
  type        = string
  default     = null
}

variable "allowed_ssh_cidr" {
  type    = list(string)
  default = []
}

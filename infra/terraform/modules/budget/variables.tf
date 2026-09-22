variable "name" {
  type = string
}

variable "monthly_limit_usd" {
  type    = number
  default = 25
}

variable "alert_email" {
  description = "Email to notify at 80% and 100% of the monthly limit."
  type        = string
}

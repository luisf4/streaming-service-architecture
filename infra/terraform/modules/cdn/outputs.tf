output "distribution_domain_name" {
  value = aws_cloudfront_distribution.hls.domain_name
}

output "distribution_id" {
  value = aws_cloudfront_distribution.hls.id
}

output "key_pair_id" {
  description = "CloudFront public key id - stream-api needs this to build signed URLs."
  value       = aws_cloudfront_public_key.signing.id
}

output "signing_private_key_ssm_parameter" {
  description = "SSM parameter name holding the signing private key (SecureString)."
  value       = aws_ssm_parameter.signing_private_key.name
}

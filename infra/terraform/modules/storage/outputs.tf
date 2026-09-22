output "raw_bucket_name" {
  value = aws_s3_bucket.raw.bucket
}

output "raw_bucket_arn" {
  value = aws_s3_bucket.raw.arn
}

output "hls_bucket_name" {
  value = aws_s3_bucket.hls.bucket
}

output "hls_bucket_arn" {
  value = aws_s3_bucket.hls.arn
}

output "hls_bucket_id" {
  value = aws_s3_bucket.hls.id
}

output "hls_bucket_regional_domain_name" {
  value = aws_s3_bucket.hls.bucket_regional_domain_name
}

# Signed-URL keypair. Terraform generating (and storing in state) the
# private key is a known tradeoff for a project this size - a real
# production setup would provision the key out of band and only ever hand
# Terraform the public half. The private key is written to SSM Parameter
# Store (SecureString) so stream-api can fetch it at boot via its IAM role
# instead of it ever landing in user-data or a container image.
resource "tls_private_key" "signing" {
  algorithm = "RSA"
  rsa_bits  = 2048
}

resource "aws_ssm_parameter" "signing_private_key" {
  name  = "/${var.name}/cloudfront/signing-private-key"
  type  = "SecureString"
  value = tls_private_key.signing.private_key_pem
}

resource "aws_cloudfront_public_key" "signing" {
  name        = "${var.name}-signing-key"
  encoded_key = tls_private_key.signing.public_key_pem
}

resource "aws_cloudfront_key_group" "signing" {
  name  = "${var.name}-signing-key-group"
  items = [aws_cloudfront_public_key.signing.id]
}

resource "aws_cloudfront_origin_access_control" "hls" {
  name                              = "${var.name}-hls-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "hls" {
  enabled         = true
  comment         = "${var.name} HLS output"
  price_class     = var.price_class
  is_ipv6_enabled = true

  origin {
    domain_name              = var.hls_bucket_regional_domain_name
    origin_id                = "hls-s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.hls.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "hls-s3"
    viewer_protocol_policy = "redirect-to-https"
    trusted_key_groups     = [aws_cloudfront_key_group.signing.id]
    compress               = true

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 60
    max_ttl     = 300
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

resource "aws_s3_bucket_policy" "hls_cloudfront_read" {
  bucket = var.hls_bucket_id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontServicePrincipalReadOnly"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${var.hls_bucket_arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.hls.arn
          }
        }
      }
    ]
  })
}

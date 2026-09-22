resource "aws_s3_bucket" "raw" {
  bucket = "${var.name}-raw"
}

resource "aws_s3_bucket_public_access_block" "raw" {
  bucket                  = aws_s3_bucket.raw.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "raw" {
  bucket = aws_s3_bucket.raw.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "raw" {
  bucket = aws_s3_bucket.raw.id

  rule {
    id     = "expire-raw-uploads"
    status = "Enabled"

    filter {}

    expiration {
      days = var.raw_retention_days
    }
  }
}

# Not publicly readable directly - only CloudFront (via the OAC + bucket
# policy set up in the cdn module) can read from it.
resource "aws_s3_bucket" "hls" {
  bucket = "${var.name}-hls"
}

resource "aws_s3_bucket_public_access_block" "hls" {
  bucket                  = aws_s3_bucket.hls.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "hls" {
  bucket = aws_s3_bucket.hls.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

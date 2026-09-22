resource "aws_instance" "core" {
  ami                    = data.aws_ami.al2023.id
  instance_type          = var.core_instance_type
  subnet_id              = var.subnet_ids[0]
  vpc_security_group_ids = [aws_security_group.core.id]
  iam_instance_profile   = aws_iam_instance_profile.app.name
  key_name               = var.ssh_key_name

  user_data = templatefile("${path.module}/templates/core-user-data.sh.tftpl", {
    region                        = var.region
    account_id                    = data.aws_caller_identity.current.account_id
    raw_bucket_name               = var.raw_bucket_name
    hls_bucket_name               = var.hls_bucket_name
    otlp_endpoint                 = var.otlp_endpoint
    cdn_domain_name               = var.cdn_domain_name
    cdn_key_pair_id               = var.cdn_key_pair_id
    cdn_signing_key_ssm_parameter = var.cdn_signing_key_ssm_parameter
    upload_api_image              = "${var.ecr_repository_urls["upload-api"]}:${var.image_tag}"
    stream_api_image              = "${var.ecr_repository_urls["stream-api"]}:${var.image_tag}"
    validator_image               = "${var.ecr_repository_urls["validator"]}:${var.image_tag}"
    dispatcher_image              = "${var.ecr_repository_urls["dispatcher"]}:${var.image_tag}"
    aggregator_image              = "${var.ecr_repository_urls["aggregator"]}:${var.image_tag}"
    web_image                     = "${var.ecr_repository_urls["web"]}:${var.image_tag}"
  })

  tags = {
    Name = "${var.name}-core"
  }
}

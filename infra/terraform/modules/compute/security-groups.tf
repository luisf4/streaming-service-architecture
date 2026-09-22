resource "aws_security_group" "core" {
  name        = "${var.name}-core"
  description = "Core host: Postgres+RabbitMQ+app HTTP services+observability UIs"
  vpc_id      = var.vpc_id

  ingress {
    description = "upload-api"
    from_port   = 3001
    to_port     = 3001
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "stream-api"
    from_port   = 3002
    to_port     = 3002
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "web"
    from_port   = 3003
    to_port     = 3003
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  dynamic "ingress" {
    for_each = var.ssh_key_name == null ? [] : [1]
    content {
      description = "SSH"
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      cidr_blocks = var.allowed_ssh_cidr
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.name}-core"
  }
}

resource "aws_security_group" "transcoder" {
  name        = "${var.name}-transcoder"
  description = "Transcoder fleet: outbound only (pulls jobs from RabbitMQ on the core host, no inbound listener)"
  vpc_id      = var.vpc_id

  dynamic "ingress" {
    for_each = var.ssh_key_name == null ? [] : [1]
    content {
      description = "SSH"
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      cidr_blocks = var.allowed_ssh_cidr
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.name}-transcoder"
  }
}

# RabbitMQ/Postgres/Jaeger-OTLP are only reachable from the transcoder
# fleet's security group, never from the public internet.
resource "aws_security_group_rule" "core_from_transcoder" {
  for_each = {
    rabbitmq = 5672
    postgres = 5432
    otlp     = 4318
  }

  type                     = "ingress"
  from_port                = each.value
  to_port                  = each.value
  protocol                 = "tcp"
  security_group_id        = aws_security_group.core.id
  source_security_group_id = aws_security_group.transcoder.id
}

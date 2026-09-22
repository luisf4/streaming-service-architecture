resource "aws_launch_template" "transcoder" {
  name_prefix   = "${var.name}-transcoder-"
  image_id      = data.aws_ami.al2023.id
  instance_type = var.transcoder_instance_type
  key_name      = var.ssh_key_name

  iam_instance_profile {
    name = aws_iam_instance_profile.app.name
  }

  vpc_security_group_ids = [aws_security_group.transcoder.id]

  user_data = base64encode(templatefile("${path.module}/templates/transcoder-user-data.sh.tftpl", {
    region           = var.region
    account_id       = data.aws_caller_identity.current.account_id
    core_private_ip  = aws_instance.core.private_ip
    raw_bucket_name  = var.raw_bucket_name
    hls_bucket_name  = var.hls_bucket_name
    transcoder_image = "${var.ecr_repository_urls["transcoder"]}:${var.image_tag}"
  }))

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = "${var.name}-transcoder"
    }
  }
}

resource "aws_autoscaling_group" "transcoder" {
  name                = "${var.name}-transcoder"
  min_size            = var.transcoder_min_size
  max_size            = var.transcoder_max_size
  desired_capacity    = var.transcoder_min_size
  vpc_zone_identifier = var.subnet_ids
  health_check_type   = "EC2"

  launch_template {
    id      = aws_launch_template.transcoder.id
    version = "$Latest"
  }

  tag {
    key                 = "Name"
    value               = "${var.name}-transcoder"
    propagate_at_launch = true
  }
}

resource "aws_autoscaling_policy" "scale_out" {
  name                   = "${var.name}-transcoder-scale-out"
  autoscaling_group_name = aws_autoscaling_group.transcoder.name
  adjustment_type        = "ChangeInCapacity"
  scaling_adjustment     = 2
  cooldown               = 120
}

resource "aws_autoscaling_policy" "scale_in" {
  name                   = "${var.name}-transcoder-scale-in"
  autoscaling_group_name = aws_autoscaling_group.transcoder.name
  adjustment_type        = "ChangeInCapacity"
  scaling_adjustment     = -1
  cooldown               = 300
}

# transcode.q depth is published as a custom metric by the core instance's
# publish-queue-depth.timer (RabbitMQ has no native CloudWatch integration).
resource "aws_cloudwatch_metric_alarm" "queue_depth_high" {
  alarm_name          = "${var.name}-transcoder-queue-depth-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "QueueDepth"
  namespace           = "Streaming"
  period              = 60
  statistic           = "Average"
  threshold           = 50
  dimensions = {
    Queue = "transcode.q"
  }
  alarm_actions = [aws_autoscaling_policy.scale_out.arn]
}

resource "aws_cloudwatch_metric_alarm" "queue_depth_low" {
  alarm_name          = "${var.name}-transcoder-queue-depth-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 3
  metric_name         = "QueueDepth"
  namespace           = "Streaming"
  period              = 60
  statistic           = "Average"
  threshold           = 5
  dimensions = {
    Queue = "transcode.q"
  }
  alarm_actions = [aws_autoscaling_policy.scale_in.arn]
}

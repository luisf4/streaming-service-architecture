output "core_public_ip" {
  value = aws_instance.core.public_ip
}

output "core_private_ip" {
  value = aws_instance.core.private_ip
}

output "transcoder_asg_name" {
  value = aws_autoscaling_group.transcoder.name
}

output "app_iam_role_name" {
  value = aws_iam_role.app.name
}

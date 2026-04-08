output "vpc-main_id" {
  description = "VPC ID for vpc-main"
  value = aws_vpc.vpc_main.id
}

output "public-subnet-a_id" {
  description = "Subnet ID for public-subnet-a"
  value = aws_subnet.public_subnet_a.id
}

output "private-subnet-a_id" {
  description = "Subnet ID for private-subnet-a"
  value = aws_subnet.private_subnet_a.id
}

output "alb-sg_id" {
  description = "Security Group ID for alb-sg"
  value = aws_security_group.alb_sg.id
}

output "ecs-sg_id" {
  description = "Security Group ID for ecs-sg"
  value = aws_security_group.ecs_sg.id
}

output "alb_dns" {
  description = "DNS name for alb"
  value = aws_lb.alb.dns_name
}

output "ecs-service_cluster_arn" {
  description = "ECS Cluster ARN for ecs-service"
  value = aws_ecs_cluster.ecs_service_cluster.arn
}

output "rds-postgres_endpoint" {
  description = "RDS endpoint for rds-postgres"
  value = aws_db_instance.rds_postgres.endpoint
}
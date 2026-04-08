provider "aws" {
  region = "us-east-1"
}

resource "aws_vpc" "vpc_main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
}

resource "aws_subnet" "public_subnet_a" {
  vpc_id                  = aws_vpc.vpc_main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "us-east-1a"
  map_public_ip_on_launch = true
}

resource "aws_subnet" "private_subnet_a" {
  vpc_id                  = aws_vpc.vpc_main.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = "us-east-1a"
  map_public_ip_on_launch = false
}

resource "aws_security_group" "alb_sg" {
  name        = "alb-sg"
  description = "Managed by ADAC export-terraform"
  vpc_id      = aws_vpc.vpc_main.id
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "ecs_sg" {
  name        = "ecs-sg"
  description = "Managed by ADAC export-terraform"
  vpc_id      = aws_vpc.vpc_main.id
  ingress {
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    security_groups = [
    aws_security_group.alb_sg.id
  ]
  }
}

resource "aws_lb" "alb" {
  name               = "alb"
  internal           = false
  load_balancer_type = "application"
  subnets            = [
    aws_subnet.public_subnet_a.id
  ]
  security_groups    = [
    aws_security_group.alb_sg.id
  ]
}

resource "aws_ecs_cluster" "ecs_service_cluster" {
  name = "ecs-service-cluster"
}

resource "aws_ecs_task_definition" "ecs_service" {
  family                   = "ecs-service"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "1024"
  container_definitions    = <<DEFINITIONS
[
  {
    "name": "frontend",
    "image": "example/frontend:1.0.0",
    "essential": true,
    "portMappings": [
      {
        "containerPort": 3000,
        "hostPort": 3000,
        "protocol": "tcp"
      }
    ]
  },
  {
    "name": "backend",
    "image": "example/backend:1.0.0",
    "essential": true,
    "portMappings": [
      {
        "containerPort": 8080,
        "hostPort": 8080,
        "protocol": "tcp"
      }
    ]
  }
]
DEFINITIONS
}

resource "aws_ecs_service" "ecs_service" {
  name            = "ecs-service"
  cluster         = aws_ecs_cluster.ecs_service_cluster.id
  task_definition = aws_ecs_task_definition.ecs_service.arn
  desired_count   = 1
  launch_type     = "FARGATE"
  network_configuration {
    subnets          = [
    aws_subnet.private_subnet_a.id
  ]
    security_groups  = [
    aws_security_group.ecs_sg.id
  ]
    assign_public_ip = false
  }
}

resource "aws_db_subnet_group" "rds_postgres_subnet_group" {
  name       = "rds-postgres-subnet-group"
  subnet_ids = [
    aws_subnet.private_subnet_a.id
  ]
}

resource "aws_db_instance" "rds_postgres" {
  identifier             = "rds-postgres"
  engine                 = "postgres"
  instance_class         = var.rds_postgres_instance_class
  allocated_storage      = var.rds_postgres_allocated_storage
  username               = var.rds_postgres_username
  password               = var.rds_postgres_password
  multi_az               = false
  skip_final_snapshot    = true
  db_subnet_group_name   = aws_db_subnet_group.rds_postgres_subnet_group.name
  vpc_security_group_ids = [
    aws_security_group.ecs_sg.id
  ]
}
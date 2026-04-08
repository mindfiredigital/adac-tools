variable "rds_postgres_instance_class" {
  type = string
  description = "RDS instance class for rds-postgres"
  default = "db.t3.micro"
}

variable "rds_postgres_allocated_storage" {
  type = number
  description = "Allocated storage (GB) for rds-postgres"
  default = 20
}

variable "rds_postgres_username" {
  type = string
  description = "Database username for rds-postgres"
  default = "admin"
}

variable "rds_postgres_password" {
  type = string
  description = "Database password for rds-postgres"
  sensitive = true
}
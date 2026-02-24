export interface AdacApplication {
  id: string;
  name: string;
  type: string;
  technology?: string;
  description?: string;
  owner?: string;
  repository?: string;
  sla?: {
    availability_percent?: number;
    max_latency_ms?: number;
    rto_minutes?: number;
    rpo_minutes?: number;
  };
  visual?: {
    icon?: string;
    group?: string;
    description?: string;
  };
  ai_tags?: {
    icon?: string;
    group?: string;
    description?: string;
    tags?: string[];
  };
}

export interface AdacService {
  id: string;
  service: string;
  name?: string;
  description?: string;
  runs?: string[];
  configuration?: Record<string, unknown>;
  cost?: Record<string, unknown>;
  monitoring?: Record<string, unknown>;
  tags?: Record<string, string>;
  availability_zones?: string[];
  security_groups?: string[];
  subnets?: string[];
  iam_role?: string;

  visual?: {
    icon?: string;
    group?: string;
    description?: string;
  };
  ai_tags?: {
    icon?: string;
    group?: string;
    description?: string;
    tags?: string[];
  };
  subtype?: string;
  type?: string;
  config?: Record<string, unknown>;
}

export interface AdacCloud {
  id: string;
  provider: 'aws';
  region: string;
  account_id?: string;
  vpc_id?: string;
  tier?: string;
  services: AdacService[];
}

export interface AdacConnection {
  id: string;
  from: string;
  to: string;
  source?: string;
  target?: string;
  type: string;
}

export interface AdacConfig {
  version: '0.1';
  metadata: {
    name: string;
    created: string;
    description?: string;
    author?: string;
    version?: string;
    updated?: string;
    organization?: string;
    tags?: string[];
    environment?: 'development' | 'staging' | 'production' | 'test' | 'demo';
  };
  applications?: AdacApplication[];
  infrastructure: {
    clouds: AdacCloud[];
  };
  connections?: AdacConnection[];
  cost?: Record<string, unknown>;
  layout?: 'elk' | 'dagre';
}

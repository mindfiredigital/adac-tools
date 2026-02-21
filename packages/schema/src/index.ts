export interface AdacApplication {
  id: string;
  name: string;
  type: string;
  technology?: string;
  ai_tags?: {
    icon?: string;
    group?: string;
    description?: string;
  };
}

export interface AdacService {
  id: string;
  service: string; // Renamed from type to match schema
  name?: string;
  description?: string;
  runs?: string[]; // Application IDs
  configuration?: any; // Service-specific config
  cost?: any;
  monitoring?: any;
  tags?: Record<string, string>;
  
  // Deprecated/Legacy fields to keep for now if needed, or remove? 
  // Schema does not have these, so removing to be safe and strictly typed.
  // subtype?: string; 
  // subnets?: string[];
  // config?: any;
  
  ai_tags?: {
    icon?: string;
    group?: string;
    description?: string;
  };
}

export interface AdacCloud {
  id: string; // Added id
  provider: 'aws'; // Constrained to aws
  region: string;
  account_id?: string;
  vpc_id?: string;
  tier?: string;
  services: AdacService[];
}

export interface AdacConnection {
  id?: string;
  from: string;
  to: string;
  source?: string; // Backwards compatibility? or deprecated
  target?: string;
  type: string;
}

export interface AdacConfig {
  applications: AdacApplication[];
  infrastructure: {
    clouds: AdacCloud[];
  };
  connections?: AdacConnection[];
  layout?: 'elk' | 'dagre';
}

export * from './validator.js';

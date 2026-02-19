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
  type: string;
  subtype?: string;
  runs?: string[];
  name?: string;
  description?: string;
  subnets?: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config?: any; // shorthand used in some yamls
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  configuration?: any; // full name used in others
  ai_tags?: {
    icon?: string;
    group?: string;
    description?: string;
  };
}

export interface AdacCloud {
  provider: string;
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

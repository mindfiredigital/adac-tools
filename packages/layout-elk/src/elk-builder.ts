import type { AdacConfig } from '@mindfiredigital/adac-validator';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ElkNode, ElkEdge } from './types.js';

let fsPromise: Promise<typeof import('fs')> | undefined;
let pathPromise: Promise<typeof import('path')> | undefined;

const getFs = () => (fsPromise ??= import('fs'));
const getPath = () => (pathPromise ??= import('path'));

const isBrowser =
  typeof window !== 'undefined' && typeof document !== 'undefined';

type AdacService =
  AdacConfig['infrastructure']['clouds'][number]['services'][number];
type AdacApplication = NonNullable<AdacConfig['applications']>[number];
type AdacCloud = AdacConfig['infrastructure']['clouds'][number];

type IconProvider = 'aws' | 'gcp' | 'azure';

const PROVIDER_FOLDERS: Record<IconProvider, string> = {
  aws: 'icons-aws',
  gcp: 'icons-gcp',
  azure: 'icons-azure',
};

async function iconMapCandidates(provider: IconProvider): Promise<string[]> {
  const folder = PROVIDER_FOLDERS[provider];
  const path = await getPath();
  return [
    path.resolve(__dirname, '..', '..', folder, 'mappings', 'icon-map.json'),
    path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      '@mindfiredigital',
      `adac-${folder}`,
      'mappings',
      'icon-map.json'
    ),
    path.resolve(
      process.cwd(),
      'packages',
      folder,
      'mappings',
      'icon-map.json'
    ),
    path.resolve(process.cwd(), folder, 'mappings', 'icon-map.json'),
  ];
}

async function loadIconMap(
  provider: IconProvider
): Promise<Record<string, string>> {
  try {
    if (isBrowser) {
      const resp = await fetch(`/mappings/${provider}-icons.json`);
      if (!resp.ok) return {};
      return resp.json();
    }

    const fs = await getFs();
    for (const p of await iconMapCandidates(provider)) {
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
      }
    }
    console.warn(
      `Warning: Could not find ${provider.toUpperCase()} icon-map.json. ` +
        `Run: pnpm --filter @mindfiredigital/adac-${PROVIDER_FOLDERS[provider]} setup-icons`
    );
  } catch (e) {
    console.error(`Failed to load ${provider.toUpperCase()} icon-map.json`, e);
  }
  return {};
}

async function assetCandidates(
  provider: IconProvider,
  relativePath: string
): Promise<string[]> {
  const path = await getPath();
  const folder = PROVIDER_FOLDERS[provider];
  return [
    // dist/assets — only AWS historically shipped icons inside the package
    path.resolve(__dirname, 'assets', relativePath),
    path.resolve(__dirname, '..', '..', folder, 'assets', relativePath),
    path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      '@mindfiredigital',
      `adac-${folder}`,
      'assets',
      relativePath
    ),
    path.resolve(process.cwd(), 'packages', folder, 'assets', relativePath),
    path.resolve(process.cwd(), folder, 'assets', relativePath),
    path.resolve(process.cwd(), 'assets', relativePath),
  ];
}

async function resolveProviderAssetPath(
  provider: IconProvider,
  relativePath?: string
): Promise<string | undefined> {
  if (!relativePath) return undefined;
  if (isBrowser) return relativePath;

  const fs = await getFs();
  for (const p of await assetCandidates(provider, relativePath)) {
    if (fs.existsSync(p)) return p;
  }
  console.warn(
    `Could not resolve ${provider.toUpperCase()} icon path:`,
    relativePath
  );
  return undefined;
}

const ICON_MAP_PROMISE: Promise<Record<string, string>> = loadIconMap('aws');
const GCP_ICON_MAP_PROMISE: Promise<Record<string, string>> =
  loadIconMap('gcp');
const AZURE_ICON_MAP_PROMISE: Promise<Record<string, string>> =
  loadIconMap('azure');

// ── Shared ELK layout option presets ────────────────────────────────────────
// Increased and symmetric so labels at the top of containers have breathing
// room and nested groups don't visually crowd each other.
const CONTAINER_PADDING = '[top=60,left=40,bottom=40,right=40]';

// Container nodes interpret their `width`/`height` as MINIMUMS thanks to
// the MINIMUM_SIZE constraint, and grow to fit their label + children.
const CONTAINER_LAYOUT_OPTIONS: Record<string, string> = {
  'elk.padding': CONTAINER_PADDING,
  'elk.spacing.nodeNode': '50',
  'elk.nodeSize.constraints': 'NODE_LABELS MINIMUM_SIZE',
};

// Leaf nodes (services, apps, implicit external nodes). Lets ELK enlarge a
// node when its label is wider than the icon, instead of clipping the text.
const LEAF_NODE_LAYOUT_OPTIONS: Record<string, string> = {
  'elk.nodeSize.constraints': 'NODE_LABELS MINIMUM_SIZE',
};

export type ElkEdgeRoutingMode = 'ORTHOGONAL' | 'POLYLINE' | 'SPLINES';

export interface BuildElkGraphOptions {
  edgeRoutingMode?: ElkEdgeRoutingMode;
}

const DEFAULT_EDGE_ROUTING_MODE: ElkEdgeRoutingMode = 'ORTHOGONAL';

// Approximate SVG label metrics for the current node font. Wider fonts or
// localized labels may need larger values, or configurable metrics per theme.
const NODE_LABEL_CHAR_WIDTH = 6.5;
const NODE_LABEL_HORIZONTAL_PADDING = 40;

// Service/app types that should be pinned to the FIRST layer so the diagram
// reads "user → cloud" left-to-right (or top-to-bottom).
const ENTRY_NODE_TYPES = new Set([
  'user',
  'client',
  'internet',
  'browser',
  'mobile',
  'frontend',
]);

// Storage/database service types that belong on the LAST layer so data
// stores naturally appear after the compute that talks to them.
const STORAGE_SERVICE_TYPES = new Set([
  // AWS
  'rds',
  's3',
  'dynamodb',
  'redshift',
  'aurora',
  'documentdb',
  'elasticache',
  'efs',
  // GCP
  'cloud-sql',
  'cloudsql',
  'bigquery',
  'firestore',
  'cloud-storage',
  'cloud-spanner',
  'bigtable',
  'memorystore',
  'alloydb',
  'persistent-disk',
  // Azure
  'cosmos-db',
  'sql-database',
  'storage-account',
  'blob-storage',
  // Generic
  'database',
  'db',
  'storage',
]);

function selectDefaultVpcId(
  subnetToVpcMap: Map<string, string>
): string | undefined {
  if (subnetToVpcMap.size === 0) return undefined;

  const subnetCounts = new Map<string, number>();
  for (const vpcId of subnetToVpcMap.values()) {
    subnetCounts.set(vpcId, (subnetCounts.get(vpcId) || 0) + 1);
  }

  return Array.from(subnetCounts.entries()).sort(
    ([aId, aCount], [bId, bCount]) => bCount - aCount || aId.localeCompare(bId)
  )[0]?.[0];
}

// AWS Colors matching AWS Diagrams
const STYLES = {
  vpc: { type: 'container', style: 'vpc', cssClass: 'aws-vpc' },
  az: { type: 'container', style: 'az', cssClass: 'aws-az' },
  subnet: { type: 'container', style: 'subnet', cssClass: 'aws-subnet' },
  publicSubnet: {
    type: 'container',
    style: 'subnet-public',
    cssClass: 'aws-subnet-public',
  },
  privateSubnet: {
    type: 'container',
    style: 'subnet-private',
    cssClass: 'aws-subnet-private',
  },
  compute: {
    type: 'container',
    style: 'compute-cluster',
    cssClass: 'aws-compute-cluster',
  },
  service: { type: 'node', style: 'service' },
  app: { type: 'node', style: 'app' },
};

// GCP Container Styles — uses Google Cloud color palette
const GCP_STYLES = {
  // GCP VPC Network (blue border, dotted)
  vpc: { type: 'container', style: 'gcp-vpc', cssClass: 'gcp-vpc' },
  // GCP Region container (teal/green border)
  region: { type: 'container', style: 'gcp-region', cssClass: 'gcp-region' },
  // GCP Zone (lighter blue)
  zone: { type: 'container', style: 'gcp-zone', cssClass: 'gcp-zone' },
  // GCP Subnetwork
  subnet: { type: 'container', style: 'gcp-subnet', cssClass: 'gcp-subnet' },
  // GCP compute cluster (e.g. GKE)
  compute: {
    type: 'container',
    style: 'gcp-compute-cluster',
    cssClass: 'gcp-compute-cluster',
  },
  service: { type: 'node', style: 'gcp-service' },
  app: { type: 'node', style: 'app' },
};

// Azure Container Styles — uses Microsoft Azure color palette (blue)
const AZURE_STYLES = {
  // Azure VNet / Resource Group
  vpc: {
    type: 'container',
    style: 'azure-vnet',
    cssClass: 'azure-vnet azure-vpc',
  },
  // Azure Subscription
  region: {
    type: 'container',
    style: 'azure-subscription',
    cssClass: 'azure-subscription azure-rg',
  },
  // Azure Subnet
  subnet: {
    type: 'container',
    style: 'azure-subnet',
    cssClass: 'azure-subnet azure-container',
  },
  // Azure compute cluster/group
  compute: {
    type: 'container',
    style: 'azure-compute-cluster',
    cssClass: 'azure-compute-cluster',
  },
  service: { type: 'node', style: 'azure-service' },
  app: { type: 'node', style: 'app' },
};

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Manual aliases for common short codes to full AWS names (if not auto-resolved)
const ALIASES: Record<string, string> = {
  ec2: 'Amazon Elastic Compute Cloud (Amazon EC2)',
  s3: 'Amazon Simple Storage Service (Amazon S3)',
  lambda: 'AWS Lambda',
  vpc: 'Amazon Virtual Private Cloud (Amazon VPC)',
  dynamodb: 'Amazon DynamoDB',
  rds: 'Amazon Relational Database Service (Amazon RDS)',
  sqs: 'Amazon Simple Queue Service (Amazon SQS)',
  sns: 'Amazon Simple Notification Service (Amazon SNS)',
  cloudfront: 'Amazon CloudFront',
  alb: 'Application Load Balancer',
  elb: 'Elastic Load Balancing',
  apigateway: 'Amazon API Gateway',
  eks: 'Amazon Elastic Kubernetes Service (Amazon EKS)',
  ecs: 'Amazon Elastic Container Service (Amazon ECS)',
  fargate: 'AWS Fargate',
  kinesis: 'Amazon Kinesis',
  glue: 'AWS Glue',
  athena: 'Amazon Athena',
  redshift: 'Amazon Redshift',
  route53: 'Amazon Route 53',
  iam: 'AWS Identity and Access Management (IAM)',
  cloudwatch: 'Amazon CloudWatch',
  cloudtrail: 'AWS CloudTrail',
  config: 'AWS Config',
  kms: 'AWS Key Management Service (AWS KMS)',
  secretsmanager: 'AWS Secrets Manager',
  waf: 'AWS WAF',
  shield: 'AWS Shield',
  codepipeline: 'AWS CodePipeline',
  codebuild: 'AWS CodeBuild',
  codecommit: 'AWS CodeCommit',
  codedeploy: 'AWS CodeDeploy',
  cognito: 'Amazon Cognito',
  'api-gateway-rest': 'Amazon API Gateway',
  'api-gateway-http': 'Amazon API Gateway',
  eventbridge: 'Amazon EventBridge',
  'step-functions': 'AWS Step Functions',
  'kinesis-streams': 'Amazon Kinesis Data Streams',
  emr: 'Amazon EMR',
  quicksight: 'Amazon QuickSight',
  sagemaker: 'Amazon SageMaker',
  macie: 'Amazon Macie',
};

// GCP aliases: short/common names → canonical GCP icon-map keys
const GCP_ALIASES: Record<string, string> = {
  gce: 'compute-engine',
  computeengine: 'Compute Engine',
  cloudrun: 'Cloud Run',
  gke: 'Kubernetes Engine',
  googlekubernetesengine: 'Kubernetes Engine',
  kubernetes: 'Kubernetes Engine',
  cloudfunctions: 'Cloud Functions',
  appengine: 'App Engine',
  cloudsql: 'Cloud SQL',
  cloudspanner: 'Cloud Spanner',
  bigtable: 'Bigtable',
  firestore: 'Firestore',
  memorystore: 'Memorystore',
  alloydb: 'AlloyDB',
  cloudstorage: 'Cloud Storage',
  gcs: 'Cloud Storage',
  persistentdisk: 'Persistent Disk',
  filestore: 'Filestore',
  vpc: 'Virtual Private Cloud',
  virtualprivatecloud: 'Virtual Private Cloud',
  cloudloadbalancing: 'Cloud Load Balancing',
  loadbalancer: 'Cloud Load Balancing',
  cloudlb: 'Cloud Load Balancing',
  clouddns: 'Cloud DNS',
  cloudcdn: 'Cloud CDN',
  cloudarmor: 'Cloud Armor',
  cloudnat: 'Cloud NAT',
  cloudvpn: 'Cloud VPN',
  pubsub: 'Pub/Sub',
  cloudpubsub: 'Pub/Sub',
  eventarc: 'Eventarc',
  cloudtasks: 'Cloud Tasks',
  cloudscheduler: 'Cloud Scheduler',
  bigquery: 'BigQuery',
  dataflow: 'Dataflow',
  dataproc: 'Dataproc',
  cloudcomposer: 'Cloud Composer',
  looker: 'Looker',
  lookerstudio: 'Looker Studio',
  vertexai: 'Vertex AI',
  aiplatform: 'AI Platform',
  naturallanguageapi: 'Natural Language API',
  visionapi: 'Vision API',
  speechtotext: 'Speech-to-Text',
  dialogflow: 'Dialogflow',
  documentai: 'Document AI',
  cloudiam: 'Cloud IAM',
  iam: 'Cloud IAM',
  identityawareproxy: 'Identity-Aware Proxy',
  iap: 'Identity-Aware Proxy',
  cloudkms: 'Cloud KMS',
  kms: 'Cloud KMS',
  secretmanager: 'Secret Manager',
  securitycommandcenter: 'Security Command Center',
  cloudmonitoring: 'Cloud Monitoring',
  cloudlogging: 'Cloud Logging',
  cloudtrace: 'Cloud Trace',
  cloudbuild: 'Cloud Build',
  artifactregistry: 'Artifact Registry',
  clouddeploy: 'Cloud Deploy',
  containerregistry: 'Container Registry',
  subnet: 'Subnetwork',
  subnetwork: 'Subnetwork',
  region: 'Region',
  zone: 'Zone',
  project: 'Project',
  database: 'Firestore', // Map generic database to a service that uses Databases category icon
  storage: 'Cloud Storage',
};

// Pre-compute normalized map for fuzzy lookup (AWS)
const NORMALIZED_MAP = new Map<string, string>();

// Pre-compute normalized map for fuzzy lookup (GCP)
const GCP_NORMALIZED_MAP = new Map<string, string>();

let initializePromise:
  | Promise<{
      aws: Record<string, string>;
      gcp: Record<string, string>;
      azure: Record<string, string>;
    }>
  | undefined;

function initializeIconMaps() {
  if (!initializePromise) {
    initializePromise = (async () => {
      const [aws, gcp, azure] = await Promise.all([
        ICON_MAP_PROMISE,
        GCP_ICON_MAP_PROMISE,
        AZURE_ICON_MAP_PROMISE,
      ]);

      for (const key of Object.keys(aws)) {
        NORMALIZED_MAP.set(normalizeKey(key), key);
      }

      for (const key of Object.keys(gcp)) {
        GCP_NORMALIZED_MAP.set(normalizeKey(key), key);
      }

      return { aws, gcp, azure };
    })();
  }

  return initializePromise;
}

export async function buildElkGraph(
  adac: AdacConfig,
  options: BuildElkGraphOptions = {}
): Promise<ElkNode> {
  const {
    aws: ICON_MAP,
    gcp: GCP_ICON_MAP,
    azure: AZURE_ICON_MAP,
  } = await initializeIconMaps();

  const nodesMap = new Map<string, ElkNode>();
  const edges: ElkEdge[] = [];

  // Root node (Cloud Region usually, or just canvas)
  const rootChildren: ElkNode[] = [];

  // Detect cloud provider(s) — used to select icon sets
  const providers = new Set<string>(
    (adac.infrastructure?.clouds || []).map((c: AdacCloud) =>
      (c.provider || 'aws').toLowerCase()
    )
  );
  const isGcp = providers.has('gcp');
  const isAzure = providers.has('azure');

  const estimatedNodeCount =
    (adac.applications || []).length +
    (adac.infrastructure?.clouds || []).reduce(
      (sum, c) => sum + (c.services || []).length,
      0
    );
  const estimatedEdgeCount = (adac.connections || []).length;
  const isDenseGraph = estimatedNodeCount > 40 || estimatedEdgeCount > 80;
  const edgeRoutingMode = options.edgeRoutingMode ?? DEFAULT_EDGE_ROUTING_MODE;
  const edgeSpacing = isDenseGraph
    ? {
        nodeNodeBetweenLayers: '180',
        edgeNodeBetweenLayers: '100',
        edgeEdgeBetweenLayers: '60',
      }
    : {
        nodeNodeBetweenLayers: '140',
        edgeNodeBetweenLayers: '60',
        edgeEdgeBetweenLayers: '30',
      };
  const getIconPath = async (
    key: string,
    forceProvider?: 'aws' | 'gcp' | 'azure'
  ) => {
    if (!key) return undefined;
    const provider =
      forceProvider || (isAzure ? 'azure' : isGcp ? 'gcp' : 'aws');

    if (provider === 'gcp') {
      return await getGcpIconPath(key);
    }
    if (provider === 'azure') {
      return await getAzureIconPath(key);
    }
    return await getAwsIconPath(key);
  };

  // --- AWS Icon resolution ---
  const getAwsIconPath = async (key: string) => {
    if (!key) return undefined;

    // 1. Direct Lookup
    if (ICON_MAP[key]) return await resolveAwsAssetPath(ICON_MAP[key]);

    const lowerKey = normalizeKey(key);

    // 2. Alias Lookup
    if (ALIASES[lowerKey] && ICON_MAP[ALIASES[lowerKey]]) {
      return await resolveAwsAssetPath(ICON_MAP[ALIASES[lowerKey]]);
    }

    // 3. Normalized Lookup
    if (NORMALIZED_MAP.has(lowerKey)) {
      return await resolveAwsAssetPath(ICON_MAP[NORMALIZED_MAP.get(lowerKey)!]);
    }

    // 4. Fuzzy / Substring Lookup
    for (const [nKey, originalKey] of NORMALIZED_MAP.entries()) {
      if (nKey.includes(lowerKey) || lowerKey.includes(nKey)) {
        return await resolveAwsAssetPath(ICON_MAP[originalKey]);
      }
    }

    // 5. Fallback for generics
    if (lowerKey.includes('database') || lowerKey.includes('db'))
      return await resolveAwsAssetPath(ICON_MAP['AWS::RDS']);
    if (lowerKey.includes('user'))
      return await resolveAwsAssetPath(ICON_MAP['AWS::IAM::User']);
    if (lowerKey.includes('client'))
      return await resolveAwsAssetPath(ICON_MAP['AWS::IAM::User']);

    return undefined;
  };

  // --- GCP Icon resolution ---
  const getGcpIconPath = async (key: string) => {
    if (!key) return undefined;

    // 1. Direct lookup in GCP map
    if (GCP_ICON_MAP[key]) return await resolveGcpAssetPath(GCP_ICON_MAP[key]);

    const lowerKey = normalizeKey(key);

    // 2. GCP Alias lookup
    if (GCP_ALIASES[lowerKey] && GCP_ICON_MAP[GCP_ALIASES[lowerKey]]) {
      return await resolveGcpAssetPath(GCP_ICON_MAP[GCP_ALIASES[lowerKey]]);
    }

    // 3. Normalized lookup
    if (GCP_NORMALIZED_MAP.has(lowerKey)) {
      return await resolveGcpAssetPath(
        GCP_ICON_MAP[GCP_NORMALIZED_MAP.get(lowerKey)!]
      );
    }

    // 4. Fuzzy / partial match
    for (const [nKey, originalKey] of GCP_NORMALIZED_MAP.entries()) {
      if (nKey.includes(lowerKey) || lowerKey.includes(nKey)) {
        return await resolveGcpAssetPath(GCP_ICON_MAP[originalKey]);
      }
    }

    return undefined;
  };

  // --- Azure Icon resolution ---
  const getAzureIconPath = async (key: string) => {
    if (!key) return undefined;

    // 1. Direct lookup in Azure map
    if (AZURE_ICON_MAP[key])
      return await resolveAzureAssetPath(AZURE_ICON_MAP[key]);

    const lowerKey = normalizeKey(key);

    // 2. Normalized lookup
    if (AZURE_ICON_MAP[lowerKey]) {
      return await resolveAzureAssetPath(AZURE_ICON_MAP[lowerKey]);
    }

    // 3. Fuzzy / partial match
    for (const [originalKey, iconPath] of Object.entries(AZURE_ICON_MAP)) {
      const normalized = normalizeKey(originalKey);
      if (normalized.includes(lowerKey) || lowerKey.includes(normalized)) {
        return await resolveAzureAssetPath(iconPath);
      }
    }

    return undefined;
  };

  const resolveAwsAssetPath = async (relativePath?: string) =>
    await resolveProviderAssetPath('aws', relativePath);
  const resolveGcpAssetPath = async (relativePath?: string) =>
    await resolveProviderAssetPath('gcp', relativePath);
  const resolveAzureAssetPath = async (relativePath?: string) =>
    await resolveProviderAssetPath('azure', relativePath);

  const getServiceType = (service: AdacService): string => {
    return service.service || service.subtype || service.type || 'unknown';
  };

  // Detect if a cloud is GCP-based
  const isGcpCloud = (cloud: AdacCloud) =>
    (cloud.provider || '').toLowerCase() === 'gcp';

  // Detect if a cloud is Azure-based
  const isAzureCloud = (cloud: AdacCloud) =>
    (cloud.provider || '').toLowerCase() === 'azure';

  const getProviderIconPath = async (
    key: string,
    isAzureProvider: boolean,
    isGcpProvider: boolean
  ) => {
    if (isAzureProvider) return await getAzureIconPath(key);
    if (isGcpProvider) return await getGcpIconPath(key);
    return await getAwsIconPath(key);
  };

  const isSubnetNode = (node: ElkNode) => {
    const role = node.properties?.nodeRole;
    if (role === 'subnet') return true;
    if (role !== undefined) return false;

    const cssClass = node.properties?.cssClass;
    return typeof cssClass === 'string' && cssClass.includes('subnet');
  };

  // Select STYLES based on cloud provider
  const getStylesForCloud = (cloud: AdacCloud) => {
    if (isAzureCloud(cloud)) return AZURE_STYLES;
    if (isGcpCloud(cloud)) return GCP_STYLES;
    return STYLES;
  };

  const detectIconForApp = async (app: AdacApplication) => {
    // 1. Prefer AI Inference
    if (app.insight_tags?.icon) {
      const p = await getIconPath(app.insight_tags.icon);
      if (p) return p;
    }

    // Check technology for generic matches
    const tech = (app.technology || '').toLowerCase();
    if (
      tech.includes('react') ||
      tech.includes('vue') ||
      tech.includes('angular')
    )
      return await getIconPath('Front-End Web & Mobile');
    if (
      tech.includes('node') ||
      tech.includes('java') ||
      tech.includes('python')
    )
      return await getIconPath('Compute');

    // Generic type fallback mapping
    const type = (app.type || '').toLowerCase();
    if (type === 'frontend' || type === 'web' || type === 'ui') {
      return (
        (await getIconPath('Front-End Web & Mobile')) ||
        (await getIconPath('Application'))
      );
    }
    if (type === 'backend' || type === 'api' || type === 'service') {
      if (isGcp) return await getGcpIconPath('cloud-run');
      if (isAzure)
        return (
          (await getAzureIconPath('app-service')) ||
          (await getIconPath('Compute'))
        );
      return await getIconPath('Compute');
    }
    if (type === 'worker' || type === 'job' || type === 'task') {
      if (isGcp) return await getGcpIconPath('cloud-functions');
      if (isAzure)
        return (
          (await getAzureIconPath('azure-functions')) ||
          (await getIconPath('Compute'))
        );
      return await getIconPath('Compute');
    }
    if (type === 'database' || type === 'db') {
      return await getIconPath('database');
    }

    // Fallbacks
    return (
      (await getIconPath(app.type)) ||
      (isGcp
        ? await getGcpIconPath('compute-engine')
        : await getIconPath('Application'))
    );
  };

  // Choose a per-node layer constraint so the diagram reads in flow order:
  // entry points pinned to the FIRST layer, data stores pinned to the LAST.
  const layerConstraintFor = (
    typeKey: string
  ): 'FIRST' | 'LAST' | undefined => {
    const t = (typeKey || '').toLowerCase();
    if (ENTRY_NODE_TYPES.has(t)) return 'FIRST';
    if (STORAGE_SERVICE_TYPES.has(t)) return 'LAST';
    return undefined;
  };

  const buildLeafLayoutOptions = (
    typeKey: string,
    minW: number,
    minH: number
  ): Record<string, string> => {
    const opts: Record<string, string> = {
      ...LEAF_NODE_LAYOUT_OPTIONS,
      'elk.nodeSize.minimum': `(${minW}, ${minH})`,
    };
    const layer = layerConstraintFor(typeKey);
    if (layer) opts['elk.layered.layering.layerConstraint'] = layer;
    return opts;
  };

  const calcNodeWidth = (label: string, contents: string[] = []): number => {
    const longestText = [label, ...contents].reduce(
      (longest, text) => (text.length > longest.length ? text : longest),
      label
    );
    return Math.max(
      80,
      longestText.length * NODE_LABEL_CHAR_WIDTH + NODE_LABEL_HORIZONTAL_PADDING
    );
  };

  // 1. Create Nodes for Applications
  for (const app of adac.applications || []) {
    const iconPath = await detectIconForApp(app);
    const labelText = app.name || app.id;
    let dynamicW = calcNodeWidth(labelText, app.contents ?? []);

    let dynamicH = 100;
    if (app.contents?.length) {
      dynamicH += app.contents.length * 35 + 25;
      dynamicW += 20;
    }

    const node: ElkNode = {
      id: app.id,
      width: dynamicW,
      height: dynamicH,
      labels: [{ text: labelText }],
      properties: {
        type: 'app',
        iconPath,
        title: app.type,
        direction: app.direction,
        contents: app.contents,
        isStacked: app.type === 'cluster',
      },
      layoutOptions: buildLeafLayoutOptions(app.type || '', dynamicW, dynamicH),
    };
    nodesMap.set(app.id, node);
  }

  // 1.5 Create Nodes for Logical Groups
  const logicalGroups = new Set<string>();
  const collectGroup = (obj: AdacApplication | AdacService) => {
    if (obj.insight_tags?.group) logicalGroups.add(obj.insight_tags.group);
  };

  (adac.applications || []).forEach(collectGroup);
  (adac.infrastructure?.clouds || []).forEach((c: AdacCloud) =>
    (c.services || []).forEach(collectGroup)
  );

  logicalGroups.forEach((groupName) => {
    const groupId = `group-${groupName.replace(/\s+/g, '-')}`;
    const node: ElkNode = {
      id: groupId,
      // Treated as minimums by CONTAINER_LAYOUT_OPTIONS; ELK grows them as
      // children are added during the hierarchy pass.
      width: 320,
      height: 220,
      labels: [{ text: groupName }],
      children: [],
      properties: {
        type: 'container',
        cssClass: 'aws-compute-cluster', // Reuse style
        title: 'Logical Group',
      },
      layoutOptions: {
        ...CONTAINER_LAYOUT_OPTIONS,
        'elk.nodeSize.minimum': '(320, 220)',
      },
    };
    nodesMap.set(groupId, node);
  });

  // 2. Create Nodes for Infrastructure Services (Pass 1)
  for (const cloud of adac.infrastructure?.clouds || []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cloudStyles = getStylesForCloud(cloud) as any;
    const gcpCloud = isGcpCloud(cloud);

    for (const service of cloud.services || []) {
      let width = 80;
      let height = 100;
      let style: { type: string; style: string; cssClass?: string } =
        cloudStyles.service;

      const typeKey = getServiceType(service);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cfg = (service.config || service.configuration || {}) as any;

      // Identify Containers
      const runsApps = service.runs && service.runs.length > 0;

      if (gcpCloud) {
        // GCP container detection
        if (typeKey === 'vpc' || typeKey === 'virtual-private-cloud') {
          width = 400;
          height = 400;
          style = cloudStyles.vpc;
        } else if (typeKey === 'subnet' || typeKey === 'subnetwork') {
          width = 250;
          height = 250;
          style = cloudStyles.subnet;
        } else if (typeKey === 'zone') {
          width = 300;
          height = 300;
          style = cloudStyles.zone || GCP_STYLES.zone;
        } else if (typeKey === 'region') {
          width = 450;
          height = 350;
          style = cloudStyles.region || GCP_STYLES.region;
        } else if (
          runsApps ||
          [
            'gke',
            'google-kubernetes-engine',
            'cloud-run',
            'compute-engine',
            'app-engine',
          ].includes(typeKey)
        ) {
          width = 300;
          height = 250;
          style = cloudStyles.compute;
        }
      } else if (isAzureCloud(cloud)) {
        // Azure container detection
        if (
          typeKey === 'vpc' ||
          typeKey === 'resource-group' ||
          typeKey === 'virtual-network' ||
          typeKey === 'vnet'
        ) {
          width = 400;
          height = 400;
          style = cloudStyles.vpc;
        } else if (typeKey === 'subnet') {
          width = 250;
          height = 250;
          style = cloudStyles.subnet;
        } else if (typeKey === 'region' || typeKey === 'subscription') {
          width = 450;
          height = 350;
          style = cloudStyles.region;
        } else if (
          runsApps ||
          ['aks', 'compute', 'vm', 'container'].includes(typeKey)
        ) {
          width = 300;
          height = 250;
          style = cloudStyles.compute;
        }
      } else {
        // AWS container detection
        if (typeKey === 'vpc') {
          width = 400;
          height = 400;
          style = cloudStyles.vpc;
        } else if (typeKey === 'subnet') {
          width = 250;
          height = 250;
          const isPublic = cfg.public_access === true || cfg.public === true;
          style = isPublic
            ? cloudStyles.publicSubnet || STYLES.publicSubnet
            : cloudStyles.privateSubnet || STYLES.privateSubnet;
        } else if (
          runsApps ||
          ['ecs-fargate', 'eks', 'ecs', 'ec2'].includes(typeKey)
        ) {
          width = 300;
          height = 250;
          style = cloudStyles.compute;
        }
      }

      // Icon Resolution strategy
      const isAzureProvider = isAzureCloud(cloud);
      let iconPath = await getProviderIconPath(
        typeKey,
        isAzureProvider,
        gcpCloud
      );

      if (service.insight_tags?.icon) {
        const aiIcon = await getProviderIconPath(
          service.insight_tags.icon,
          isAzureProvider,
          gcpCloud
        );
        if (aiIcon) iconPath = aiIcon;
      }
      // Fallback: try generic icon
      if (!iconPath) {
        const fallbackIconKey = isAzureProvider
          ? 'compute'
          : gcpCloud
            ? 'compute-engine'
            : 'General resource icon';
        iconPath = await getProviderIconPath(
          fallbackIconKey,
          isAzureProvider,
          gcpCloud
        );
      }

      const isContainer = style.type === 'container';
      const isStackedSvc =
        (service.runs && service.runs.length > 1) ||
        (cfg && cfg.instances > 1) ||
        [
          'eks',
          'ecs',
          'aks',
          'azure-kubernetes-service',
          'rds',
          'aurora',
          'dynamodb',
          'msk',
          'kafka',
          'elasticache',
          'redis',
        ].includes(typeKey);

      const svcLabel = service.name || service.id;
      const dynamicW = isContainer ? width : calcNodeWidth(svcLabel);
      const dynamicH = isContainer ? height : 100;

      const node: ElkNode = {
        id: service.id,
        width: dynamicW,
        height: dynamicH,
        labels: [{ text: svcLabel }],
        children: [],
        properties: {
          type: style.type,
          cssClass: style.cssClass,
          nodeRole:
            typeKey === 'subnet' || typeKey === 'subnetwork'
              ? 'subnet'
              : undefined,
          iconPath: iconPath,
          direction: service.direction,
          description: service.description || typeKey,
          isStacked: Boolean(isStackedSvc),
        },
        layoutOptions: isContainer
          ? {
              ...CONTAINER_LAYOUT_OPTIONS,
              'elk.nodeSize.minimum': `(${width}, ${height})`,
            }
          : buildLeafLayoutOptions(typeKey, dynamicW, dynamicH),
      };
      nodesMap.set(service.id, node);
    }
  }

  // 3. Build Hierarchy (Pass 2)
  const placedNodeIds = new Set<string>();

  // Helper to place item in logical group if no infra parent
  const tryPlaceInLogicalGroup = (
    node: ElkNode,
    aiTags: AdacApplication['insight_tags']
  ) => {
    if (aiTags?.group) {
      const groupId = `group-${aiTags.group.replace(/\s+/g, '-')}`;
      const groupNode = nodesMap.get(groupId);
      if (groupNode && !placedNodeIds.has(node.id)) {
        if (!groupNode.children) groupNode.children = [];
        groupNode.children.push(node);
        placedNodeIds.add(node.id);
        return true;
      }
    }
    return false;
  };

  // Note: apps are placed by the service pass (via `runs`) or by the orphan
  // sweep further down — there's intentionally no standalone app placement
  // pass here, so a service's `runs:` claim always wins over `insight_tags.group`.

  // Process Services to assign Logic Parents
  const subnetToVpcMap = new Map<string, string>();

  // First pass: Build subnet to VPC mapping
  (adac.infrastructure?.clouds || []).forEach((cloud: AdacCloud) => {
    (cloud.services || []).forEach((service: AdacService) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cfg = (service.config || service.configuration || {}) as any;
      const svcType = getServiceType(service);
      if (
        (svcType === 'subnet' || svcType === 'subnetwork') &&
        (cfg.vpc || cfg.vnet)
      ) {
        subnetToVpcMap.set(service.id, cfg.vpc || cfg.vnet);
      }
    });
  });

  (adac.infrastructure?.clouds || []).forEach((cloud: AdacCloud) => {
    (cloud.services || []).forEach((service: AdacService) => {
      const node = nodesMap.get(service.id)!;
      let parentId: string | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cfg = (service.config || service.configuration || {}) as any;

      // Check config for parent reference (VPC/Subnet)
      if (cfg) {
        // AZ Logic (Implicit AZ Container)
        const az = cfg.availability_zone;
        if (typeof az === 'string' && cfg.vpc) {
          const vpcId = cfg.vpc;
          const azId = `${vpcId}-${az}`;

          if (!nodesMap.has(azId)) {
            // Create Implicit AZ Node in nodesMap
            const azNode: ElkNode = {
              id: azId,
              width: 300,
              height: 300,
              labels: [{ text: `AZ: ${az}` }],
              children: [],
              properties: {
                type: 'container',
                cssClass: 'aws-az',
                title: 'Availability Zone',
              },
              layoutOptions: {
                ...CONTAINER_LAYOUT_OPTIONS,
                'elk.nodeSize.minimum': '(300, 300)',
              },
            };
            nodesMap.set(azId, azNode);
            if (nodesMap.has(vpcId)) {
              const vpc = nodesMap.get(vpcId)!;
              if (!vpc.children) vpc.children = [];
              vpc.children.push(azNode);
              placedNodeIds.add(azId);
            }
          }
          if (getServiceType(service) === 'subnet') parentId = azId;
        } else if (cfg.vpc) {
          parentId = cfg.vpc;
        }
      }

      // Unified subnets resolution
      const subnets =
        service.subnets || cfg?.subnets || (cfg?.subnet ? [cfg.subnet] : []);
      if (subnets.length > 0) {
        if (subnets.length === 1) {
          parentId = subnets[0];
        } else {
          const subnetVpcIds = new Map<string, string>();
          subnets.forEach((subnetId: string) => {
            const vpcId = subnetToVpcMap.get(subnetId);
            if (vpcId) subnetVpcIds.set(subnetId, vpcId);
          });

          const uniqueVpcIds = new Set(subnetVpcIds.values());
          if (uniqueVpcIds.size === 1) {
            parentId = Array.from(uniqueVpcIds)[0];
          } else if (uniqueVpcIds.size > 1) {
            console.warn(
              `Service ${service.id} references subnets across multiple VPCs: ${Array.from(
                subnetVpcIds.entries()
              )
                .map(([subnetId, vpcId]) => `${subnetId}->${vpcId}`)
                .join(', ')}`
            );
          }
        }
      }

      // Fallback parent logic
      if (!parentId) {
        if (cfg?.vpc || cfg?.vnet) {
          parentId = cfg.vpc || cfg.vnet;
        }
      }

      // Prevent Self-Cycle
      if (parentId === service.id) parentId = undefined;

      // Claim Apps (runs)
      const runsApps = service.runs && service.runs.length > 0;
      if (runsApps) {
        service.runs?.forEach((appId: string) => {
          if (placedNodeIds.has(appId)) return;
          const appNode = nodesMap.get(appId);
          if (appNode) {
            node.children?.push(appNode);
            placedNodeIds.add(appId);
          }
        });
      }

      // Place this service in Parent
      if (
        parentId &&
        nodesMap.has(parentId) &&
        parentId !== service.id &&
        !placedNodeIds.has(service.id)
      ) {
        const parent = nodesMap.get(parentId)!;
        if (!parent.children) parent.children = [];
        parent.children.push(node);
        placedNodeIds.add(service.id);
      }

      // If NOT placed in infra, try Logical Group
      if (!placedNodeIds.has(service.id)) {
        tryPlaceInLogicalGroup(node, service.insight_tags);
      }
    });
  });

  // 4. Handle Orphans (Services & Apps)
  // Create a default "Utility / Shared Infrastructure" Group for unplaced items
  const utilityGroupId = 'group-utility-shared';
  let utilityGroupCreated = false;

  const ensureUtilityGroup = () => {
    if (utilityGroupCreated) return;
    if (nodesMap.has(utilityGroupId)) {
      utilityGroupCreated = true;
      return;
    }

    const node: ElkNode = {
      id: utilityGroupId,
      width: 320,
      height: 220,
      labels: [{ text: 'Shared Infrastructure' }],
      children: [],
      properties: {
        type: 'container',
        cssClass: 'aws-compute-cluster',
        title: 'Shared Services',
      },
      layoutOptions: {
        ...CONTAINER_LAYOUT_OPTIONS,
        'elk.nodeSize.minimum': '(320, 220)',
      },
    };
    nodesMap.set(utilityGroupId, node);
    rootChildren.push(node); // Add to root
    utilityGroupCreated = true;
  };

  // Scan Infrastructure for Orphans
  (adac.infrastructure?.clouds || []).forEach((cloud: AdacCloud) => {
    (cloud.services || []).forEach((service: AdacService) => {
      if (!placedNodeIds.has(service.id)) {
        // Try logical group first
        if (
          tryPlaceInLogicalGroup(
            nodesMap.get(service.id)!,
            service.insight_tags
          )
        )
          return;

        const type = getServiceType(service);

        // Assign compute/DB orphans to the VPC with most subnets.
        const defaultVpcId = selectDefaultVpcId(subnetToVpcMap);

        const isVpcBound = [
          'eks',
          'ecs',
          'ec2',
          'rds',
          'aurora',
          'dynamodb',
          'msk',
          'kafka',
          'elasticache',
          'redis',
          'memcached',
          'nlb',
          'alb',
          'docdb',
          'redshift',
          'emr',
          'sagemaker',
          'opensearch',
          'aks',
          'virtual-machine',
          'azure-kubernetes-service',
          'app-service',
          'azure-functions',
          'azure-sql-database',
          'cosmos-db',
          'azure-cache-for-redis',
          'azure-database-for-postgresql',
          'azure-api-management',
          'azure-service-bus',
          'azure-event-hubs',
        ].includes(type);

        if (isVpcBound && defaultVpcId) {
          const vpcNode = nodesMap.get(defaultVpcId);
          if (vpcNode) {
            // Find all subnets inside this VPC
            const subnets: ElkNode[] = [];
            const findSubnets = (node: ElkNode) => {
              if (isSubnetNode(node)) {
                subnets.push(node);
              }
              node.children?.forEach(findSubnets);
            };
            findSubnets(vpcNode);

            if (subnets.length > 0) {
              // Balance across subnets by picking the one with the fewest children
              subnets.sort(
                (a, b) => (a.children?.length || 0) - (b.children?.length || 0)
              );
              const targetSubnet = subnets[0];
              if (!targetSubnet.children) targetSubnet.children = [];
              targetSubnet.children.push(nodesMap.get(service.id)!);
            } else {
              // Fallback to VPC root if no subnets exist
              if (!vpcNode.children) vpcNode.children = [];
              vpcNode.children.push(nodesMap.get(service.id)!);
            }
            placedNodeIds.add(service.id);
            return;
          }
        }

        // Else, place in Utility Group if it looks like a backend service
        // If it's a major container like VPC, it goes to root (already handled?)
        // VPCs are containers, usually not placed inside others.
        if (
          type === 'vpc' ||
          type === 'virtual-network' ||
          type === 'resource-group' ||
          type === 'vnet'
        ) {
          // VPCs, VNets, and Resource Groups go to root
          const vpcNode = nodesMap.get(service.id)!;
          if (!rootChildren.includes(vpcNode)) rootChildren.push(vpcNode);
          placedNodeIds.add(service.id);
          return;
        }

        ensureUtilityGroup();
        const group = nodesMap.get(utilityGroupId)!;
        group.children?.push(nodesMap.get(service.id)!);
        placedNodeIds.add(service.id);
      }
    });
  });

  // Scan Apps for Orphans
  (adac.applications || []).forEach((app: AdacApplication) => {
    if (!placedNodeIds.has(app.id)) {
      if (tryPlaceInLogicalGroup(nodesMap.get(app.id)!, app.insight_tags))
        return;

      // Place in Utility? Or just root?
      const type = (app.type || '').toLowerCase();
      if (['user', 'client', 'internet', 'browser', 'mobile'].includes(type)) {
        const n = nodesMap.get(app.id)!;
        if (!rootChildren.includes(n)) rootChildren.push(n); // Keep in root
      } else {
        ensureUtilityGroup();
        const group = nodesMap.get(utilityGroupId)!;
        group.children?.push(nodesMap.get(app.id)!);
      }
      placedNodeIds.add(app.id);
    }
  });

  // 5. Edges and Implicit Nodes
  // (adac.connections || []).forEach((conn) => {
  for (const conn of adac.connections || []) {
    //
    const from = conn.from || conn.source;
    const to = conn.to || conn.target;

    if (!from || !to) continue; // Skip invalid connections

    // Check if Endpoints exist, if not create implicit "External" nodes
    // [from, to].forEach(async (endpointId) => {
    for (const endpointId of [from, to]) {
      if (!nodesMap.has(endpointId)) {
        // Smart Implicit Node Detection
        // Use appropriate icon set based on provider
        let icon: string | undefined;
        const lowerId = endpointId.toLowerCase();

        if (isGcp) {
          // GCP implicit node icons
          if (lowerId.includes('user') || lowerId.includes('internet'))
            icon = await getGcpIconPath('project');
          else if (lowerId.includes('client'))
            icon = await getGcpIconPath('project');
          else icon = await getGcpIconPath('cloud-load-balancing');
        } else {
          // AWS implicit node icons
          icon = await getAwsIconPath('Internet');
          if (lowerId.includes('user')) icon = await getAwsIconPath('User');
          else if (lowerId.includes('client'))
            icon = await getAwsIconPath('Client');
          else if (lowerId.includes('frontend'))
            icon = await getAwsIconPath('Application');
          else if (lowerId.includes('backend'))
            icon = await getAwsIconPath('Compute');
        }

        // External user/client/internet/frontend nodes are entry points;
        // pin them to the first layer so the diagram reads in flow order.
        const isEntry =
          lowerId.includes('user') ||
          lowerId.includes('client') ||
          lowerId.includes('internet') ||
          lowerId.includes('frontend') ||
          lowerId.includes('browser') ||
          lowerId.includes('mobile');

        const implicitLayoutOptions: Record<string, string> = {
          ...LEAF_NODE_LAYOUT_OPTIONS,
          'elk.nodeSize.minimum': `(${calcNodeWidth(endpointId)}, 80)`,
        };
        if (isEntry) {
          implicitLayoutOptions['elk.layered.layering.layerConstraint'] =
            'FIRST';
        }

        const implicitNode: ElkNode = {
          id: endpointId,
          width: calcNodeWidth(endpointId),
          height: 80,
          labels: [{ text: endpointId }],
          properties: {
            type: 'node',
            iconPath: icon,
            description: 'External System',
          },
          layoutOptions: implicitLayoutOptions,
        };
        nodesMap.set(endpointId, implicitNode);
        rootChildren.push(implicitNode); // Implicit nodes are always top-level
      }
    }

    edges.push({
      id: conn.id || `${from}->${to}`,
      sources: [from],
      targets: [to],
      labels: [{ text: conn.type }],
    });
  }

  // Final Sweep: Add any top-level nodes (Logical Groups) to root if not present
  nodesMap.forEach((node, id) => {
    if (id.startsWith('group-') && !rootChildren.includes(node)) {
      // Only add if it has children?
      if (node.children && node.children.length > 0) {
        rootChildren.push(node);
      }
    }
  });

  return {
    id: 'root',
    properties: {
      type: 'container',
      cssClass: isGcp ? 'gcp-root' : 'aws-root',
    },
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.edgeRouting': edgeRoutingMode,

      'elk.layered.spacing.nodeNodeBetweenLayers':
        edgeSpacing.nodeNodeBetweenLayers,
      'elk.spacing.nodeNode': '80',
      'elk.spacing.edgeNode': '30',
      'elk.spacing.edgeEdge': '15',
      'elk.layered.spacing.edgeNodeBetweenLayers':
        edgeSpacing.edgeNodeBetweenLayers,
      'elk.layered.spacing.edgeEdgeBetweenLayers':
        edgeSpacing.edgeEdgeBetweenLayers,

      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
      'elk.layered.nodePlacement.favorStraightEdges': 'true',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.layering.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.thoroughness': isDenseGraph ? '7' : '10',
      'elk.layered.compaction.postCompaction.strategy': 'EDGE_LENGTH',

      'elk.layered.mergeEdges': isDenseGraph ? 'false' : 'true',
      'elk.layered.unnecessaryBendpoints': 'true',
      'elk.layered.feedbackEdges': 'true',

      'elk.separateConnectedComponents': 'true',
      'elk.spacing.componentComponent': isDenseGraph ? '80' : '60',

      'elk.aspectRatio': isDenseGraph ? '2.0' : '1.6',
    },
    children: rootChildren,
    edges,
  };
}

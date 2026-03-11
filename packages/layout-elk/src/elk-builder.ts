import {
  AdacConfig,
  AdacService,
  AdacApplication,
  AdacCloud,
} from '@mindfiredigital/adac-schema';
import { ElkNode, ElkEdge } from './types.js';
import path from 'path';
import fs from 'fs';

// Load AWS Icon Map
let ICON_MAP: Record<string, string> = {};

try {
  const distMapping = path.join(__dirname, 'mappings', 'icon-map.json');
  const srcMapping = path.resolve(
    __dirname,
    '..',
    'src',
    'mappings',
    'icon-map.json'
  );

  if (fs.existsSync(distMapping)) {
    ICON_MAP = JSON.parse(fs.readFileSync(distMapping, 'utf8'));
  } else if (fs.existsSync(srcMapping)) {
    ICON_MAP = JSON.parse(fs.readFileSync(srcMapping, 'utf8'));
  } else {
    console.warn(
      `Warning: Could not find icon-map.json at ${distMapping} or ${srcMapping}`
    );
  }
} catch (e) {
  console.error('Failed to load icon-map.json', e);
}

// Load GCP Icon Map
let GCP_ICON_MAP: Record<string, string> = {};

try {
  const gcpMapPaths = [
    // Next to this compiled file (dist/)
    path.resolve(__dirname, '..', '..', '..', 'icons-gcp', 'mappings', 'icon-map.json'),
    path.resolve(__dirname, '..', '..', '..', '..', 'packages', 'icons-gcp', 'mappings', 'icon-map.json'),
    // Relative to process cwd
    path.resolve(process.cwd(), 'packages', 'icons-gcp', 'mappings', 'icon-map.json'),
    path.resolve(process.cwd(), 'icons-gcp', 'mappings', 'icon-map.json'),
  ];

  for (const p of gcpMapPaths) {
    if (fs.existsSync(p)) {
      GCP_ICON_MAP = JSON.parse(fs.readFileSync(p, 'utf8'));
      break;
    }
  }

  if (Object.keys(GCP_ICON_MAP).length === 0) {
    console.warn('Warning: Could not find GCP icon-map.json. Run: pnpm --filter @mindfiredigital/adac-icons-gcp setup-icons');
  }
} catch (e) {
  console.error('Failed to load GCP icon-map.json', e);
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

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Pre-compute normalized map for fuzzy lookup (AWS)
const NORMALIZED_MAP = new Map<string, string>();
Object.keys(ICON_MAP).forEach((k) => {
  NORMALIZED_MAP.set(normalizeKey(k), k);
});

// Pre-compute normalized map for fuzzy lookup (GCP)
const GCP_NORMALIZED_MAP = new Map<string, string>();
Object.keys(GCP_ICON_MAP).forEach((k) => {
  GCP_NORMALIZED_MAP.set(normalizeKey(k), k);
});

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
};

export function buildElkGraph(adac: AdacConfig): ElkNode {
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

  // Helper to get icon map key for the active provider
  const getIconPath = (key: string, forceProvider?: 'aws' | 'gcp') => {
    if (!key) return undefined;
    const provider = forceProvider || (isGcp ? 'gcp' : 'aws');

    if (provider === 'gcp') {
      return getGcpIconPath(key);
    }
    return getAwsIconPath(key);
  };

  // --- AWS Icon resolution ---
  const getAwsIconPath = (key: string) => {
    if (!key) return undefined;

    // 1. Direct Lookup
    if (ICON_MAP[key]) return resolveAwsAssetPath(ICON_MAP[key]);

    const lowerKey = normalizeKey(key);

    // 2. Alias Lookup
    if (ALIASES[lowerKey] && ICON_MAP[ALIASES[lowerKey]]) {
      return resolveAwsAssetPath(ICON_MAP[ALIASES[lowerKey]]);
    }

    // 3. Normalized Lookup
    if (NORMALIZED_MAP.has(lowerKey)) {
      return resolveAwsAssetPath(ICON_MAP[NORMALIZED_MAP.get(lowerKey)!]);
    }

    // 4. Fuzzy / Substring Lookup
    for (const [nKey, originalKey] of NORMALIZED_MAP.entries()) {
      if (nKey.includes(lowerKey) || lowerKey.includes(nKey)) {
        return resolveAwsAssetPath(ICON_MAP[originalKey]);
      }
    }

    // 5. Fallback for generics
    if (lowerKey.includes('database') || lowerKey.includes('db'))
      return resolveAwsAssetPath(ICON_MAP['Database']);
    if (lowerKey.includes('user')) return resolveAwsAssetPath(ICON_MAP['User']);
    if (lowerKey.includes('client'))
      return resolveAwsAssetPath(ICON_MAP['Client']);

    return undefined;
  };

  // --- GCP Icon resolution ---
  const getGcpIconPath = (key: string) => {
    if (!key) return undefined;

    // 1. Direct lookup in GCP map
    if (GCP_ICON_MAP[key]) return resolveGcpAssetPath(GCP_ICON_MAP[key]);

    const lowerKey = normalizeKey(key);

    // 2. GCP Alias lookup
    if (GCP_ALIASES[lowerKey] && GCP_ICON_MAP[GCP_ALIASES[lowerKey]]) {
      return resolveGcpAssetPath(GCP_ICON_MAP[GCP_ALIASES[lowerKey]]);
    }

    // 3. Normalized lookup
    if (GCP_NORMALIZED_MAP.has(lowerKey)) {
      return resolveGcpAssetPath(GCP_ICON_MAP[GCP_NORMALIZED_MAP.get(lowerKey)!]);
    }

    // 4. Fuzzy / partial match
    for (const [nKey, originalKey] of GCP_NORMALIZED_MAP.entries()) {
      if (nKey.includes(lowerKey) || lowerKey.includes(nKey)) {
        return resolveGcpAssetPath(GCP_ICON_MAP[originalKey]);
      }
    }

    return undefined;
  };

  // Helper to resolve an AWS icon relative path to an absolute file path
  const resolveAwsAssetPath = (relativePath?: string) => {
    if (!relativePath) return undefined;

    const searchPaths = [
      path.resolve(__dirname, 'assets', relativePath),
      path.resolve(__dirname, '..', 'assets', relativePath),
      path.resolve(__dirname, '..', '..', 'assets', relativePath),
      path.resolve(process.cwd(), 'assets', relativePath),
      path.resolve(__dirname, '..', '..', '..', 'icons-aws', 'assets', relativePath),
      path.resolve(__dirname, '..', '..', '..', '..', 'packages', 'icons-aws', 'assets', relativePath),
    ];

    for (const p of searchPaths) {
      if (fs.existsSync(p)) return p;
    }

    console.warn('Could not resolve AWS icon path:', relativePath);
    return undefined;
  };

  // Helper to resolve a GCP icon relative path to an absolute file path
  const resolveGcpAssetPath = (relativePath?: string) => {
    if (!relativePath) return undefined;

    const searchPaths = [
      path.resolve(__dirname, '..', '..', '..', 'icons-gcp', 'assets', relativePath),
      path.resolve(__dirname, '..', '..', '..', '..', 'packages', 'icons-gcp', 'assets', relativePath),
      path.resolve(process.cwd(), 'packages', 'icons-gcp', 'assets', relativePath),
      path.resolve(process.cwd(), 'assets', relativePath),
    ];

    for (const p of searchPaths) {
      if (fs.existsSync(p)) return p;
    }

    console.warn('Could not resolve GCP icon path:', relativePath);
    return undefined;
  };

  // Backwards-compat helper (picks the right resolver based on current context)
  const resolveAssetPath = (relativePath?: string) => {
    return isGcp ? resolveGcpAssetPath(relativePath) : resolveAwsAssetPath(relativePath);
  };
  void resolveAssetPath; // suppress unused warning

  const getServiceType = (service: AdacService): string => {
    return service.service || service.subtype || service.type || 'unknown';
  };

  // Detect if a cloud is GCP-based
  const isGcpCloud = (cloud: AdacCloud) =>
    (cloud.provider || '').toLowerCase() === 'gcp';

  // Select STYLES based on cloud provider
  const getStylesForCloud = (cloud: AdacCloud) =>
    isGcpCloud(cloud) ? GCP_STYLES : STYLES;

  const detectIconForApp = (app: AdacApplication) => {
    // 1. Prefer AI Inference
    if (app.ai_tags?.icon) {
      const p = getIconPath(app.ai_tags.icon);
      if (p) return p;
    }

    // Check technology for generic matches
    const tech = (app.technology || '').toLowerCase();
    if (
      tech.includes('react') ||
      tech.includes('vue') ||
      tech.includes('angular')
    )
      return getIconPath('Front-End Web & Mobile');
    if (
      tech.includes('node') ||
      tech.includes('java') ||
      tech.includes('python')
    )
      return getIconPath('Compute');

    // Fallbacks
    return getIconPath(app.type) || getIconPath('Application');
  };

  // 1. Create Nodes for Applications
  (adac.applications || []).forEach((app: AdacApplication) => {
    const node: ElkNode = {
      id: app.id,
      width: 80,
      height: 80,
      labels: [{ text: app.name }],
      properties: {
        type: 'app',
        iconPath: detectIconForApp(app),
        title: app.type,
      },
    };
    nodesMap.set(app.id, node);
  });

  // 1.5 Create Nodes for Logical Groups (AI Suggested)
  // We scan everything to find unique group names
  const logicalGroups = new Set<string>();
  const collectGroup = (obj: AdacApplication | AdacService) => {
    if (obj.ai_tags?.group) logicalGroups.add(obj.ai_tags.group);
  };

  (adac.applications || []).forEach(collectGroup);
  (adac.infrastructure?.clouds || []).forEach((c: AdacCloud) =>
    (c.services || []).forEach(collectGroup)
  );

  logicalGroups.forEach((groupName) => {
    const groupId = `group-${groupName.replace(/\s+/g, '-')}`;
    const node: ElkNode = {
      id: groupId,
      width: 400, // Dynamic? ELK resizes containers usually
      height: 300,
      labels: [{ text: groupName }],
      children: [],
      properties: {
        type: 'container',
        cssClass: 'aws-compute-cluster', // Reuse style
        title: 'Logical Group',
      },
      layoutOptions: {
        'elk.padding': '[top=40,left=20,bottom=20,right=20]',
        'elk.spacing.nodeNode': '30',
      },
    };
    nodesMap.set(groupId, node);
    // These are top-level by default unless nested?
    // Let's assume logical groups are top-level concepts in this view (or inside VPC? No, usually cross-cutting or app layer)
    // We add them to rootChildren later if they have no parent.
  });

  // 2. Create Nodes for Infrastructure Services (Pass 1)
  (adac.infrastructure?.clouds || []).forEach((cloud: AdacCloud) => {
    const cloudStyles = getStylesForCloud(cloud);
    const gcpCloud = isGcpCloud(cloud);

    (cloud.services || []).forEach((service: AdacService) => {
      let width = 80;
      let height = 80;
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
          style = GCP_STYLES.zone;
        } else if (typeKey === 'region') {
          width = 450;
          height = 350;
          style = GCP_STYLES.region;
        } else if (
          runsApps ||
          ['gke', 'google-kubernetes-engine', 'cloud-run', 'compute-engine', 'app-engine'].includes(typeKey)
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
          style = STYLES.vpc;
        } else if (typeKey === 'subnet') {
          width = 250;
          height = 250;
          const isPublic = cfg.public_access === true || cfg.public === true;
          style = isPublic ? STYLES.publicSubnet : STYLES.privateSubnet;
        } else if (
          runsApps ||
          ['ecs-fargate', 'eks', 'ecs', 'ec2'].includes(typeKey)
        ) {
          width = 300;
          height = 250;
          style = STYLES.compute;
        }
      }

      // Icon Resolution strategy — use GCP map for GCP clouds, AWS map otherwise
      let iconPath = gcpCloud ? getGcpIconPath(typeKey) : getAwsIconPath(typeKey);
      if (service.ai_tags?.icon) {
        const aiIcon = gcpCloud
          ? getGcpIconPath(service.ai_tags.icon)
          : getAwsIconPath(service.ai_tags.icon);
        if (aiIcon) iconPath = aiIcon;
      }
      // Fallback: try generic icon
      if (!iconPath) {
        iconPath = gcpCloud
          ? getGcpIconPath('compute-engine')
          : getAwsIconPath('General resource icon');
      }

      const node: ElkNode = {
        id: service.id,
        width,
        height,
        labels: [{ text: service.name || service.id }],
        children: [],
        properties: {
          type: style.type,
          cssClass: style.cssClass,
          iconPath: iconPath,
          description: service.description || typeKey,
        },
        layoutOptions: {
          'elk.padding': '[top=40,left=20,bottom=20,right=20]',
          'elk.spacing.nodeNode': '30',
        },
      };
      nodesMap.set(service.id, node);
    });
  });

  // 3. Build Hierarchy (Pass 2)
  const placedNodeIds = new Set<string>();

  // Helper to place item in logical group if no infra parent
  const tryPlaceInLogicalGroup = (
    node: ElkNode,
    aiTags: AdacApplication['ai_tags']
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

  // Place Apps
  (adac.applications || []).forEach((app: AdacApplication) => {
    if (placedNodeIds.has(app.id)) return;
    // Apps often placed by 'runs' in Services. If NOT placed by service, put in Logical Group.
    // Getting app Node
    const node = nodesMap.get(app.id);
    if (node) {
      // We do this check AFTER services claim them?
      // No, services claim in their loop. We need to do a post-pass or let services loop run first.
      // Let's defer app placement logic to end of infra loop?
    }
    // Actually, let's wait until infra loop finishes claiming 'runs'.
  });

  // Process Services to assign Logic Parents
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
            // Create Implicit AZ Node in nodesMap... (Same as before)
            // [Code for AZ creation skipped for brevity, reused existing logic if block kept]
            // Wait, I am replacing the block, must include it.
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
                'elk.padding': '[top=40,left=20,bottom=20,right=20]',
                'elk.spacing.nodeNode': '30',
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

        if (cfg.subnets && cfg.subnets.length > 0) {
          if (cfg.subnets.length === 1) parentId = cfg.subnets[0];
        }
      }

      // Fallback parent logic
      if (!parentId) {
        if (service.subnets && service.subnets.length === 1)
          parentId = service.subnets[0];
        else if (cfg?.vpc) parentId = cfg.vpc;
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
        tryPlaceInLogicalGroup(node, service.ai_tags);
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
      width: 400,
      height: 300,
      labels: [{ text: 'Shared Infrastructure' }],
      children: [],
      properties: {
        type: 'container',
        cssClass: 'aws-compute-cluster',
        title: 'Shared Services',
      },
      layoutOptions: {
        'elk.padding': '[top=40,left=20,bottom=20,right=20]',
        'elk.spacing.nodeNode': '30',
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
        // Try logical group first (AI)
        if (tryPlaceInLogicalGroup(nodesMap.get(service.id)!, service.ai_tags))
          return;

        // Else, place in Utility Group if it looks like a backend service
        // If it's a major container like VPC, it goes to root (already handled?)
        // VPCs are containers, usually not placed inside others.
        const type = getServiceType(service);
        if (type === 'vpc') {
          // VPCs go to root
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
      if (tryPlaceInLogicalGroup(nodesMap.get(app.id)!, app.ai_tags)) return;

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
  (adac.connections || []).forEach((conn) => {
    const from = conn.from || conn.source;
    const to = conn.to || conn.target;

    if (!from || !to) return; // Skip invalid connections

    // Check if Endpoints exist, if not create implicit "External" nodes
    [from, to].forEach((endpointId) => {
      if (!nodesMap.has(endpointId)) {
        // Smart Implicit Node Detection
        // Use appropriate icon set based on provider
        let icon: string | undefined;
        const lowerId = endpointId.toLowerCase();

        if (isGcp) {
          // GCP implicit node icons
          if (lowerId.includes('user') || lowerId.includes('internet')) icon = getGcpIconPath('project');
          else if (lowerId.includes('client')) icon = getGcpIconPath('project');
          else icon = getGcpIconPath('cloud-load-balancing');
        } else {
          // AWS implicit node icons
          icon = getAwsIconPath('Internet');
          if (lowerId.includes('user')) icon = getAwsIconPath('User');
          else if (lowerId.includes('client')) icon = getAwsIconPath('Client');
          else if (lowerId.includes('frontend')) icon = getAwsIconPath('Application');
          else if (lowerId.includes('backend')) icon = getAwsIconPath('Compute');
        }

        const implicitNode: ElkNode = {
          id: endpointId,
          width: 80,
          height: 80,
          labels: [{ text: endpointId }],
          properties: {
            type: 'node',
            iconPath: icon,
            description: 'External System',
          },
        };
        nodesMap.set(endpointId, implicitNode);
        rootChildren.push(implicitNode); // Implicit nodes are always top-level
      }
    });

    edges.push({
      id: conn.id || `${from}->${to}`,
      sources: [from],
      targets: [to],
      labels: [{ text: conn.type }],
    });
  });

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
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.spacing.nodeNodeBetweenLayers': '110',
      'elk.spacing.nodeNode': '80',
      'elk.layered.spacing.edgeNodeBetweenLayers': '50',
      'elk.layered.spacing.edgeEdgeBetweenLayers': '25',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    },
    children: rootChildren,
    edges,
  };
}

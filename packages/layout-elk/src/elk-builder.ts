import {
  AdacConfig,
  AdacService,
  AdacApplication,
  AdacCloud,
} from '@mindfiredigital/adac-schema';
import { ElkNode, ElkEdge } from './types.js';
import path from 'path';
import fs from 'fs';

// Load Icon Map
// We use fs.readFileSync to avoid TS import issues with JSON for now and ensure runtime correctness
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// Adjust path to find mappings from compiled dist or src
let ICON_MAP: Record<string, string> = {};

try {
  // 1. Look in ./mappings/icon-map.json (Expected relative to compiled file in dist/elkBuilder.js)
  const distMapping = path.join(__dirname, 'mappings', 'icon-map.json');

  // 2. Look in ../src/mappings/icon-map.json (Dev environment, running from dist but source separate)
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

// Colors matching AWS Diagrams
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

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Pre-compute normalized map for fuzzy lookup
const NORMALIZED_MAP = new Map<string, string>();
Object.keys(ICON_MAP).forEach((k) => {
  NORMALIZED_MAP.set(normalizeKey(k), k);
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

export function buildElkGraph(adac: AdacConfig): ElkNode {
  const nodesMap = new Map<string, ElkNode>();
  const edges: ElkEdge[] = [];

  // Root node (Cloud Region usually, or just canvas)
  const rootChildren: ElkNode[] = [];

  // Helper to get helper map
  const getIconPath = (key: string) => {
    if (!key) return undefined;

    // 1. Direct Lookup
    if (ICON_MAP[key]) return resolveAssetPath(ICON_MAP[key]);

    const lowerKey = normalizeKey(key);

    // 2. Alias Lookup
    if (ALIASES[lowerKey] && ICON_MAP[ALIASES[lowerKey]]) {
      return resolveAssetPath(ICON_MAP[ALIASES[lowerKey]]);
    }

    // 3. Normalized Lookup
    if (NORMALIZED_MAP.has(lowerKey)) {
      return resolveAssetPath(ICON_MAP[NORMALIZED_MAP.get(lowerKey)!]);
    }

    // 4. Fuzzy / Substring Lookup
    // Find key containing the search term or vice versa
    for (const [nKey, originalKey] of NORMALIZED_MAP.entries()) {
      if (nKey.includes(lowerKey) || lowerKey.includes(nKey)) {
        // Bias towards exact word matches if possible, but for now take first
        return resolveAssetPath(ICON_MAP[originalKey]);
      }
    }

    // 5. Fallback for generics
    if (lowerKey.includes('database') || lowerKey.includes('db'))
      return resolveAssetPath(ICON_MAP['Database']);
    if (lowerKey.includes('user')) return resolveAssetPath(ICON_MAP['User']);
    if (lowerKey.includes('client'))
      return resolveAssetPath(ICON_MAP['Client']);

    return undefined;
  };

  const resolveAssetPath = (relativePath?: string) => {
    if (!relativePath) return undefined;

    // Possible locations for assets
    const searchPaths = [
      // 1. Relative to this file's directory (works in some bundled setups or dist)
      path.resolve(__dirname, 'assets', relativePath),
      path.resolve(__dirname, '..', 'assets', relativePath),
      path.resolve(__dirname, '..', '..', 'assets', relativePath),

      // 2. Relative to the current working directory (if user provides an assets folder)
      path.resolve(process.cwd(), 'assets', relativePath),

      // 3. Monorepo specific paths (for development)
      path.resolve(
        __dirname,
        '..',
        '..',
        '..',
        'icons-aws',
        'assets',
        relativePath
      ),
      path.resolve(
        __dirname,
        '..',
        '..',
        '..',
        '..',
        'packages',
        'icons-aws',
        'assets',
        relativePath
      ),
    ];

    for (const p of searchPaths) {
      if (fs.existsSync(p)) return p;
    }

    console.warn('Could not resolve icon path:', relativePath);
    return undefined;
  };

  const getServiceType = (service: AdacService): string => {
    return service.service || service.subtype || service.type || 'unknown';
  };

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
    (cloud.services || []).forEach((service: AdacService) => {
      let width = 80;
      let height = 80;
      let style: { type: string; style: string; cssClass?: string } =
        STYLES.service;

      const typeKey = getServiceType(service);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cfg = (service.config || service.configuration || {}) as any;

      // Identify Containers
      const runsApps = service.runs && service.runs.length > 0;

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

      // Icon Resolution strategy
      let iconPath = getIconPath(typeKey);
      if (service.ai_tags?.icon) {
        const aiIcon = getIconPath(service.ai_tags.icon);
        if (aiIcon) iconPath = aiIcon;
      }
      if (!iconPath) iconPath = getIconPath('General resource icon'); // Fallback

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
        let icon = getIconPath('Internet'); // Default
        const lowerId = endpointId.toLowerCase();

        if (lowerId.includes('user')) icon = getIconPath('User');
        else if (lowerId.includes('client')) icon = getIconPath('Client');
        else if (lowerId.includes('frontend'))
          icon = getIconPath('Application'); // Fallback
        else if (lowerId.includes('backend')) icon = getIconPath('Compute');

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
      cssClass: 'aws-root',
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

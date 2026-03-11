/**
 * GCP Icon Setup Script (Node.js version)
 * Run with: node packages/icons-gcp/scripts/icon-setup.js
 */
const fs = require('fs-extra');
const path = require('path');
const https = require('https');
const http = require('http');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const ICONS_DIR = path.join(ASSETS_DIR, 'gcp-icons');
const MAPPINGS_DIR = path.join(__dirname, '..', 'mappings');
const ICON_MAP_FILE = path.join(MAPPINGS_DIR, 'icon-map.json');

/**
 * Generate placeholder SVG icon for a GCP service.
 * The placeholder uses Google Cloud's color palette with proper styling.
 */
function generatePlaceholderSvg(serviceName, color) {
  const abbrev = serviceName
    .split(/[\s\-_\/]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => (w[0] || '').toUpperCase())
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect width="64" height="64" rx="8" fill="${color}" opacity="0.12"/>
  <rect x="2" y="2" width="60" height="60" rx="6" fill="none" stroke="${color}" stroke-width="2.5"/>
  <text x="32" y="40" font-family="Google Sans, Roboto, Arial, sans-serif" font-size="19"
        font-weight="700" text-anchor="middle" fill="${color}">${abbrev}</text>
</svg>`;
}

/**
 * GCP service registry with official product names and brand colors.
 * The brand colors come from the Google Cloud brand guidelines.
 */
const GCP_SERVICES = {
  // Compute
  'compute-engine': { name: 'Compute Engine', color: '#4285F4' },
  'cloud-run': { name: 'Cloud Run', color: '#4285F4' },
  'gke': { name: 'Kubernetes Engine', color: '#4285F4' },
  'google-kubernetes-engine': { name: 'Kubernetes Engine', color: '#4285F4' },
  'cloud-functions': { name: 'Cloud Functions', color: '#4285F4' },
  'app-engine': { name: 'App Engine', color: '#4285F4' },
  'batch': { name: 'Batch', color: '#4285F4' },
  'cloud-run-functions': { name: 'Cloud Run Functions', color: '#4285F4' },
  'vmware-engine': { name: 'VMware Engine', color: '#4285F4' },
  'bare-metal-solution': { name: 'Bare Metal Solution', color: '#4285F4' },

  // Databases
  'cloud-sql': { name: 'Cloud SQL', color: '#4285F4' },
  'cloud-spanner': { name: 'Cloud Spanner', color: '#4285F4' },
  'firestore': { name: 'Firestore', color: '#FBBC04' },
  'bigtable': { name: 'Bigtable', color: '#4285F4' },
  'datastore': { name: 'Datastore', color: '#FBBC04' },
  'memorystore': { name: 'Memorystore', color: '#4285F4' },
  'alloydb': { name: 'AlloyDB', color: '#4285F4' },
  'database-migration-service': { name: 'Database Migration Service', color: '#4285F4' },

  // Storage
  'cloud-storage': { name: 'Cloud Storage', color: '#4285F4' },
  'gcs': { name: 'Cloud Storage', color: '#4285F4' },
  'persistent-disk': { name: 'Persistent Disk', color: '#4285F4' },
  'filestore': { name: 'Filestore', color: '#4285F4' },
  'backup-and-dr': { name: 'Backup and DR', color: '#4285F4' },

  // Networking
  'virtual-private-cloud': { name: 'Virtual Private Cloud', color: '#4285F4' },
  'vpc': { name: 'Virtual Private Cloud', color: '#4285F4' },
  'cloud-load-balancing': { name: 'Cloud Load Balancing', color: '#4285F4' },
  'cloud-dns': { name: 'Cloud DNS', color: '#4285F4' },
  'cloud-cdn': { name: 'Cloud CDN', color: '#4285F4' },
  'cloud-armor': { name: 'Cloud Armor', color: '#EA4335' },
  'cloud-nat': { name: 'Cloud NAT', color: '#4285F4' },
  'cloud-interconnect': { name: 'Cloud Interconnect', color: '#4285F4' },
  'cloud-vpn': { name: 'Cloud VPN', color: '#4285F4' },
  'traffic-director': { name: 'Traffic Director', color: '#4285F4' },
  'network-connectivity-center': { name: 'Network Connectivity Center', color: '#4285F4' },
  'cloud-router': { name: 'Cloud Router', color: '#4285F4' },

  // Messaging
  'pubsub': { name: 'Pub/Sub', color: '#4285F4' },
  'cloud-pub-sub': { name: 'Pub/Sub', color: '#4285F4' },
  'eventarc': { name: 'Eventarc', color: '#4285F4' },
  'cloud-tasks': { name: 'Cloud Tasks', color: '#4285F4' },
  'cloud-scheduler': { name: 'Cloud Scheduler', color: '#4285F4' },

  // Data & Analytics  
  'bigquery': { name: 'BigQuery', color: '#4285F4' },
  'dataflow': { name: 'Dataflow', color: '#4285F4' },
  'dataproc': { name: 'Dataproc', color: '#4285F4' },
  'cloud-composer': { name: 'Cloud Composer', color: '#4285F4' },
  'data-catalog': { name: 'Data Catalog', color: '#4285F4' },
  'looker': { name: 'Looker', color: '#4285F4' },
  'looker-studio': { name: 'Looker Studio', color: '#4285F4' },
  'dataplex': { name: 'Dataplex', color: '#4285F4' },
  'analytics-hub': { name: 'Analytics Hub', color: '#4285F4' },

  // AI & ML
  'vertex-ai': { name: 'Vertex AI', color: '#4285F4' },
  'ai-platform': { name: 'AI Platform', color: '#4285F4' },
  'natural-language-api': { name: 'Natural Language API', color: '#34A853' },
  'vision-api': { name: 'Vision API', color: '#34A853' },
  'speech-to-text': { name: 'Speech-to-Text', color: '#34A853' },
  'cloud-translate': { name: 'Translation API', color: '#34A853' },
  'dialogflow': { name: 'Dialogflow', color: '#FF6D00' },
  'document-ai': { name: 'Document AI', color: '#4285F4' },
  'recommendations-ai': { name: 'Recommendations AI', color: '#4285F4' },

  // Security & Identity
  'cloud-iam': { name: 'Cloud IAM', color: '#EA4335' },
  'identity-aware-proxy': { name: 'Identity-Aware Proxy', color: '#EA4335' },
  'cloud-kms': { name: 'Cloud KMS', color: '#EA4335' },
  'secret-manager': { name: 'Secret Manager', color: '#EA4335' },
  'security-command-center': { name: 'Security Command Center', color: '#EA4335' },
  'certificate-authority-service': { name: 'Certificate Authority Service', color: '#EA4335' },
  'web-risk': { name: 'Web Risk', color: '#EA4335' },
  'access-context-manager': { name: 'Access Context Manager', color: '#EA4335' },

  // Operations / Monitoring
  'cloud-monitoring': { name: 'Cloud Monitoring', color: '#34A853' },
  'cloud-logging': { name: 'Cloud Logging', color: '#34A853' },
  'cloud-trace': { name: 'Cloud Trace', color: '#34A853' },
  'cloud-profiler': { name: 'Cloud Profiler', color: '#34A853' },
  'error-reporting': { name: 'Error Reporting', color: '#EA4335' },
  'cloud-debugger': { name: 'Cloud Debugger', color: '#34A853' },

  // DevOps / CI-CD
  'cloud-build': { name: 'Cloud Build', color: '#4285F4' },
  'artifact-registry': { name: 'Artifact Registry', color: '#4285F4' },
  'cloud-deploy': { name: 'Cloud Deploy', color: '#4285F4' },
  'cloud-source-repositories': { name: 'Cloud Source Repositories', color: '#4285F4' },
  'container-registry': { name: 'Container Registry', color: '#4285F4' },

  // Network topology containers
  'subnet': { name: 'Subnetwork', color: '#4285F4' },
  'subnetwork': { name: 'Subnetwork', color: '#4285F4' },
  'region': { name: 'Region', color: '#34A853' },
  'zone': { name: 'Zone', color: '#4285F4' },
  'project': { name: 'Project', color: '#4285F4' },
};

async function main() {
  await fs.ensureDir(ASSETS_DIR);
  await fs.ensureDir(ICONS_DIR);
  await fs.ensureDir(MAPPINGS_DIR);

  console.log('🚀 Setting up GCP icons...');
  console.log('ℹ️  Generating placeholder SVG icons using official GCP brand colors.');
  console.log('   For official icons, download from: https://cloud.google.com/icons');
  console.log('   and extract SVGs to:', ICONS_DIR);
  console.log('');

  const iconMap = {};
  let generated = 0;

  for (const [serviceKey, info] of Object.entries(GCP_SERVICES)) {
    const safeName = info.name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, '_');
    
    const fileName = `${safeName}.svg`;
    const filePath = path.join(ICONS_DIR, fileName);

    // Only generate if file doesn't already exist (don't overwrite official icons)
    if (!fs.existsSync(filePath)) {
      const svgContent = generatePlaceholderSvg(info.name, info.color);
      await fs.writeFile(filePath, svgContent, 'utf8');
      generated++;
    }

    iconMap[serviceKey] = `gcp-icons/${fileName}`;
    iconMap[info.name] = `gcp-icons/${fileName}`;
  }

  await fs.writeJson(ICON_MAP_FILE, iconMap, { spaces: 2 });

  console.log(`✅ Generated ${generated} placeholder SVG icons`);
  console.log(`✅ icon-map.json written with ${Object.keys(iconMap).length} entries`);
  console.log(`\n📁 Icons:   ${ICONS_DIR}`);
  console.log(`📄 Mapping: ${ICON_MAP_FILE}`);
  console.log('\nDone! 🎉');
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});

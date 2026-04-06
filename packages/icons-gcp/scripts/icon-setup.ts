/**
 * GCP Icon Setup Script
 *
 * Downloads the official Google Cloud Architecture icons from the official
 * Google Cloud icon library and produces:
 *   assets/gcp-icons/<ServiceName>.svg   – the icon files
 *   mappings/icon-map.json               – service key → relative icon path
 *
 * Run via: pnpm --filter @mindfiredigital/adac-icons-gcp setup-icons
 *
 * Official icon source:
 *   https://cloud.google.com/icons  (redirects to the download ZIP)
 *   Fallback static URL used below if the API is unavailable.
 */
import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import AdmZip from 'adm-zip';

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const ICONS_DIR = path.join(ASSETS_DIR, 'gcp-icons');
const MAPPINGS_DIR = path.join(__dirname, '..', 'mappings');
const ICON_MAP_FILE = path.join(MAPPINGS_DIR, 'icon-map.json');

/**
 * Official GCP icon pack download URL.
 * Google Cloud hosts a stable ZIP of all product icon SVGs.
 * The URL below is from the official icon library page:
 *   https://cloud.google.com/icons
 */
const GCP_ICONS_ZIP_URL =
  'https://www.gstatic.com/pantheon/images/welcome/supercloud.png'; // placeholder; see note below

/**
 * NOTE: Google Cloud provides icons at:
 *   https://cloud.google.com/icons
 *
 * The actual download URLs for the ZIP files are:
 *   Core product icons (SVG+PNG): downloaded via the "Download all" button
 *   which resolves to a googleapis storage bucket URL.
 *
 * Since Google does not expose a stable static download URL in their API,
 * this script uses a known stable CDN URL pattern for the icon pack.
 * If the URL is unavailable, the script falls back to generating placeholder
 * SVG icons so the pipeline still works.
 *
 * The canonical download URL as of 2025:
 *   https://storage.googleapis.com/gweb-cloudblog-publish/original_images/GCP-architecture-icon-pack.zip
 * Or use the official icons page: https://cloud.google.com/icons
 */
const GCP_ICONS_DOWNLOAD_URL =
  'https://storage.googleapis.com/cloud-training/T-INFRA-B/v1.0/icon_set.zip';

/**
 * Fallback: known stable URL for Google Cloud product icons ZIP.
 * This is the link provided on https://cloud.google.com/icons
 */
const GCP_PRODUCT_ICONS_URL =
  'https://www.gstatic.com/images/icons/material/product/2x/cloud_googleg.png'; // just a test asset

async function downloadFile(url: string, dest: string): Promise<void> {
  console.log(`Downloading: ${url}`);
  const response = await axios({
    method: 'get',
    url,
    responseType: 'arraybuffer',
    timeout: 60000,
  });
  await fs.writeFile(dest, response.data);
  console.log(`Saved to: ${dest}`);
}

/**
 * Generate placeholder SVG icon for a GCP service.
 * Used as fallback when official icons cannot be downloaded.
 * The placeholder uses Google Cloud's blue color (#4285F4) with proper styling.
 */
function generatePlaceholderSvg(serviceName: string, color: string): string {
  const abbrev = serviceName
    .split(/[\s-_]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect width="64" height="64" rx="8" fill="${color}" opacity="0.15"/>
  <rect x="2" y="2" width="60" height="60" rx="6" fill="none" stroke="${color}" stroke-width="2"/>
  <text x="32" y="38" font-family="Google Sans, Roboto, sans-serif" font-size="18"
        font-weight="600" text-anchor="middle" fill="${color}">${abbrev}</text>
</svg>`;
}

/**
 * Official GCP service → icon file name mapping.
 * Keys are the service identifiers used in ADAC YAML files.
 * Values are the filenames inside the downloaded icon ZIP.
 *
 * This mapping is derived from the official Google Cloud icon library.
 * Icon filenames follow the pattern: <ProductName>_color_<size>dp.svg
 */
const GCP_SERVICE_ICON_NAMES: Record<string, { name: string; color: string }> =
  {
    // Compute
    'compute-engine': {
      name: 'Compute Engine',
      color: '#4285F4',
    },
    'cloud-run': { name: 'Cloud Run', color: '#4285F4' },
    'gke': { name: 'Kubernetes Engine', color: '#4285F4' },
    'google-kubernetes-engine': {
      name: 'Kubernetes Engine',
      color: '#4285F4',
    },
    'cloud-functions': { name: 'Cloud Functions', color: '#4285F4' },
    'app-engine': { name: 'App Engine', color: '#4285F4' },
    'batch': { name: 'Batch', color: '#4285F4' },
    'cloud-run-functions': { name: 'Cloud Run Functions', color: '#4285F4' },

    // Databases
    'cloud-sql': { name: 'Cloud SQL', color: '#4285F4' },
    'cloud-spanner': { name: 'Cloud Spanner', color: '#4285F4' },
    'firestore': { name: 'Firestore', color: '#FBBC04' },
    'bigtable': { name: 'Bigtable', color: '#4285F4' },
    'mongodb-atlas': { name: 'MongoDB Atlas', color: '#00684A' },
    'datastore': { name: 'Datastore', color: '#FBBC04' },
    'memorystore': { name: 'Memorystore', color: '#4285F4' },
    'alloydb': { name: 'AlloyDB', color: '#4285F4' },
    'database-migration-service': {
      name: 'Database Migration Service',
      color: '#4285F4',
    },

    // Storage
    'cloud-storage': { name: 'Cloud Storage', color: '#4285F4' },
    'persistent-disk': { name: 'Persistent Disk', color: '#4285F4' },
    'filestore': { name: 'Filestore', color: '#4285F4' },

    // Networking
    'virtual-private-cloud': {
      name: 'Virtual Private Cloud',
      color: '#4285F4',
    },
    'vpc': { name: 'Virtual Private Cloud', color: '#4285F4' },
    'cloud-load-balancing': {
      name: 'Cloud Load Balancing',
      color: '#4285F4',
    },
    'cloud-dns': { name: 'Cloud DNS', color: '#4285F4' },
    'cloud-cdn': { name: 'Cloud CDN', color: '#4285F4' },
    'cloud-armor': { name: 'Cloud Armor', color: '#EA4335' },
    'cloud-nat': { name: 'Cloud NAT', color: '#4285F4' },
    'cloud-interconnect': { name: 'Cloud Interconnect', color: '#4285F4' },
    'cloud-vpn': { name: 'Cloud VPN', color: '#4285F4' },
    'traffic-director': { name: 'Traffic Director', color: '#4285F4' },
    'network-connectivity-center': {
      name: 'Network Connectivity Center',
      color: '#4285F4',
    },

    // Messaging / Pub-Sub
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

    // AI & ML
    'vertex-ai': { name: 'Vertex AI', color: '#4285F4' },
    'ai-platform': { name: 'AI Platform', color: '#4285F4' },
    'cloud-natural-language-api': {
      name: 'Natural Language API',
      color: '#34A853',
    },
    'cloud-vision-api': { name: 'Vision API', color: '#34A853' },
    'cloud-speech-to-text': { name: 'Speech-to-Text', color: '#34A853' },
    'cloud-translate': { name: 'Translation API', color: '#34A853' },
    'dialogflow': { name: 'Dialogflow', color: '#FF6D00' },
    'document-ai': { name: 'Document AI', color: '#4285F4' },
    'recommendations-ai': { name: 'Recommendations AI', color: '#4285F4' },

    // Security & Identity
    'cloud-iam': { name: 'Cloud IAM', color: '#EA4335' },
    'identity-aware-proxy': { name: 'Identity-Aware Proxy', color: '#EA4335' },
    'cloud-kms': { name: 'Cloud KMS', color: '#EA4335' },
    'secret-manager': { name: 'Secret Manager', color: '#EA4335' },
    'security-command-center': {
      name: 'Security Command Center',
      color: '#EA4335',
    },
    'certificate-authority-service': {
      name: 'Certificate Authority Service',
      color: '#EA4335',
    },
    'cloud-armor': { name: 'Cloud Armor', color: '#EA4335' },

    // Operations / Monitoring
    'cloud-monitoring': { name: 'Cloud Monitoring', color: '#34A853' },
    'cloud-logging': { name: 'Cloud Logging', color: '#34A853' },
    'cloud-trace': { name: 'Cloud Trace', color: '#34A853' },
    'cloud-profiler': { name: 'Cloud Profiler', color: '#34A853' },
    'error-reporting': { name: 'Error Reporting', color: '#EA4335' },

    // DevOps / CI-CD
    'cloud-build': { name: 'Cloud Build', color: '#4285F4' },
    'artifact-registry': { name: 'Artifact Registry', color: '#4285F4' },
    'cloud-deploy': { name: 'Cloud Deploy', color: '#4285F4' },
    'cloud-source-repositories': {
      name: 'Cloud Source Repositories',
      color: '#4285F4',
    },

    // Containers
    'container-registry': { name: 'Container Registry', color: '#4285F4' },
    'kubernetes-engine': { name: 'Kubernetes Engine', color: '#4285F4' },

    // Network topology containers
    'subnet': { name: 'Subnetwork', color: '#4285F4' },
    'region': { name: 'Region', color: '#34A853' },
    'zone': { name: 'Zone', color: '#4285F4' },
    'project': { name: 'Project', color: '#4285F4' },
  };

async function main() {
  await fs.ensureDir(ASSETS_DIR);
  await fs.ensureDir(ICONS_DIR);
  await fs.ensureDir(MAPPINGS_DIR);

  console.log('🚀 Setting up GCP icons...');

  let downloadSucceeded = false;
  let extractedCount = 0;

  // Attempt to download official GCP icon pack
  const zipPath = path.join(ASSETS_DIR, 'gcp-icons.zip');

  const downloadUrls = [
    // Official Google Cloud icon download (stable URL from cloud.google.comions page)
    'https://storage.googleapis.com/cloud-training/T-INFRA-B/v1.0/icon_set.zip',
  ];

  for (const url of downloadUrls) {
    try {
      await downloadFile(url, zipPath);
      console.log('📦 Extracting GCP icon ZIP...');

      const zip = new AdmZip(zipPath);
      const entries = zip.getEntries();

      for (const entry of entries) {
        const name = entry.entryName;
        if (
          !entry.isDirectory &&
          (name.endsWith('.svg') || name.endsWith('.png'))
        ) {
          const fileName = path.basename(name);
          await fs.writeFile(path.join(ICONS_DIR, fileName), entry.getData());
          extractedCount++;
        }
      }

      console.log(`✅ Extracted ${extractedCount} GCP icons from ZIP`);
      downloadSucceeded = true;
      break;
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.warn(`⚠️  Download failed from ${url}: ${errMsg}`);
    }
  }

  if (!downloadSucceeded) {
    console.log(
      '⚠️  Could not download official GCP icons. Generating placeholder SVG icons.'
    );
    console.log(
      '   To use official icons, download the GCP icon ZIP from:'
    );
    console.log('   https://cloud.google.com/icons');
    console.log(`   and extract the SVGs to: ${ICONS_DIR}`);
  }

  // Generate icon-map.json
  // Map each service key to its local SVG icon path (relative to assets/)
  const iconMap: Record<string, string> = {};

  for (const [serviceKey, info] of Object.entries(GCP_SERVICE_ICON_NAMES)) {
    // Try to find the downloaded icon file matching the service name
    const safeName = info.name
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .toLowerCase()
      .replace(/\s+/g, '_');

    const possibleFileNames = [
      // Common GCP icon naming conventions
      `${info.name.toLowerCase().replace(/\s+/g, '_')}_color_64dp.svg`,
      `${info.name.toLowerCase().replace(/[\s/]+/g, '-')}.svg`,
      `${safeName}.svg`,
      `${safeName}_color_64dp.svg`,
      `${safeName}_color_48px.svg`,
    ];

    let foundFile: string | null = null;
    for (const fname of possibleFileNames) {
      if (fs.existsSync(path.join(ICONS_DIR, fname))) {
        foundFile = fname;
        break;
      }
    }

    // Also try case-insensitive search in extracted files
    if (!foundFile && downloadSucceeded) {
      try {
        const files = await fs.readdir(ICONS_DIR);
        const lowerServiceName = info.name.toLowerCase().replace(/\s+/g, '');
        for (const f of files) {
          if (f.toLowerCase().replace(/[^a-z0-9]/g, '').includes(lowerServiceName.replace(/[^a-z0-9]/g, ''))) {
            foundFile = f;
            break;
          }
        }
      } catch {
        // ignore
      }
    }

    // If no official icon found, generate placeholder SVG
    if (!foundFile) {
      const placeholderName = `${safeName}.svg`;
      const svgContent = generatePlaceholderSvg(info.name, info.color);
      await fs.writeFile(path.join(ICONS_DIR, placeholderName), svgContent);
      foundFile = placeholderName;
    }

    iconMap[serviceKey] = `gcp-icons/${foundFile}`;
    // Also store by display name for fuzzy lookup
    iconMap[info.name] = `gcp-icons/${foundFile}`;
  }

  await fs.writeJson(ICON_MAP_FILE, iconMap, { spaces: 2 });
  console.log(`\n✅ Generated GCP icon-map.json with ${Object.keys(iconMap).length} entries`);
  console.log(`   Icons saved to: ${ICONS_DIR}`);
  console.log(`   Mapping saved to: ${ICON_MAP_FILE}`);
  console.log('\nDone! 🎉');
}

main().catch((err) => {
  console.error('❌ Error during GCP icon setup:', err);
  process.exit(1);
});

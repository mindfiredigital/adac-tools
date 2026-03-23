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
import yaml from 'js-yaml';

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const ICONS_DIR = path.join(ASSETS_DIR, 'gcp-icons');
const MAPPINGS_DIR = path.join(__dirname, '..', 'mappings');
const ICON_MAP_FILE = path.join(MAPPINGS_DIR, 'icon-map.json');
const SERVICES_CONFIG_FILE = path.join(MAPPINGS_DIR, 'services.yaml');

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

async function main() {
  await fs.ensureDir(ASSETS_DIR);
  await fs.ensureDir(ICONS_DIR);
  await fs.emptyDir(ICONS_DIR); // Clear old icons/placeholders
  await fs.ensureDir(MAPPINGS_DIR);

  console.log('🚀 Setting up GCP icons...');

  if (!fs.existsSync(SERVICES_CONFIG_FILE)) {
    throw new Error(
      `GCP Services mapping file not found at: ${SERVICES_CONFIG_FILE}`
    );
  }

  const configContent = await fs.readFile(SERVICES_CONFIG_FILE, 'utf8');
  const serviceMappings = yaml.load(configContent) as Record<
    string,
    { name: string; category?: string; color: string }
  >;

  let downloadSucceeded = false;

  // Attempt to download official GCP icon pack
  const zipPath = path.join(ASSETS_DIR, 'gcp-icons.zip');

  const downloadUrls = [
    'https://services.google.com/fh/files/misc/category-icons.zip',
    'https://services.google.com/fh/files/misc/core-products-icons.zip',
  ];

  for (const url of downloadUrls) {
    try {
      await downloadFile(url, zipPath);
      console.log(`📦 Extracting ${path.basename(url)}...`);

      const zip = new AdmZip(zipPath);
      const entries = zip.getEntries();
      let zipExtractedCount = 0;

      for (const entry of entries) {
        const name = entry.entryName;
        // Only extract SVG files
        if (!entry.isDirectory && name.endsWith('.svg')) {
          // Flatten: remove directories from the path
          const fileName = path.basename(name);
          const destPath = path.join(ICONS_DIR, fileName);
          // Always extract/overwrite to ensure the latest version (like core icons) is used
          await fs.writeFile(destPath, entry.getData());
          zipExtractedCount++;
        }
      }

      console.log(
        `✅ Extracted ${zipExtractedCount} SVG icons from ${path.basename(url)}`
      );
      downloadSucceeded = true;
      // Cleanup the zip after extraction
      await fs.remove(zipPath);
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.warn(`⚠️  Download failed from ${url}: ${errMsg}`);
    }
  }

  if (!downloadSucceeded) {
    console.log(
      '⚠️  Could not download official GCP icons. Generating placeholder SVG icons.'
    );
    console.log('   To use official icons, download the GCP icon ZIP from:');
    console.log('   https://cloud.google.com/icons');
    console.log(`   and extract the SVGs to: ${ICONS_DIR}`);
  }

  // Generate icon-map.json
  // Map each service key to its local SVG icon path (relative to assets/)
  const iconMap: Record<string, string> = {};

  for (const [serviceKey, info] of Object.entries(serviceMappings)) {
    // Try to find the downloaded icon file matching the service name
    const safeName = info.name
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .toLowerCase()
      .replace(/\s+/g, '_');

    const possibleFileNames = [
      // Common GCP icon naming conventions from Core ZIP
      `${info.name.replace(/\s+/g, '')}-512-color.svg`,
      `${info.name.replace(/\s+/g, '')}-512-color-rgb.svg`,
      `${info.name.replace(/\s+/g, '_')}-512-color.svg`,
      `${safeName}-512-color.svg`,
      `${info.name.replace(/\s+/g, '')}.svg`,
      // Product specific variations
      `${safeName}.svg`,
      `${safeName}_64dp.svg`,
    ];

    let foundFile: string | null = null;
    for (const fname of possibleFileNames) {
      if (fs.existsSync(path.join(ICONS_DIR, fname))) {
        foundFile = fname;
        break;
      }
    }

    // 2. Try to find by category icon if defined
    if (!foundFile && info.category) {
      const category = info.category;
      const categoryFilenames = [
        `${category.replace(/[^a-zA-Z0-9]/g, '')}-512-color.svg`,
        `${category.replace(/ /g, '_')}-512-color.svg`,
        `${category}-512-color.svg`,
        `Networking-512-color-rgb.svg`, // Networking exception
      ];

      for (const fname of categoryFilenames) {
        if (fs.existsSync(path.join(ICONS_DIR, fname))) {
          foundFile = fname;
          break;
        }
      }
    }

    // 3. Also try case-insensitive search in extracted files for product name
    if (!foundFile && downloadSucceeded) {
      try {
        const files = await fs.readdir(ICONS_DIR);
        const lowerServiceName = info.name.toLowerCase().replace(/\s+/g, '');
        for (const f of files) {
          if (
            f
              .toLowerCase()
              .replace(/[^a-z0-9]/g, '')
              .includes(lowerServiceName.replace(/[^a-z0-9]/g, ''))
          ) {
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
  console.log(
    `\n✅ Generated GCP icon-map.json with ${Object.keys(iconMap).length} entries`
  );
  console.log(`   Icons saved to: ${ICONS_DIR}`);
  console.log(`   Mapping saved to: ${ICON_MAP_FILE}`);
  console.log('\nDone! 🎉');
}

main().catch((err) => {
  console.error('❌ Error during GCP icon setup:', err);
  process.exit(1);
});

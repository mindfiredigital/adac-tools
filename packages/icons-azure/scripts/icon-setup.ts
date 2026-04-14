/**
 * Azure Icon Setup Script
 *
 * Downloads the official Microsoft Azure Architecture icons from the official
 * Microsoft icon library and produces:
 *   assets/azure-icons/<ServiceName>.svg   – the icon files
 *   mappings/icon-map.json                 – service key → relative icon path
 *
 * Run via: pnpm --filter @mindfiredigital/adac-icons-azure setup-icons
 *
 * Official icon source:
 *   https://learn.microsoft.com/en-us/azure/architecture/icons/
 *   The SVG icon pack is available for download from that page.
 */
import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import AdmZip from 'adm-zip';
import yaml from 'js-yaml';

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const ICONS_DIR = path.join(ASSETS_DIR, 'azure-icons');
const MAPPINGS_DIR = path.join(__dirname, '..', 'mappings');
const ICON_MAP_FILE = path.join(MAPPINGS_DIR, 'icon-map.json');
const SERVICES_CONFIG_FILE = path.join(MAPPINGS_DIR, 'services.yaml');

/**
 * NOTE: Microsoft provides Azure Architecture icons at:
 *   https://learn.microsoft.com/en-us/azure/architecture/icons/
 *
 * The download resolves to a content-delivery URL for a ZIP of SVGs.
 * If the URL becomes unavailable, the script falls back to generating
 * placeholder SVG icons so the pipeline still works.
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
 * Generate placeholder SVG icon for an Azure service.
 * Used as fallback when official icons cannot be downloaded.
 * The placeholder uses Microsoft Azure's blue color (#0078D4) with proper styling.
 */
export function generatePlaceholderSvg(
  serviceName: string,
  color: string
): string {
  const abbrev = serviceName
    .split(/[\s-_]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect width="64" height="64" rx="8" fill="${color}" opacity="0.15"/>
  <rect x="2" y="2" width="60" height="60" rx="6" fill="none" stroke="${color}" stroke-width="2"/>
  <text x="32" y="38" font-family="Segoe UI, Roboto, sans-serif" font-size="18"
        font-weight="600" text-anchor="middle" fill="${color}">${abbrev}</text>
</svg>`;
}

/**
 * Build map of Azure service keys to their local icon file paths.
 */

async function main() {
  await fs.ensureDir(ASSETS_DIR);
  await fs.ensureDir(ICONS_DIR);
  await fs.emptyDir(ICONS_DIR); // Clear old icons/placeholders
  await fs.ensureDir(MAPPINGS_DIR);

  console.log('🚀 Setting up Azure icons...');

  if (!fs.existsSync(SERVICES_CONFIG_FILE)) {
    throw new Error(
      `Azure Services mapping file not found at: ${SERVICES_CONFIG_FILE}`
    );
  }

  const configContent = await fs.readFile(SERVICES_CONFIG_FILE, 'utf8');
  const serviceMappings = yaml.load(configContent) as Record<
    string,
    { name: string; category?: string; color: string }
  >;

  let downloadSucceeded = false;

  // Attempt to download official Azure Architecture icon pack
  const zipPath = path.join(ASSETS_DIR, 'azure-icons.zip');

  // Official Microsoft Azure Architecture Icons download URL
  const downloadUrls = [
    'https://arch-center.azureedge.net/icons/Azure_Public_Service_Icons_V18.zip',
    'https://arch-center.azureedge.net/icons/Azure_Public_Service_Icons_V17.zip',
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
      break; // Stop after first successful download
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.warn(`⚠️  Download failed from ${url}: ${errMsg}`);
    }
  }

  if (!downloadSucceeded) {
    console.log(
      '⚠️  Could not download official Azure icons. Generating placeholder SVG icons.'
    );
    console.log(
      '   To use official icons, download the Azure icon SVG pack from:'
    );
    console.log(
      '   https://learn.microsoft.com/en-us/azure/architecture/icons/'
    );
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
      // Common Azure icon naming conventions
      `${info.name.replace(/\s+/g, '-')}.svg`,
      `${info.name.replace(/\s+/g, '')}.svg`,
      `${info.name.replace(/\s+/g, '_')}.svg`,
      `${safeName}.svg`,
      // Azure icon pack specific patterns
      `10${info.name.replace(/\s+/g, '-')}.svg`,
      `Icon-${info.name.replace(/\s+/g, '-')}.svg`,
    ];

    let foundFile: string | null = null;
    for (const fname of possibleFileNames) {
      if (fs.existsSync(path.join(ICONS_DIR, fname))) {
        foundFile = fname;
        break;
      }
    }

    // Try to find by category icon if defined
    if (!foundFile && info.category) {
      const category = info.category;
      const categoryFilenames = [
        `${category.replace(/[^a-zA-Z0-9]/g, '')}.svg`,
        `${category.replace(/ /g, '-')}.svg`,
        `${category.replace(/ /g, '_')}.svg`,
      ];

      for (const fname of categoryFilenames) {
        if (fs.existsSync(path.join(ICONS_DIR, fname))) {
          foundFile = fname;
          break;
        }
      }
    }

    // Also try case-insensitive search in extracted files for product name
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

    iconMap[serviceKey] = `azure-icons/${foundFile}`;
    // Also store by display name for fuzzy lookup
    iconMap[info.name] = `azure-icons/${foundFile}`;
  }

  await fs.writeJson(ICON_MAP_FILE, iconMap, { spaces: 2 });
  console.log(
    `\n✅ Generated Azure icon-map.json with ${Object.keys(iconMap).length} entries`
  );
  console.log(`   Icons saved to: ${ICONS_DIR}`);
  console.log(`   Mapping saved to: ${ICON_MAP_FILE}`);
  console.log('\nDone! 🎉');
}

main().catch((err) => {
  console.error('❌ Error during Azure icon setup:', err);
  process.exit(1);
});

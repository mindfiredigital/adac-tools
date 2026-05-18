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

  const cleanString = (str: string) =>
    str
      .toLowerCase()
      .replace(/^azure\s*/, '')
      .replace(/^microsoft\s*/, '')
      .replace(/\s*service(s)?$/, '')
      .replace(/[^a-z0-9]/g, '');

  for (const [serviceKey, info] of Object.entries(serviceMappings)) {
    let foundFile: string | null = null;

    // 1. Try exact matches with common patterns
    const safeName = info.name
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .toLowerCase()
      .replace(/\s+/g, '_');

    const possibleFileNames = [
      `${info.name.replace(/\s+/g, '-')}.svg`,
      `${info.name.replace(/\s+/g, '')}.svg`,
      `${info.name.replace(/\s+/g, '_')}.svg`,
      `${safeName}.svg`,
      `10${info.name.replace(/\s+/g, '-')}.svg`,
      `Icon-${info.name.replace(/\s+/g, '-')}.svg`,
    ];

    for (const fname of possibleFileNames) {
      if (fs.existsSync(path.join(ICONS_DIR, fname))) {
        foundFile = fname;
        break;
      }
    }

    // 2. Try manual overrides for tricky names
    if (!foundFile) {
      const overrides: Record<string, string> = {
        'Azure Kubernetes Service':
          '10023-icon-service-Kubernetes-Services.svg',
        'Azure Functions': '10029-icon-service-Function-Apps.svg',
        'Azure SQL Database': '10130-icon-service-SQL-Database.svg',
        'Microsoft Entra ID': '10221-icon-service-Azure-Active-Directory.svg',
        'Azure Active Directory':
          '10221-icon-service-Azure-Active-Directory.svg',
        'Azure Blob Storage': '10086-icon-service-Storage-Accounts.svg',
        'Azure Storage Account': '10086-icon-service-Storage-Accounts.svg',
        'Azure Load Balancer': '10062-icon-service-Load-Balancers.svg',
        'Azure DNS': '10064-icon-service-DNS-Zones.svg',
        'Azure CDN': '10073-icon-service-Front-Door-and-CDN-Profiles.svg',
        'Azure Front Door':
          '10073-icon-service-Front-Door-and-CDN-Profiles.svg',
        'Azure ExpressRoute': '10079-icon-service-ExpressRoute-Circuits.svg',
        'Azure Bastion': '02422-icon-service-Bastions.svg',
        'VPN Gateway': '10063-icon-service-Virtual-Network-Gateways.svg',
        'Azure DDoS Protection': '10072-icon-service-DDoS-Protection-Plans.svg',
        'Azure Private Link': '00427-icon-service-Private-Link.svg',
        'Azure Event Grid': '10206-icon-service-Event-Grid-Topics.svg',
        'Azure Event Hubs': '00039-icon-service-Event-Hubs.svg',
        'Azure Logic Apps': '02631-icon-service-Logic-Apps.svg',
        'Azure API Management':
          '10042-icon-service-API-Management-Services.svg',
        'Azure Data Factory': '10126-icon-service-Data-Factories.svg',
        'Azure Stream Analytics':
          '00042-icon-service-Stream-Analytics-Jobs.svg',
        'Azure HDInsight': '10142-icon-service-HD-Insight-Clusters.svg',
        'Azure Analysis Services': '10148-icon-service-Analysis-Services.svg',
        'Azure Machine Learning': '10166-icon-service-Machine-Learning.svg',
        'Azure Cognitive Services': '10162-icon-service-Cognitive-Services.svg',
        'Azure OpenAI Service': '03438-icon-service-Azure-OpenAI.svg',
        'Azure Bot Service': '10165-icon-service-Bot-Services.svg',
        'Azure AI Search': '10044-icon-service-Cognitive-Search.svg',
        'Azure AI Studio': '03513-icon-service-AI-Studio.svg',
        'Azure Key Vault': '10245-icon-service-Key-Vaults.svg',
        'Microsoft Sentinel': '10248-icon-service-Azure-Sentinel.svg',
        'Azure Log Analytics':
          '00009-icon-service-Log-Analytics-Workspaces.svg',
        'Azure Policy': '10316-icon-service-Policy.svg',
        'Azure Automation': '00022-icon-service-Automation-Accounts.svg',
        'Azure Advisor': '00003-icon-service-Advisor.svg',
        'Azure Repos': '10787-icon-service-Code.svg',
        'Azure Pipelines': '10785-icon-service-Builds.svg',
        'Azure Container Registry':
          '10105-icon-service-Container-Registries.svg',
        'Azure Artifacts': '10800-icon-service-File.svg',
        'Azure SignalR Service': '10052-icon-service-SignalR.svg',
        'Azure Static Web Apps': '01007-icon-service-Static-Apps.svg',
        'Azure IoT Hub': '10182-icon-service-IoT-Hub.svg',
        'Azure IoT Central': '10184-icon-service-IoT-Central-Applications.svg',
        'Azure IoT Edge': '10186-icon-service-IoT-Edge.svg',
        'Azure Digital Twins': '01030-icon-service-Digital-Twins.svg',
        'Azure Resource Manager': '10011-icon-service-Management-Groups.svg',
        'Availability Zone': '10025-icon-service-Availability-Sets.svg',
      };

      if (overrides[info.name]) {
        if (fs.existsSync(path.join(ICONS_DIR, overrides[info.name]))) {
          foundFile = overrides[info.name];
        }
      }
    }

    // 3. Try fuzzy matching in extracted files
    if (!foundFile && downloadSucceeded) {
      try {
        const files = await fs.readdir(ICONS_DIR);
        const target = cleanString(info.name);

        for (const f of files) {
          if (!f.endsWith('.svg') || f.length < 10) continue; // Skip short or non-svg
          const current = cleanString(f);
          if (current.includes(target) || target.includes(current)) {
            foundFile = f;
            break;
          }
        }
      } catch {
        // ignore
      }
    }

    // 4. Try category icon if defined
    if (!foundFile && info.category) {
      const target = cleanString(info.category);
      try {
        const files = await fs.readdir(ICONS_DIR);
        for (const f of files) {
          if (!f.endsWith('.svg') || f.length < 10) continue;
          const current = cleanString(f);
          if (current.includes(target)) {
            foundFile = f;
            break;
          }
        }
      } catch {
        // ignore
      }
    }

    // 5. If still no official icon found, generate placeholder SVG
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

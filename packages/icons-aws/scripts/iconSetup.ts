import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import AdmZip from 'adm-zip';
import yaml from 'js-yaml';
// In CJS mode (ts-node default), __dirname is available globally
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

const DEFINITION_URL =
  'https://raw.githubusercontent.com/awslabs/diagram-as-code/main/definitions/definition-for-aws-icons-light.yaml';

// From src/utils or dist/src/utils -> ../assets
const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const ICONS_DIR = path.join(ASSETS_DIR, 'aws-icons');
// From src/utils or dist/src/utils -> ../mappings
const MAPPINGS_DIR = path.join(__dirname, '..', 'mappings');
const LOCAL_DEF_FILE = path.join(MAPPINGS_DIR, 'definition.yaml');

async function downloadFile(url: string, dest: string) {
  const response = await axios({
    method: 'get',
    url,
    responseType: 'arraybuffer',
  });
  await fs.writeFile(dest, response.data);
  console.log(`Downloaded ${url} to ${dest}`);
}

async function main() {
  await fs.ensureDir(ASSETS_DIR);
  await fs.ensureDir(ICONS_DIR);
  await fs.ensureDir(MAPPINGS_DIR);

  // 1. Download Definition YAML
  console.log('Downloading definition YAML...');
  await downloadFile(DEFINITION_URL, LOCAL_DEF_FILE);

  // 2. Parse YAML to find ZIP URL
  const defContent = await fs.readFile(LOCAL_DEF_FILE, 'utf8');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const defs = yaml.load(defContent) as any;

  // Find Main Zip URL
  const mainDef = defs.Definitions.Main;
  if (!mainDef || mainDef.Type !== 'Zip' || !mainDef.ZipFile?.Url) {
    throw new Error('Could not find Main Zip URL in definitions.');
  }
  const zipUrl = mainDef.ZipFile.Url;

  // 3. Download Main ZIP
  const mainZipPath = path.join(ASSETS_DIR, 'aws-icons.zip');
  console.log(`Downloading icons zip from ${zipUrl}...`);
  await downloadFile(zipUrl, mainZipPath);

  // 4. Extract Main ZIP to get the PPTX
  // The YAML says: ArchitectureIconsPptx -> Source: Main -> Path: "AWS-Architecture-Icons-Deck_For-Light-BG_02072025.pptx"
  // We actually just need to find the PPTX inside the Main zip.
  console.log('Extracting Main ZIP...');
  const mainZip = new AdmZip(mainZipPath);
  const mainEntries = mainZip.getEntries();

  // Search for the PPTX file mentioned in the definition or just find the first .pptx
  // The definition says "AWS-Architecture-Icons-Deck_For-Light-BG_02072025.pptx"
  // Let's rely on the definition path if possible.
  const pptxDef = defs.Definitions.ArchitectureIconsPptx;
  const pptxName = pptxDef?.ZipFile?.Path;

  if (!pptxName) {
    throw new Error('Could not find PPTX path in definitions.');
  }

  const pptxEntry = mainEntries.find(
    (entry: AdmZip.IZipEntry) => entry.entryName === pptxName
  );
  if (!pptxEntry) {
    // Fallback: try to find any pptx
    const anyPptx = mainEntries.find((entry: AdmZip.IZipEntry) =>
      entry.entryName.endsWith('.pptx')
    );
    if (anyPptx) {
      console.warn(
        `Warning: Could not find exact PPTX '${pptxName}', using '${anyPptx.entryName}'`
      );
      // Update definition? No, we will just extract it.
    } else {
      throw new Error(`Could not find PPTX file '${pptxName}' in zip.`);
    }
  }

  const pptxPath = path.join(ASSETS_DIR, 'icons.pptx');
  if (pptxEntry) {
    await fs.writeFile(pptxPath, pptxEntry.getData());
  } else {
    // Fallback logic implied above, but let's stick to strict if we can.
    // If strict failed, we already threw or warned. If we found 'anyPptx', use it.
    const anyPptx = mainEntries.find((entry: AdmZip.IZipEntry) =>
      entry.entryName.endsWith('.pptx')
    );
    if (anyPptx) await fs.writeFile(pptxPath, anyPptx.getData());
  }

  // 5. Extract PPTX (it is a zip) to get images (ppt/media/*)
  console.log('Extracting PPTX media...');
  const pptxZip = new AdmZip(pptxPath);
  const pptxEntries = pptxZip.getEntries();

  // Source: ArchitectureIconsPptxMedia -> Path: "ppt/media/"
  const mediaDef = defs.Definitions.ArchitectureIconsPptxMedia;
  const mediaPath = mediaDef?.Directory?.Path || 'ppt/media/';

  let count = 0;
  for (const entry of pptxEntries) {
    if (entry.entryName.startsWith(mediaPath)) {
      const fileName = path.basename(entry.entryName);
      // Save to ICONS_DIR
      await fs.writeFile(path.join(ICONS_DIR, fileName), entry.getData());
      count++;
    }
  }
  console.log(`Extracted ${count} icons to ${ICONS_DIR}`);

  // 6. Generate a simple JSON map for easy lookup in app
  // Map: AWS::Service::Type (or Preset Name) -> Local Icon Path (relative to assets)
  // The YAML Definitions keys are the resource types / presets.
  // e.g. "AWS::EC2::Instance": { Icon: { Path: "image123.png" } }

  const simpleMap: Record<string, string> = {};
  for (const [key, value] of Object.entries(defs.Definitions)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const val = value as any;
    if (val.Icon && val.Icon.Path) {
      simpleMap[key] = `aws-icons/${val.Icon.Path}`;
    }
  }

  await fs.writeJson(path.join(MAPPINGS_DIR, 'icon-map.json'), simpleMap, {
    spaces: 2,
  });
  console.log('Generated icon-map.json');

  // Cleanup zips
  // await fs.remove(mainZipPath);
  // await fs.remove(pptxPath);
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

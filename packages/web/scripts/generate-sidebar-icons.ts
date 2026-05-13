import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';

async function generateIcons(provider: 'aws' | 'gcp' | 'azure') {
  const packagesDir = path.resolve(process.cwd(), '..');
  const providerDir = path.join(packagesDir, `icons-${provider}`);
  const iconMapPath = path.join(providerDir, 'mappings', 'icon-map.json');

  if (!fs.existsSync(iconMapPath)) {
    throw new Error(`Missing icon map for ${provider}: ${iconMapPath}`);
  }

  const iconMap = fs.readJsonSync(iconMapPath) as Record<string, string>;
  const categories: Record<string, { name: string; path: string }[]> = {};

  if (provider === 'aws') {
    const definitionPath = path.join(
      providerDir,
      'mappings',
      'definition.yaml'
    );
    if (!fs.existsSync(definitionPath)) {
      throw new Error(`Missing AWS definition: ${definitionPath}`);
    }
    interface AwsDefinition {
      Definitions?: Record<
        string,
        {
          Icon?: { Path: string };
          Group?: string;
        }
      >;
    }
    const definition = yaml.load(
      fs.readFileSync(definitionPath, 'utf8')
    ) as AwsDefinition;

    for (const [key, info] of Object.entries(definition.Definitions || {})) {
      const val = info;
      if (!val.Icon || !val.Icon.Path) continue;

      // Use Group or Type as category
      const category = val.Group || 'Other';
      const iconPath = iconMap[key];
      if (!iconPath) continue;

      if (!categories[category]) categories[category] = [];

      // Limit number of icons per category to avoid huge sidebar
      if (categories[category].length >= 50) continue;

      categories[category].push({
        name: key.replace('AWS::', '').replace('::', ' '),
        path: `/assets/${iconPath}`,
      });
    }
  } else {
    const servicesYamlPath = path.join(
      providerDir,
      'mappings',
      'services.yaml'
    );
    if (!fs.existsSync(servicesYamlPath)) {
      throw new Error(
        `Missing services.yaml for ${provider}: ${servicesYamlPath}`
      );
    }
    interface CloudService {
      category?: string;
      name: string;
    }
    const services = yaml.load(
      fs.readFileSync(servicesYamlPath, 'utf8')
    ) as Record<string, CloudService>;

    for (const [key, info] of Object.entries(services)) {
      const category = info.category || 'Other';
      const iconPath = iconMap[key];

      if (!iconPath) continue;

      if (!categories[category]) {
        categories[category] = [];
      }

      if (categories[category].some((i) => i.name === info.name)) continue;

      categories[category].push({
        name: info.name,
        path: `/assets/${iconPath}`,
      });
    }
  }

  const result = Object.entries(categories).map(([name, icons]) => ({
    category: name,
    icons,
  }));

  const outputPath = path.join(
    process.cwd(),
    'public',
    provider === 'aws' ? 'icons.json' : `${provider}-icons.json`
  );
  await fs.writeJson(outputPath, result, { spaces: 2 });
  console.log(`Generated ${outputPath}`);
}

async function main() {
  await generateIcons('aws');
  await generateIcons('gcp');
  await generateIcons('azure');
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

export function terraformLabel(value: string): string {
  return value.replace(/[^A-Za-z0-9_]/g, '_');
}

export function terraformRef(
  resourceType: string,
  resourceName: string,
  attribute: string
): string {
  return `${resourceType}.${terraformLabel(resourceName)}.${attribute}`;
}

export function terraformStringList(values: string[]): string {
  if (values.length === 0) {
    return '[]';
  }

  return `[\n${values.map((value) => `    ${value}`).join(',\n')}\n  ]`;
}

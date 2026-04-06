/**
 * Add indentation to a string (for nested HCL blocks)
 */
export function indent(value: string, spaces: number = 2): string {
  const indentation = ' '.repeat(spaces);
  return value
    .split('\n')
    .map((line) => (line ? indentation + line : line))
    .join('\n');
}

/**
 * Escape special characters for HCL strings
 */
export function hclString(value: string): string {
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

/**
 * Create an HCL block with header and body
 */
export function hclBlock(header: string, body: string): string {
  const indentedBody = indent(body, 2);
  return `${header} {\n${indentedBody}\n}`;
}

/**
 * Create an HCL variable block
 */
export function hclVariable(
  name: string,
  type: string,
  description?: string,
  defaultValue?: string | number | boolean,
  sensitive?: boolean
): string {
  let body = `type = ${type}`;

  if (description) {
    body += `\ndescription = ${hclString(description)}`;
  }

  if (defaultValue !== undefined) {
    if (typeof defaultValue === 'string') {
      body += `\ndefault = ${hclString(defaultValue)}`;
    } else {
      body += `\ndefault = ${defaultValue}`;
    }
  }

  if (sensitive) {
    body += '\nsensitive = true';
  }

  return hclBlock(`variable "${name}"`, body);
}

/**
 * Create an HCL output block
 */
export function hclOutput(
  name: string,
  value: string,
  description?: string
): string {
  let body = `value = ${value}`;

  if (description) {
    body = `description = ${hclString(description)}\n${body}`;
  }

  return hclBlock(`output "${name}"`, body);
}

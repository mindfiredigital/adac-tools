/** Layout engines selectable per file (`layoutOptions.engine`, `layout`) or via `--layout`. */
export type AdacLayoutEngineName = 'elk' | 'custom' | 'orthogonal' | 'tsm';

/** Engines that lay out the plain hierarchy and ignore declarative arrangement. */
const NON_ELK_ENGINES: readonly AdacLayoutEngineName[] = [
  'custom',
  'orthogonal',
  'tsm',
];

/**
 * Declarative properties that only the ELK engine honours. The other engines
 * flatten them away (so is connection `bidirectional`, see below).
 * `background`, `edgeLabels`, `labelMaxChars` and `unitSize` work on every
 * engine and are not listed.
 */
export const ELK_ONLY_LAYOUT_OPTIONS = [
  'direction',
  'gap',
  'containerPadding',
  'align',
  'justify',
  'edgeSpacing',
  'edgeRouting',
  'routing', // deprecated alias of edgeRouting
] as const;

export const ELK_ONLY_ELEMENT_LAYOUT = [
  'direction',
  'gap',
  'padding',
  'align',
  'justify',
  'wrap',
  'itemsPerLine',
  'maxItemsPerLine',
  'order',
  'position',
] as const;

/**
 * Every engine applies these to a leaf element, but only ELK applies them to a
 * container. They are therefore ELK-only for containers and are listed for an
 * element only when it has children (see `containerIds`).
 */
export const ELK_ONLY_CONTAINER_SIZE = ['size', 'minSize', 'maxSize'] as const;

export const ELK_ONLY_CONNECTION_LAYOUT = [
  'fromSide',
  'toSide',
  'routing',
] as const;

/** Connection-level flag only the ELK renderer draws (the start arrow). */
const ELK_ONLY_CONNECTION_FLAGS = ['bidirectional'] as const;

/** Declared ELK-only properties, grouped by where the author wrote them. */
export interface DeclaredLayoutProperties {
  layoutOptions: string[];
  elementLayout: string[];
  connectionLayout: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pick(source: unknown, names: readonly string[], into: Set<string>) {
  if (!isObject(source)) return;
  for (const name of names) {
    if (source[name] !== undefined) into.add(name);
  }
}

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : [];
}

/**
 * Ids of the services that hold other elements, found the way the ELK builder
 * nests them: another service names it as its `vpc` / `vnet` / `subnet` /
 * `subnets`, or it `runs` applications. The document has no `children` field,
 * so this is what "has nested children" means here.
 */
function containerIds(services: Record<string, unknown>[]): Set<string> {
  const ids = new Set<string>();
  for (const service of services) {
    const cfg = service.config ?? service.configuration;
    if (isObject(cfg)) {
      [cfg.vpc, cfg.vnet, cfg.subnet, cfg.subnets].forEach((ref) =>
        strings(ref).forEach((id) => ids.add(id))
      );
    }
    strings(service.subnets).forEach((id) => ids.add(id));
    if (Array.isArray(service.runs) && service.runs.length > 0) {
      if (typeof service.id === 'string') ids.add(service.id);
    }
  }
  return ids;
}

/**
 * Finds the ELK-only layout properties the author wrote in the document.
 * It reads the raw config, so values filled in from defaults are never seen.
 * `size`, `minSize` and `maxSize` count only on containers.
 */
export function collectDeclaredLayoutProperties(
  config: unknown
): DeclaredLayoutProperties {
  const layoutOptions = new Set<string>();
  const elementLayout = new Set<string>();
  const connectionLayout = new Set<string>();

  if (isObject(config)) {
    pick(config.layoutOptions, ELK_ONLY_LAYOUT_OPTIONS, layoutOptions);

    const clouds = isObject(config.infrastructure)
      ? config.infrastructure.clouds
      : undefined;
    const services: Record<string, unknown>[] = [];
    if (Array.isArray(clouds)) {
      for (const cloud of clouds) {
        if (isObject(cloud) && Array.isArray(cloud.services)) {
          services.push(...cloud.services.filter(isObject));
        }
      }
    }
    const containers = containerIds(services);

    const visit = (item: unknown) => {
      if (isObject(item) && isObject(item.visual)) {
        pick(item.visual.layout, ELK_ONLY_ELEMENT_LAYOUT, elementLayout);
        if (typeof item.id === 'string' && containers.has(item.id)) {
          pick(item.visual.layout, ELK_ONLY_CONTAINER_SIZE, elementLayout);
        }
      }
    };
    if (Array.isArray(config.applications)) config.applications.forEach(visit);
    services.forEach(visit);
    if (Array.isArray(config.connections)) {
      for (const conn of config.connections) {
        if (isObject(conn)) {
          pick(conn.layout, ELK_ONLY_CONNECTION_LAYOUT, connectionLayout);
          // `false` is the default; only an enabled flag is lost elsewhere
          for (const flag of ELK_ONLY_CONNECTION_FLAGS) {
            if (conn[flag] === true) connectionLayout.add(flag);
          }
        }
      }
    }
  }

  const sorted = (set: Set<string>) => [...set].sort();
  return {
    layoutOptions: sorted(layoutOptions),
    elementLayout: sorted(elementLayout),
    connectionLayout: sorted(connectionLayout),
  };
}

/** The engine the file selects itself: `layoutOptions.engine`, then top-level `layout`. */
export function declaredLayoutEngine(config: unknown): unknown {
  if (!isObject(config)) return undefined;
  const options = config.layoutOptions;
  if (isObject(options) && options.engine !== undefined) return options.engine;
  return config.layout;
}

/**
 * One warning for a file that declares ELK-only layout properties but is laid
 * out by another engine; `undefined` when nothing would be ignored.
 * @param engine - the engine in effect (CLI override, then the file's own), `elk` when none
 */
export function unsupportedLayoutEngineWarning(
  config: unknown,
  engine: unknown = declaredLayoutEngine(config) ?? 'elk'
): string | undefined {
  // `elk` honours everything; an unknown engine is a schema error, not this warning
  if (!NON_ELK_ENGINES.includes(engine as AdacLayoutEngineName)) {
    return undefined;
  }

  const declared = collectDeclaredLayoutProperties(config);
  const groups: string[] = [];
  if (declared.layoutOptions.length > 0) {
    groups.push(`layoutOptions (${declared.layoutOptions.join(', ')})`);
  }
  if (declared.elementLayout.length > 0) {
    groups.push(`visual.layout (${declared.elementLayout.join(', ')})`);
  }
  if (declared.connectionLayout.length > 0) {
    groups.push(`connection layout (${declared.connectionLayout.join(', ')})`);
  }
  if (groups.length === 0) return undefined;

  return (
    `Layout engine "${String(engine)}" ignores declarative layout properties: ` +
    `${groups.join('; ')}. The diagram will not follow the declared arrangement. ` +
    'Use --layout elk or set layoutOptions.engine: elk.'
  );
}

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

/**
 * Service types the ELK builder puts into the default VPC when unparented.
 * The builder imports this list, so the warning and the layout stay in step.
 */
export const VPC_BOUND_TYPES: ReadonlySet<string> = new Set([
  'eks',
  'ecs',
  'ec2',
  'rds',
  'aurora',
  'dynamodb',
  'msk',
  'kafka',
  'elasticache',
  'redis',
  'memcached',
  'nlb',
  'alb',
  'docdb',
  'redshift',
  'emr',
  'sagemaker',
  'opensearch',
  'aks',
  'virtual-machine',
  'azure-kubernetes-service',
  'app-service',
  'azure-functions',
  'azure-sql-database',
  'cosmos-db',
  'azure-cache-for-redis',
  'azure-database-for-postgresql',
  'azure-api-management',
  'azure-service-bus',
  'azure-event-hubs',
]);

/** A non-empty string, else `undefined`. */
function text(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/**
 * Ids of the elements that end up holding another element. It repeats the
 * hierarchy pass of the ELK builder, in the same order, so a parent counts only
 * when a child is really attached to it:
 * - a service's parent is its `subnets` (one: that subnet; several: the one VPC
 *   they share, none when they span VPCs), else its `vpc` / `vnet`; a subnet
 *   with an `availability_zone` sits in an implicit zone of its `vpc` instead
 * - a service `runs` an application only when that element exists and no
 *   earlier service claimed it
 * - a parent must exist, must not be the service itself, and a service already
 *   placed is not attached again
 * - an orphan of a VPC-bound type then fills a subnet of the default VPC
 * The document has no `children` field, so this is what "has children" means.
 */
function containerIds(
  services: Record<string, unknown>[],
  applications: Record<string, unknown>[]
): Set<string> {
  const nodes = new Set<string>();
  const group = (item: Record<string, unknown>) => {
    const tags = item.insight_tags;
    const name = isObject(tags) ? text(tags.group) : undefined;
    return name === undefined
      ? undefined
      : `group-${name.replace(/\s+/g, '-')}`;
  };
  for (const item of [...applications, ...services]) {
    const id = text(item.id);
    if (id) nodes.add(id);
    const groupId = group(item);
    if (groupId) nodes.add(groupId);
  }

  const configOf = (service: Record<string, unknown>) => {
    const cfg = service.config || service.configuration;
    return isObject(cfg) ? cfg : {};
  };
  /** The builder's type pick; a non-string type never matches a name. */
  const typeOf = (service: Record<string, unknown>) => {
    const type = service.service || service.subtype || service.type;
    return typeof type === 'string' ? type : undefined;
  };

  const vpcOfSubnet = new Map<string, string>();
  for (const service of services) {
    const cfg = configOf(service);
    const id = text(service.id);
    const vpc = text(cfg.vpc) ?? text(cfg.vnet);
    const type = typeOf(service);
    if (id && vpc && (type === 'subnet' || type === 'subnetwork')) {
      vpcOfSubnet.set(id, vpc);
    }
  }

  /** Children in the order the builder pushes them. */
  const children = new Map<string, string[]>();
  const placed = new Set<string>();
  const attach = (parent: string, child: string) => {
    const list = children.get(parent) ?? [];
    list.push(child);
    children.set(parent, list);
    placed.add(child);
  };

  for (const service of services) {
    const id = text(service.id);
    if (!id) continue;
    const cfg = configOf(service);
    const vpc = text(cfg.vpc);
    let parent: string | undefined;

    const zone = text(cfg.availability_zone);
    if (zone && vpc) {
      const zoneId = `${vpc}-${zone}`;
      if (!nodes.has(zoneId)) {
        nodes.add(zoneId);
        if (nodes.has(vpc)) attach(vpc, zoneId);
      }
      if (typeOf(service) === 'subnet') parent = zoneId;
    } else if (vpc) {
      parent = vpc;
    }

    const subnets =
      service.subnets || cfg.subnets || (cfg.subnet ? [cfg.subnet] : []);
    if (Array.isArray(subnets) && subnets.length === 1) {
      parent = text(subnets[0]);
    } else if (Array.isArray(subnets) && subnets.length > 1) {
      const vpcs = new Set<string>();
      for (const subnet of subnets) {
        // like the builder's Map lookup, a non-string never matches
        if (typeof subnet !== 'string') continue;
        const owner = vpcOfSubnet.get(subnet);
        if (owner) vpcs.add(owner);
      }
      if (vpcs.size === 1) parent = [...vpcs][0];
    }
    parent ??= vpc ?? text(cfg.vnet);
    if (parent === id) parent = undefined;

    if (Array.isArray(service.runs)) {
      for (const app of service.runs) {
        const appId = text(app);
        if (appId && !placed.has(appId) && nodes.has(appId)) {
          attach(id, appId);
        }
      }
    }

    if (parent && nodes.has(parent) && !placed.has(id)) attach(parent, id);
    // an unplaced service joins its logical group, which also places it
    if (group(service)) placed.add(id);
  }

  // Orphans: a VPC-bound service still unplaced goes into the least-filled
  // subnet of the VPC with the most subnets, or into that VPC when it has none.
  // The other orphans go to the root or the utility group, outside any element.
  const subnetIds = new Set(
    services
      .filter((s) => {
        const type = typeOf(s);
        return type === 'subnet' || type === 'subnetwork';
      })
      .map((s) => text(s.id))
      .filter((id): id is string => id !== undefined)
  );
  const subnetsUnder = (root: string) => {
    const found: string[] = [];
    const seen = new Set<string>();
    const walk = (id: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      if (subnetIds.has(id)) found.push(id);
      (children.get(id) ?? []).forEach(walk);
    };
    walk(root);
    return found;
  };
  const defaultVpc = defaultVpcId(vpcOfSubnet);
  for (const service of services) {
    const id = text(service.id);
    if (!id || placed.has(id)) continue;
    placed.add(id);
    const type = typeOf(service);
    if (type === undefined || !VPC_BOUND_TYPES.has(type)) continue;
    if (!defaultVpc || !nodes.has(defaultVpc)) continue;
    const subnets = subnetsUnder(defaultVpc);
    // a stable pick of the first subnet with the fewest children
    const target = subnets.reduce<string | undefined>(
      (best, sn) =>
        best === undefined ||
        (children.get(sn)?.length ?? 0) < (children.get(best)?.length ?? 0)
          ? sn
          : best,
      undefined
    );
    attach(target ?? defaultVpc, id);
  }

  return new Set(
    [...children].filter(([, list]) => list.length > 0).map(([id]) => id)
  );
}

/** The VPC with the most subnets, ties broken by id, as the builder picks it. */
function defaultVpcId(vpcOfSubnet: Map<string, string>): string | undefined {
  const counts = new Map<string, number>();
  for (const vpc of vpcOfSubnet.values()) {
    counts.set(vpc, (counts.get(vpc) ?? 0) + 1);
  }
  return [...counts].sort(
    ([a, aCount], [b, bCount]) => bCount - aCount || a.localeCompare(b)
  )[0]?.[0];
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
    const applications = Array.isArray(config.applications)
      ? config.applications.filter(isObject)
      : [];
    const containers = containerIds(services, applications);

    const visit = (item: unknown) => {
      if (isObject(item) && isObject(item.visual)) {
        pick(item.visual.layout, ELK_ONLY_ELEMENT_LAYOUT, elementLayout);
        if (typeof item.id === 'string' && containers.has(item.id)) {
          pick(item.visual.layout, ELK_ONLY_CONTAINER_SIZE, elementLayout);
        }
      }
    };
    applications.forEach(visit);
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

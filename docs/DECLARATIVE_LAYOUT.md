# Declarative Layout & Styling

ADAC 0.2 lets an author describe **what the diagram should look like
structurally**, while the layout engine works out the coordinates. Nothing here
is an absolute position, and nothing is an ELK option: ADAC properties are
translated into engine constraints by the adapter.

```yaml
layoutOptions:
  direction: LR # overall flow
  gap: 1
  containerPadding: 1

# on an element:
visual:
  layout:
    direction: TB # how *this* element arranges its direct children
    maxItemsPerLine: 2
    gap: 0.5
  style:
    background: true
```

A runnable example lives in [`yamls/aws_declarative_layout.adac.yaml`](../yamls/aws_declarative_layout.adac.yaml).

## The hierarchical model

Layout is **hierarchical and composable**: each container controls the layout
of its _direct children only_.

```text
VPC                    ← its layout places the subnets
├── Public Subnet      ← its layout places ALB, NAT
└── Private Subnet     ← its layout places ECS, DB
    ├── ECS
    └── DB
```

Properties are resolved in this order:

```text
global layoutOptions  →  nearest layout-declaring ancestor  →  element's own layout
```

## Units

Every length is a **logical unit** resolved through `layoutOptions.unitSize`
(default `100`). With `unitSize: 100`, `gap: 2` is 200 px. One function,
`resolveUnit()` in `layout-properties.ts`, performs the conversion for `gap`,
`padding`, `edgeSpacing`, `size`, `minSize` and `maxSize`; nothing mixes units
and pixels.

## `layoutOptions` (global defaults)

| Property           | Values                                                | Notes                                                                                                                       |
| ------------------ | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `engine`           | `elk`, `custom`, `orthogonal`, `tsm`                  | a CLI/API override still wins; ELK when neither this nor the top-level `layout` is set                                      |
| `defaults`         | `v1` (default), `none`                                | default profile for options you leave out, on `elk` only (see [Defaults](#defaults-elk))                                    |
| `unitSize`         | number > 0                                            | pixels per logical unit                                                                                                     |
| `direction`        | `LR` `RL` `TB` `BT`                                   | flow of the whole diagram, default for nested                                                                               |
| `gap`              | number \| `{horizontal, vertical}`                    | space between siblings                                                                                                      |
| `containerPadding` | number \| `{top,right,bottom,left}`                   | default container padding                                                                                                   |
| `align`            | `start` `center` `end`                                | default for arranged containers                                                                                             |
| `justify`          | `start` `center` `end` `space-between` `space-around` | default for arranged containers                                                                                             |
| `edgeSpacing`      | number ≥ 0                                            | edge-to-node clearance (edge-to-edge is half)                                                                               |
| `edgeRouting`      | `orthogonal` `polyline` `splines` `straight`          | default routing                                                                                                             |
| `background`       | boolean (default `false`)                             | default node/card background                                                                                                |
| `labelMaxChars`    | integer 4–80 (default: fits the caption width)        | most characters on one line of a node label; longer labels wrap, then end in `…`. Per element: `visual.style.labelMaxChars` |
| `edgeLabels`       | boolean (default `true`)                              | draw each connection `type` on its edge                                                                                     |

## Defaults (elk)

On `elk`, `layoutOptions` you leave out are filled from a small, trialled
profile so files written before this feature get a consistent baseline without
being edited. Your own values always win, at the global and the element level,
and the defaults are never written into the document: validation and the
non-ELK warning see only what you declared. Set `layoutOptions.defaults: none`
to keep the engine's own behaviour.

Profile `v1`:

| Option             | Default                                          | Effect                                                       |
| ------------------ | ------------------------------------------------ | ------------------------------------------------------------ |
| `direction`        | `LR`                                             | the flow the builder already used, now stated                |
| `containerPadding` | `{top: 0.6, right: 0.3, bottom: 0.3, left: 0.3}` | keeps the 60px title band, trims the sides from 40px to 30px |

The generation log records one line (`Layout defaults applied: …`) naming the
defaults that were used.

### What was tried and rejected

Each candidate was rendered over the 18 files in `yamls/` and compared with the
baseline (canvas area, overlaps, edge length and bends). Two files
(`aws_enterprise_data_lake`, `data_pipeline`) fail inside ELK itself, with or
without defaults, and are excluded.

| Candidate                                | Result over the 16 renderable samples                                            | Decision |
| ---------------------------------------- | -------------------------------------------------------------------------------- | -------- |
| `direction: LR`                          | identical to the baseline (the builder already sets `RIGHT`)                     | **kept** |
| `containerPadding` 0.6 / 0.3 / 0.3 / 0.3 | median area −2%, none larger, no overlaps                                        | **kept** |
| `containerPadding` top 0.5 (sides 0.3)   | median area −3%, but eats into the 60px title band                               | rejected |
| `direction: TB`                          | rotates every diagram (10 of 16 shrink >10%, 1 more bend); not a neutral default | rejected |
| `gap` 1.2 / 0.6                          | median area +25%, 10 samples >10% larger, up to +77%                             | rejected |
| `gap` 0.8 / 0.4                          | mixed: 5 samples >10% larger, 3 smaller, up to +37%                              | rejected |
| `edgeSpacing` 0.3                        | mixed (−6% to +17%), no consistent gain                                          | rejected |
| `edgeRouting: orthogonal`                | identical to the baseline; would also override a caller's routing mode           | rejected |
| `align` + `justify: center`              | 19 new overlaps (they arrange the root and collide free-standing nodes)          | rejected |

Never defaulted, because they invent structure: `order`, `position`, `wrap`,
`itemsPerLine`, `maxItemsPerLine`, `size`, `minSize`, `maxSize` and a
connection's `layout` / `bidirectional`. `unitSize`, `background`, `edgeLabels`
and `labelMaxChars` already have their own defaults and are unchanged.

Effect of `v1` on the renderable samples: mean canvas area −2.8% (range −8.3%
to 0%), no sample larger, no new overlaps. The two declarative examples declare
their own padding and are unchanged.

## `visual.layout` (per element)

| Property          | Values                                                | Inheritance         | Applies to                |
| ----------------- | ----------------------------------------------------- | ------------------- | ------------------------- |
| `direction`       | `LR` `RL` `TB` `BT`                                   | **inherited**       | children                  |
| `gap`             | number \| `{horizontal, vertical}`                    | **inherited**       | children (per axis merge) |
| `align`           | `start` `center` `end`                                | **inherited**       | children, cross axis      |
| `justify`         | `start` `center` `end` `space-between` `space-around` | **inherited**       | children, main axis       |
| `padding`         | number \| `{top,right,bottom,left}`                   | local               | this container            |
| `wrap`            | boolean                                               | local               | children                  |
| `itemsPerLine`    | integer ≥ 1 (exact)                                   | **never inherited** | children                  |
| `maxItemsPerLine` | integer ≥ 1 (maximum, lines balanced)                 | **never inherited** | children                  |
| `size`            | `{width, height}` number \| `auto`                    | local               | this element              |
| `minSize`         | `{width, height}` number \| `auto`                    | local               | this element              |
| `maxSize`         | `{width, height}` number \| `auto`                    | local               | this element              |
| `order`           | integer                                               | placement           | position among siblings   |
| `position`        | `top-left` … `bottom-right`, `center`                 | **never inherited** | region in the parent      |

`order` and `position` describe the element itself within its parent, so they
are never inherited either.

### Arrangement

A container is **arranged** once it (or its nearest layout-declaring ancestor)
declares `direction`, `wrap`, `itemsPerLine`, `maxItemsPerLine`, `align` or
`justify`; declaring `order` on a child also arranges the parent. Arranged
containers lay their children out in a line along `direction` (wrapping when a
line limit is set). Containers that declare nothing keep the engine's own flow.
`gap`, `padding` and sizes never arrange anything on their own.

- `itemsPerLine: 2` puts exactly two items on each line.
- `maxItemsPerLine: 4` uses the fewest lines and balances them: five items give
  `3 + 2`, not `4 + 1`.
- `wrap: false` together with a line limit is invalid.
- `RL` / `BT` reverse the sequence along the axis.
- `position` in an arranged container moves the element to the start or end of
  its line; elsewhere it pins the element to the first/last layer of the flow.

### Sizing

`size`, `minSize` and `maxSize` are constraints, not coordinates. A container
can never be smaller than its content, so `size`/`minSize` act as a floor.
`maxSize` is applied to leaf elements; for containers ELK cannot enforce a
ceiling, so a warning is logged when the content does not fit.

## `connections[].layout`

```yaml
connections:
  - from: app
    to: database
    bidirectional: true
    layout:
      fromSide: right # left | right | top | bottom | auto
      toSide: left
      routing: orthogonal # orthogonal | polyline | splines | straight
```

- Sides become fixed ports in ELK; `auto` leaves the choice to the engine.
- `bidirectional: true` draws arrowheads at both ends.
- Two connections between the same nodes in opposite directions are nudged
  apart so they never overlap.
- A per-connection `routing` of `straight` or `splines` is drawn by the
  renderer; ELK itself routes the whole diagram with `edgeRouting`.

## Styling

`visual.style.background` overrides `layoutOptions.background` for one element.
With the default (`false`) no card or icon pill is drawn behind an icon; `true`
restores the classic white card.

## Deprecated aliases

| Deprecated | Use           |
| ---------- | ------------- |
| `unit`     | `unitSize`    |
| `routing`  | `edgeRouting` |

Both still work. The validator reports them as warnings and the diagram log
repeats them; when both names are set the new one wins.

## How it maps to the engine

ELK ignores per-container `direction` when connections cross container
boundaries, so the ELK adapter realises arrangements with structure it _does_
honour:

- a row along the flow is a chain of invisible, layout-only edges;
- wrapped lines are invisible groups (type `layout-line`), stacked or chained;
- `align`, `justify`, declared order within a stacked layer and `maxSize` checks
  run as a post-layout pass that moves nodes and re-attaches their edges;
- connections that run _between lines_ of one container are withheld from
  layering (otherwise ELK staggers the lines) and routed afterwards.

Layout-only edges (ids starting `__adac_layout__`) and line groups are never
drawn. The `custom`, `orthogonal` and `tsm` engines receive the plain hierarchy and
ignore arrangement properties and the connection-level `bidirectional` and
`routing` properties; `background`, `labelMaxChars` and `edgeLabels` still
apply.

## Engine support

| Property                                                                                                                             | `elk` | `custom` / `orthogonal` / `tsm` |
| ------------------------------------------------------------------------------------------------------------------------------------ | :---: | :-----------------------------: |
| `layoutOptions`: `direction`, `gap`, `containerPadding`, `align`, `justify`, `edgeSpacing`, `edgeRouting` (and deprecated `routing`) |  yes  |               no                |
| `visual.layout`: `direction`, `gap`, `padding`, `align`, `justify`, `wrap`, `itemsPerLine`, `maxItemsPerLine`, `order`, `position`   |  yes  |               no                |
| `connections[].layout`: `fromSide`, `toSide`, `routing`; `bidirectional`                                                             |  yes  |               no                |
| `visual.layout`: `size`, `minSize`, `maxSize` (on leaf elements; containers are sized by `elk` only, silently)                       |  yes  |               yes               |
| `layoutOptions`: `unitSize`, `background`, `edgeLabels`, `labelMaxChars`                                                             |  yes  |               yes               |

When a file **declares** any property marked "no" and the engine in effect is not
`elk` (`--layout`, then `layoutOptions.engine`, then the top-level `layout`), the
generator logs one warning per file. It names the engine and lists the ignored
groups, for example:

```
Warning: Layout engine "custom" ignores declarative layout properties:
layoutOptions (direction, gap); visual.layout (align, order). The diagram will
not follow the declared arrangement. Use --layout elk or set
layoutOptions.engine: elk.
```

The same warning is printed by `adac validate` and by `adac diagram`, and appears in
the generation log (`--validate`, API consumers). It is a **warning, not an
error**: the file is still valid and a diagram is still produced, just without
the declared arrangement. Only properties the author wrote count; files that
declare none of them, or only the shared properties, never warn.

## Known limitations

- `order` among the root's own children is best-effort; use `position` or
  connections to steer the top level.
- Real connections between items of an arranged container follow the arranged
  structure rather than ELK's layering, so such edges are routed with a single
  orthogonal bend and may cross other items.
- `labelPosition`, `labelSpacing`, `avoidOverlap`, `laneSpacing` and the other
  items listed under _Future Considerations_ in the issue are not implemented.

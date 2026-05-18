# Layout Algorithms Specification

The `@mindfiredigital/adac-layout-core` package uses a proprietary implementation of the **Sugiyama Framework**, a standard approach for drawing hierarchical Directed Acyclic Graphs (DAGs).

The process is divided into several distinct phases to ensure mathematical correctness and visual clarity.

---

## 1. Cycle Detection & Breaking

Architectural graphs often contain cycles (e.g., circular dependencies between services). Since layered layouts require a DAG, the first step is to identify and resolve these loops.

- **Algorithm**: Depth-First Search (DFS) based cycle detection.
- **Resolution**: Identified back-edges are temporarily reversed during the layout calculation. They are restored to their original direction during the final rendering phase.

## 2. Rank Assignment (Layering)

Nodes are assigned to discrete "ranks" or layers. Ranks determine the position of the node along the primary axis (Vertical for `TB`, Horizontal for `LR`).

- **Constraint**: For every edge `(u, v)`, the rank of `u` must be less than the rank of `v`.
- **Strategy**:
  - **Topological Order**: Initial ranking follows the dependency order.
  - **Normalization**: Edges that span multiple ranks are broken into segments by inserting **Virtual Nodes**. This ensures that all edges only connect nodes in adjacent ranks, which is critical for the subsequent phases.

## 3. Crossing Reduction (Ordering)

This phase determines the relative order of nodes within each rank. The goal is to minimize the number of edge crossings, which is an NP-hard problem.

- **Heuristic**: **Barycenter Heuristic**.
- **Process**:
  - The algorithm performs multiple "sweeps" (top-down and bottom-up).
  - In each sweep, a node's position is calculated as the average (barycenter) of the positions of its neighbors in the adjacent rank.
  - Nodes are then sorted based on these barycenter values.
  - This iterative process converges to an ordering that significantly reduces crossings.

## 4. Coordinate Assignment (Positioning)

Once ranks and orders are fixed, exact coordinates are assigned to each node.

- **Objective**:
  - Centering nodes relative to their neighbors (Symmetry).
  - Maintaining minimum separation (`nodesep` and `ranksep`).
  - Avoiding unnecessary "zig-zag" patterns in edges.
- **Strategy**: Balanced coordinate assignment. The engine calculates the preferred position for each node by balancing the forces of its connected neighbors, ensuring a stable and professional layout.

## 5. Edge Routing

The final phase calculates the polyline paths for the edges.

- **Method**:
  - The path of an edge is defined by the coordinates of its source, target, and any intermediate virtual nodes.
  - **Orthogonal Routing**: The renderer converts these coordinates into right-angle paths, which is the industry standard for cloud architecture diagrams.
  - **Collision Avoidance**: By using virtual nodes during the layout phase, the engine naturally reserves space for edges, preventing them from overlapping unrelated nodes.

---

## Performance Considerations

The implementation is optimized for the scale of architectural diagrams (typically 10-500 nodes).

- **Time Complexity**: Primarily $O(E \cdot \text{sweeps})$ for crossing reduction, where $E$ is the number of edges (including virtual edges).
- **Memory**: $O(N + E)$ where $N$ is the total number of nodes.

This ensures that diagrams are generated in real-time within the ADAC CLI and Web UI.

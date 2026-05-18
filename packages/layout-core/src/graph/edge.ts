export class Edge {
  from: string;
  to: string;
  data?: Record<string, unknown>;
  virtualPath?: string[];

  constructor(from: string, to: string, data?: Record<string, unknown>) {
    this.from = from;
    this.to = to;
    this.data = data;
  }
}

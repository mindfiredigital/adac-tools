export class Node {
  id: string;
  width: number;
  height: number;
  data?: Record<string, unknown>;
  incoming: Set<string> = new Set();
  outgoing: Set<string> = new Set();

  constructor(id: string, width: number, height: number, data?: Record<string, unknown>) {
    this.id = id;
    this.width = width;
    this.height = height;
    this.data = data;
  }
}

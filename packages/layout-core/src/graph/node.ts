export class Node {
  id: string;
  width: number;
  height: number;
  data?: Record<string, unknown>;
  incoming: Set<string> = new Set();
  outgoing: Set<string> = new Set();

  x: number = 0;
  y: number = 0;
  rank: number = 0;
  order: number = 0;
  isVirtual: boolean = false;

  constructor(
    id: string,
    width: number,
    height: number,
    data?: Record<string, unknown>
  ) {
    this.id = id;
    this.width = width;
    this.height = height;
    this.data = data;
  }
}

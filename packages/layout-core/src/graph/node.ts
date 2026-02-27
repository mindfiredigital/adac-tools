export class Node {
  id: string;
  width: number;
  height: number;
  incoming: Set<string> = new Set();
  outgoing: Set<string> = new Set();

  constructor(id: string, width: number, height: number) {
    this.id = id;
    this.width = width;
    this.height = height;
  }
}

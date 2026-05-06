declare module '@mindfiredigital/adac-layout' {
  export type LayoutOptions = Record<string, unknown>;
  export type AdacModel = any;

  export interface LayoutEngine {
    addNode(
      id: string,
      data: { width: number; height: number; parent?: string }
    ): void;
    addEdge(from: string, to: string, data?: Record<string, unknown>): void;
    layout(): Promise<any> | any;
  }

  export function createLayoutEngine(
    type: 'auto' | 'custom' | 'elk',
    options?: LayoutOptions,
    model?: AdacModel
  ): Promise<LayoutEngine>;

  export {};
}

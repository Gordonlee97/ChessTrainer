export interface UciTransport {
  send(cmd: string): void;
  onLine(cb: (line: string) => void): () => void;
  terminate(): void;
}

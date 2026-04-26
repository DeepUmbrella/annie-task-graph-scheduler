export interface TransportAdapter {
  send(message: unknown): Promise<void>;
}

export class MockAdapter implements TransportAdapter {
  public readonly sent: unknown[] = [];

  async send(message: unknown): Promise<void> {
    this.sent.push(message);
  }
}

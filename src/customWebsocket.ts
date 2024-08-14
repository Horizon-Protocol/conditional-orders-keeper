import { ethers } from 'ethers';
import { WebSocket } from 'ws';

const WEBSOCKET_BACKOFF_BASE = 100;
const WEBSOCKET_BACKOFF_CAP = 30000;
const WEBSOCKET_PING_INTERVAL = 10000;
const WEBSOCKET_PONG_TIMEOUT = 5000;

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const WebSocketProviderClass = (): new () => ethers.providers.WebSocketProvider => (class {} as never);

export class WebSocketProvider extends WebSocketProviderClass() {
  private attempts = 0;
  private destroyed = false;
  private timeout?: NodeJS.Timeout;

  private events: ethers.providers.WebSocketProvider['_events'] = [];
  private requests: ethers.providers.WebSocketProvider['_requests'] = {};
  private provider?: ethers.providers.WebSocketProvider;

  private handler = {
    get(target: WebSocketProvider, prop: keyof WebSocketProvider, receiver: unknown) {
      if (target[prop]) return target[prop];

      const value = target.provider && Reflect.get(target.provider, prop, receiver);

      return value instanceof Function ? value.bind(target.provider) : value;
    },
  };

  constructor(private providerUrl: string) {
    super();
    this.create();

    return new Proxy(this, this.handler);
  }

  private create() {
    if (this.provider) {
      this.events = [...this.events, ...this.provider._events];
      this.requests = { ...this.requests, ...this.provider._requests };
    }

    const webSocket = new WebSocket(this.providerUrl);
    const provider = new ethers.providers.WebSocketProvider(webSocket as never, this.provider?.network?.chainId);
    let pingInterval: NodeJS.Timer | undefined;
    let pongTimeout: NodeJS.Timeout | undefined;

    webSocket.on('open', () => {
      this.attempts = 0;

      pingInterval = setInterval(() => {
        webSocket.ping();

        pongTimeout = setTimeout(() => {
          webSocket.terminate();
        }, WEBSOCKET_PONG_TIMEOUT);
      }, WEBSOCKET_PING_INTERVAL);

      let event;
      while ((event = this.events.pop())) {
        provider._events.push(event);
        provider._startEvent(event);
      }

      for (const key in this.requests) {
        provider._requests[key] = this.requests[key];
        webSocket.send(this.requests[key].payload);
        delete this.requests[key];
      }
    });

    webSocket.on('error', (err) => {
      console.info('WebSocket error: %s', err.message);
    });

    webSocket.on('pong', () => {
      if (pongTimeout) clearTimeout(pongTimeout);
    });

    webSocket.on('close', () => {
      provider._wsReady = false;

      if (pingInterval) clearInterval(pingInterval);
      if (pongTimeout) clearTimeout(pongTimeout);

      if (!this.destroyed) {
        const sleep = getRandomInt(0, Math.min(WEBSOCKET_BACKOFF_CAP, WEBSOCKET_BACKOFF_BASE * 2 ** this.attempts++));

        this.timeout = setTimeout(() => this.create(), sleep);
      }
    });

    this.provider = provider;
  }

  public async destroy() {
    this.destroyed = true;

    if (this.timeout) {
      clearTimeout(this.timeout);
    }

    if (this.provider) {
      await this.provider.destroy();
    }
  }
}
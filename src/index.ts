import { DurableObject } from "cloudflare:workers";

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
const PORT = 8080;

export class HermesContainer extends DurableObject {
  starting: Promise<void> | undefined;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const container = ctx.container;
    if (container?.running) {
      void ctx.blockConcurrencyWhile(() =>
        container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS),
      );
    }
  }

  async fetch(request: Request): Promise<Response> {
    try {
      this.starting ??= this.startAndWait().finally(() => {
        this.starting = undefined;
      });
      await this.starting;

      const url = new URL(request.url);
      url.protocol = "http:";
      url.host = "container";
      const forwarded = new Request(url, request);
      forwarded.headers.delete("host");
      return this.ctx.container.getTcpPort(PORT).fetch(forwarded);
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message, stack: e.stack }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  private async startAndWait(): Promise<void> {
    const container = this.ctx.container;
    if (!container) throw new Error("No container configured on ctx");
    if (!container.running) {
      container.start({
        image: container.images.base,
        instance: "standard-1",
        enableInternet: true,
      });
    }
    await container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const id = env.HERMES_CONTAINER.idFromName("hermes");
      const stub = env.HERMES_CONTAINER.get(id);
      return stub.fetch(request);
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message, stack: e.stack }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};

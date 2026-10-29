import { DurableObject } from "cloudflare:workers";

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

export class HermesContainer extends DurableObject {
  starting: Promise<void> | undefined;

  async fetch(request: Request): Promise<Response> {
    try {
      this.starting ??= this.startContainer().finally(() => {
        this.starting = undefined;
      });
      await this.starting;

      const container = this.ctx.container;
      return new Response(JSON.stringify({
        status: "container started",
        running: container?.running,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message, stack: e.stack }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  private async startContainer(): Promise<void> {
    const container = this.ctx.container;
    if (!container) throw new Error("No container on ctx");
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
    const id = env.HERMES_CONTAINER.idFromName("hermes");
    const stub = env.HERMES_CONTAINER.get(id);
    return stub.fetch(request);
  },
};

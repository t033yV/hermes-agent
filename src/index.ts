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

      // Probe common ports to find where Hermes gateway is listening
      const ports = [3000, 5000, 8000, 8080, 8888, 11434, 4000, 9000];
      for (const port of ports) {
        try {
          const containerPort = this.ctx.container.getTcpPort(port);
          const url = new URL(request.url);
          url.protocol = "http:";
          url.host = "container";
          const forwarded = new Request(url, request);
          forwarded.headers.delete("host");
          const response = await containerPort.fetch(forwarded);
          return new Response(response.body, {
            status: response.status,
            headers: response.headers,
          });
        } catch (e) {
          continue;
        }
      }

      return new Response(JSON.stringify({
        error: "Hermes gateway not listening on any probed port",
        tried: ports,
      }), {
        status: 502,
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
        env: {
          OPENROUTER_API_KEY: this.env.OPENROUTER_API_KEY || "",
        },
        entrypoint: ["/opt/hermes/hermes", "gateway"],
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

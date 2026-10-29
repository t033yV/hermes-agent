import { DurableObject } from "cloudflare:workers";

export class HermesContainer extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const container = this.ctx.container;
    const url = new URL(request.url);

    if (url.pathname === "/reset") {
      if (container.running) {
        await container.destroy();
      }
      container.start({
        image: container.images.base,
        instance: "standard-1",
        enableInternet: true,
        env: { OPENROUTER_API_KEY: this.env.OPENROUTER_API_KEY || "" },
        entrypoint: ["/init", "sleep", "infinity"],
      });
      await container.setInactivityTimeout(30 * 60 * 1000);
      return new Response("Container reset. Wait 10s then list instances.");
    }

    if (!container.running) {
      container.start({
        image: container.images.base,
        instance: "standard-1",
        enableInternet: true,
        env: { OPENROUTER_API_KEY: this.env.OPENROUTER_API_KEY || "" },
        entrypoint: ["/init", "sleep", "infinity"],
      });
    }
    await container.setInactivityTimeout(30 * 60 * 1000);
    return new Response("Hermes container running. Connect via SSH.");
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const id = env.HERMES_CONTAINER.idFromName("hermes");
    const stub = env.HERMES_CONTAINER.get(id);
    return stub.fetch(request);
  },
};

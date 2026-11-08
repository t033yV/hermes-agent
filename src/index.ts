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
        env: {
          OPENROUTER_API_KEY: this.env.OPENROUTER_API_KEY || "",
          R2_ACCESS_KEY_ID: this.env.R2_ACCESS_KEY_ID || "",
          R2_SECRET_ACCESS_KEY: this.env.R2_SECRET_ACCESS_KEY || "",
          R2_ACCOUNT_ID: this.env.R2_ACCOUNT_ID || "",
        },
      });
      await container.setInactivityTimeout(24 * 60 * 60 * 1000);
      return new Response("Container reset with R2 mount.");
    }

    if (!container.running) {
      container.start({
        image: container.images.base,
        instance: "standard-1",
        enableInternet: true,
        env: {
          OPENROUTER_API_KEY: this.env.OPENROUTER_API_KEY || "",
          R2_ACCESS_KEY_ID: this.env.R2_ACCESS_KEY_ID || "",
          R2_SECRET_ACCESS_KEY: this.env.R2_SECRET_ACCESS_KEY || "",
          R2_ACCOUNT_ID: this.env.R2_ACCOUNT_ID || "",
        },
      });
    }
    await container.setInactivityTimeout(24 * 60 * 60 * 1000);
    return new Response("Hermes container running with R2 persistent storage.");
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const id = env.HERMES_CONTAINER.idFromName("hermes");
    const stub = env.HERMES_CONTAINER.get(id);
    return stub.fetch(request);
  },
};

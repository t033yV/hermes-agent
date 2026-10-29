import { DurableObject } from "cloudflare:workers";

export class HermesContainer extends DurableObject {
  async ensureRunning() {
    if (this.ctx.container.running) return;
    this.ctx.container.start({
      image: this.ctx.container.images.base,
      instance: "standard-1",
      enableInternet: true,
    });
  }

  async fetch(request: Request): Promise<Response> {
    await this.ensureRunning();
    return this.ctx.container.fetch(request);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const id = env.HERMES_CONTAINER.idFromName("hermes");
    const stub = env.HERMES_CONTAINER.get(id);
    return stub.fetch(request);
  },
};

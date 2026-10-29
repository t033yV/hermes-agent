import { DurableObject } from "cloudflare:workers";

export class HermesContainer extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    return new Response("Durable Object works! Container not started yet.", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const id = env.HERMES_CONTAINER.idFromName("hermes");
    const stub = env.HERMES_CONTAINER.get(id);
    return stub.fetch(request);
  },
};

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

      const decoder = new TextDecoder();
      const results = {};

      const commands = [
        ["ps", "aux"],
        ["sh", "-c", "ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null || echo 'no ss/netstat'"],
        ["sh", "-c", "cat /proc/1/cmdline | tr '\\0' ' '"],
        ["sh", "-c", "ls /app /workspace /opt /home 2>/dev/null || echo 'no common dirs'"],
      ];

      for (const cmd of commands) {
        try {
          const process = await this.ctx.container.exec(cmd);
          const output = await process.output();
          results[cmd.join(" ")] = {
            exitCode: output.exitCode,
            stdout: decoder.decode(output.stdout).slice(0, 2000),
            stderr: decoder.decode(output.stderr).slice(0, 500),
          };
        } catch (e) {
          results[cmd.join(" ")] = { error: e.message };
        }
      }

      return new Response(JSON.stringify(results, null, 2), {
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

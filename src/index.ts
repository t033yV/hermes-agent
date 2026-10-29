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
        ["sh", "-c", "cat /opt/hermes/hermes"],
        ["sh", "-c", "head -80 /opt/hermes/.env.example"],
        ["sh", "-c", "ls /etc/cont-init.d/ 2>/dev/null"],
        ["sh", "-c", "cat /opt/hermes/docker/stage2-hook.sh 2>/dev/null | head -80"],
        ["sh", "-c", "su hermes -s /bin/sh -c 'cd /opt/hermes && /opt/hermes/hermes --help' 2>&1 | head -50"],
        ["sh", "-c", "su hermes -s /bin/sh -c 'cd /opt/hermes && /opt/hermes/hermes 2>&1' | head -50"],
      ];

      for (const cmd of commands) {
        try {
          const process = await this.ctx.container.exec(cmd);
          const output = await process.output();
          results[cmd.join(" ")] = {
            exitCode: output.exitCode,
            stdout: decoder.decode(output.stdout).slice(0, 3000),
            stderr: decoder.decode(output.stderr).slice(0, 1000),
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

interface Env {
  API_BASE_URL: string;
  SCHEDULER_SECRET: string;
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    const target = new URL("/api/internal/tick", env.API_BASE_URL);
    ctx.waitUntil(fetch(target, { method: "POST", headers: { Authorization: `Bearer ${env.SCHEDULER_SECRET}` } }).then(async (response) => {
      if (!response.ok) throw new Error(`SCHEDULER_TICK_${response.status}`);
      await response.arrayBuffer();
    }));
  },
} satisfies ExportedHandler<Env>;

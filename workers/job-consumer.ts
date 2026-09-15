interface Env { API_BASE_URL: string; SCHEDULER_SECRET: string }
type JobMessage = { occurrenceId: string; runId: string };

export default {
  async queue(batch: MessageBatch<unknown>, env: Env) {
    for (const message of batch.messages) {
      const body=message.body as Partial<JobMessage>;if(typeof body.occurrenceId!=="string"||typeof body.runId!=="string"){message.ack();continue;}
      const response = await fetch(new URL("/api/internal/jobs/execute", env.API_BASE_URL), {
        method: "POST",
        headers: { Authorization: `Bearer ${env.SCHEDULER_SECRET}`, "Content-Type": "application/json", "X-Queue-Attempt": String(message.attempts) },
        body: JSON.stringify({ occurrenceId: body.occurrenceId, runId: body.runId }),
      });
      if (response.ok) { message.ack(); continue; }
      if ([429, 502, 503, 504].includes(response.status)) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "0");
        message.retry({ delaySeconds: Math.min(3600, Math.max(5, retryAfter || 15 * 2 ** Math.min(message.attempts, 7))) });
      } else message.ack();
    }
  },
} satisfies ExportedHandler<Env>;

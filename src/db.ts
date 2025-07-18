import { drizzle } from "drizzle-orm/d1";
import { jobs } from "./schema";
import { eq, desc } from "drizzle-orm";
import { ChatCompletionMessageParam } from "openai/resources";

export class Database {
  private db;

  constructor(private env: Env) {
    this.db = drizzle(this.env.DB);
  }

  async insertJob(goal: string, baseUrl: string) {
    const job = await this.db
      .insert(jobs)
      .values({
        goal,
        startingUrl: baseUrl,
        status: "pending",
      })
      .returning({ id: jobs.id, createdAt: jobs.createdAt })
      .get();
    return job;
  }

  async updateJob(
    id: number,
    messages: ChatCompletionMessageParam[],
    logs: string[],
    updatedAt: string
  ) {
    await this.db
      .update(jobs)
      .set({
        messages: JSON.stringify(messages),
        log: logs.join("\n"),
        updatedAt,
      })
      .where(eq(jobs.id, id));
  }

  async getJob(id: number) {
    const job = await this.db
      .select()
      .from(jobs)
      .where(eq(jobs.id, id))
      .get();
    return job;
  }

  async updateJobStatus(id: number, status: string) {
    await this.db
      .update(jobs)
      .set({
        status,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(jobs.id, id));
  }

  async finalizeJob(
    id: number,
    finalAnswer: string,
    messages: ChatCompletionMessageParam[],
    logs: string[],
    completedAt: string
  ) {
    await this.db.update(jobs).set({
      output: finalAnswer,
      status: "completed",
      messages: JSON.stringify(messages),
      log: logs.join("\n"),
      completedAt,
      updatedAt: new Date().toISOString(),
    }).where(eq(jobs.id, id));
  }

  async getAllJobs() {
    return await this.db.select().from(jobs).orderBy(desc(jobs.createdAt)).all();
  }

  async getJob(id: number) {
    return await this.db.select().from(jobs).where(eq(jobs.id, id)).get();
  }
}

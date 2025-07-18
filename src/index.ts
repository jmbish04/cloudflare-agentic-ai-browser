import puppeteer from "@cloudflare/puppeteer";
import OpenAI from "openai";
import { ChatCompletion, ChatCompletionMessageParam } from "openai/resources";
import { tools } from "./tools";
import { systemPrompt } from "./prompts";
import { getCleanHtml, removeHtmlsFromMessages } from "./utils";
import { Database } from "./db";
import { Hono } from "hono";
import {
  DASHBOARD_TEMPLATE,
  JOB_DETAIL_TEMPLATE,
  PROGRESS_TEMPLATE,
  renderTemplate
} from "./templates";
import {
  BASE_CSS,
  DASHBOARD_CSS,
  JOB_DETAIL_CSS,
  PROGRESS_CSS,
  DASHBOARD_JS,
  PROGRESS_JS
} from "./static-assets";

// Constants
const BROWSER_WIDTH = 1920;
const BROWSER_HEIGHT = 1080;
const KEEP_BROWSER_ALIVE_IN_SECONDS = 180;
const DEFAULT_PAGE_TIMEOUT_MS = 20000; // Increased timeout
const UI_UPDATE_WAIT_MS = 1000;
const RADIX_DECIMAL = 10;
const BROWSER_IDLE_TIMEOUT_SECONDS = 300; // 5 minutes

const app = new Hono<{ Bindings: Env }>();

// Static asset routes
app.get("/static/css/base.css", (c) => new Response(BASE_CSS, { headers: { "Content-Type": "text/css" } }));
app.get("/static/css/dashboard.css", (c) => new Response(DASHBOARD_CSS, { headers: { "Content-Type": "text/css" } }));
app.get("/static/css/job-detail.css", (c) => new Response(JOB_DETAIL_CSS, { headers: { "Content-Type": "text/css" } }));
app.get("/static/css/progress.css", (c) => new Response(PROGRESS_CSS, { headers: { "Content-Type": "text/css" } }));
app.get("/static/js/dashboard.js", (c) => new Response(DASHBOARD_JS, { headers: { "Content-Type": "application/javascript" } }));
app.get("/static/js/progress.js", (c) => new Response(PROGRESS_JS, { headers: { "Content-Type": "application/javascript" } }));

// Frontend routes
app.get("/", async (c) => {
  const db = new Database(c.env);
  const jobs = await db.getAllJobs();
  const jobsContent = jobs.length === 0
    ? '<p>No jobs yet. Create your first browser automation request above!</p>'
    : jobs.map(job => `
        <div class="job" onclick="viewJob(${job.id})">
          <div class="job-header">
            <span class="job-id">Job #${job.id}</span>
            <span class="job-status status-${job.status}">${job.status}</span>
          </div>
          <div class="job-goal"><strong>Goal:</strong> ${job.goal}</div>
          <div class="job-url"><strong>URL:</strong> ${job.startingUrl}</div>
          <div class="job-time"><strong>Created:</strong> ${job.createdAt}</div>
        </div>
      `).join('');
  const htmlContent = renderTemplate(DASHBOARD_TEMPLATE, { JOBS_CONTENT: jobsContent });
  return c.html(htmlContent);
});

app.get("/job/:id", async (c) => {
  const id = parseInt(c.req.param("id"), RADIX_DECIMAL);
  if (isNaN(id)) {
    return c.html("Invalid job ID", 400);
  }

  const db = new Database(c.env);
  const job = await db.getJob(id);
  if (!job) {
    return c.html("Job not found", 404);
  }

  const completionInfo = job.completedAt ? `<div class="info-group"><div class="info-label">Completed:</div><div class="info-value">${job.completedAt}</div></div>` : '';
  const outputInfo = job.output ? `<div class="info-group"><div class="info-label">Result:</div><div class="output">${job.output}</div></div>` : '';
  const logInfo = job.log ? `<div class="info-group"><div class="info-label">Execution Log:</div><div class="logs">${job.log}</div></div>` : '';
  const refreshScript = job.status === 'running' ? `<script>setTimeout(() => { window.location.reload(); }, ${JOB_STATUS_POLL_INTERVAL_MS});</script>` : '';

  const htmlContent = renderTemplate(JOB_DETAIL_TEMPLATE, {
    JOB_ID: job.id.toString(),
    JOB_STATUS: job.status,
    JOB_GOAL: job.goal,
    JOB_URL: job.startingUrl,
    JOB_CREATED: job.createdAt,
    COMPLETION_INFO: completionInfo,
    OUTPUT_INFO: outputInfo,
    LOG_INFO: logInfo,
    REFRESH_SCRIPT: refreshScript
  });
  return c.html(htmlContent);
});

app.get("/progress", async (c) => {
    const jobId = c.req.query('jobId');
    if (!jobId) {
        return c.html('<p>No job ID provided. <a href="/">Return to dashboard</a></p>', 400);
    }
    const htmlContent = renderTemplate(PROGRESS_TEMPLATE, { JOB_ID: jobId });
    return c.html(htmlContent);
});

// API routes
app.post("/api/jobs", async (c) => {
  const { success } = await c.env.RATE_LIMITER.limit({ key: c.req.header("CF-Connecting-IP") ?? "local" });
  if (!success) {
    return c.json({ error: "Rate limit exceeded" }, 429);
  }

  const data: { baseUrl?: string; goal?: string } = await c.req.json();
  if (!data.baseUrl || !data.goal) {
    return c.json({ error: "Base URL and Goal are required" }, 400);
  }

  const db = new Database(c.env);
  const job = await db.insertJob(data.goal, data.baseUrl);

  const id = c.env.BROWSER.idFromName("browser-v1");
  const obj = c.env.BROWSER.get(id);

  c.executionCtx.waitUntil(obj.fetch(new Request(c.req.url, {
    method: 'POST',
    body: JSON.stringify({ jobId: job.id, baseUrl: data.baseUrl, goal: data.goal }),
    headers: { 'Content-Type': 'application/json' }
  })));

  return c.json({ jobId: job.id, status: 'pending', createdAt: job.createdAt });
});

app.get("/api/jobs", async (c) => {
  const db = new Database(c.env);
  const jobs = await db.getAllJobs();
  return c.json(jobs);
});

app.get("/api/jobs/:id", async (c) => {
  const id = parseInt(c.req.param("id"), RADIX_DECIMAL);
  if (isNaN(id)) {
    return c.json({ error: "Invalid job ID" }, 400);
  }
  const db = new Database(c.env);
  const job = await db.getJob(id);
  if (!job) return c.json({ error: "Job not found" }, 404);
  return c.json(job);
});

// Legacy POST route for streaming logs
app.post("/", async (c) => {
  const { success } = await c.env.RATE_LIMITER.limit({ key: c.req.header("CF-Connecting-IP") ?? "local" });
  if (!success) return new Response(`429 Failure – rate limit exceeded`, { status: 429 });
  const id = c.env.BROWSER.idFromName("browser-v1");
  const obj = c.env.BROWSER.get(id);
  return obj.fetch(c.req.raw);
});

export default {
  fetch: app.fetch,
};

export class Browser {
  keptAliveInSeconds: number = 0;
  browser: puppeteer.Browser | null = null;
  state: DurableObjectState;
  storage: DurableObjectStorage;
  env: Env;
  db: Database;
  openai: OpenAI;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.storage = state.storage;
    this.env = env;
    this.db = new Database(env);
    this.openai = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      baseURL: `https://gateway.ai.cloudflare.com/v1/${env.ACCOUNT_ID}/agentic-browser-ai-gateway/openai`,
    });
  }

  async fetch(request: Request) {
    const data: { baseUrl?: string; goal?: string; jobId?: number } = await request.json().catch(() => ({}));

    // This path handles async job execution initiated by /api/jobs
    if (data.jobId && data.baseUrl && data.goal) {
      this.state.waitUntil(this.executeJob(data.jobId, data.baseUrl, data.goal));
      return new Response("Job execution started.", { status: 202 });
    }

    // This path handles the legacy streaming endpoint
    if (data.baseUrl && data.goal) {
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const textEncoder = new TextEncoder();
      const log = (msg: string) => writer.write(textEncoder.encode(`${msg}\n`));

      const job = await this.db.insertJob(data.goal, data.baseUrl);

      this.state.waitUntil(
        this.executeJobWithLogs(job.id, data.baseUrl, data.goal, log)
          .catch(async (error: any) => {
            log(`Job ${job.id} failed: ${error.message}`);
            await this.db.updateJobStatus(job.id, "failed");
          })
          .finally(() => writer.close())
      );
      return new Response(readable);
    }

    return new Response("Invalid request.", { status: 400 });
  }

  private async executeJob(jobId: number, baseUrl: string, goal: string) {
    const logs: string[] = [];
    const startingTs: number = +new Date();
    const log = (msg: string) => {
      const fullMsg = `[${+new Date() - startingTs}ms]: ${msg}`;
      logs.push(fullMsg);
      console.log(`Job ${jobId}: ${fullMsg}`);
    };

    try {
      await this.executeJobWithLogs(jobId, baseUrl, goal, log);
    } catch (error: any) {
      console.error(`Job ${jobId} failed:`, error);
      const fullLogs = [`Critical Error: ${error.message}`, ...logs];
      await this.db.finalizeJob(jobId, `Failed: ${error.message}`, [], fullLogs.join('\n'), new Date().toISOString(), "failed");
    }
  }

  private async executeJobWithLogs(jobId: number, baseUrl: string, goal: string, log: (msg: string) => void) {
    this.keptAliveInSeconds = 0; // Reset inactivity timer for each job run

    await this.db.updateJobStatus(jobId, "running");

    const logs: string[] = [];
    const logAndStore = (msg: string) => {
      log(msg);
      logs.push(msg);
    };

    if (!this.browser || !this.browser.isConnected()) {
      logAndStore(`Starting new browser instance...`);
      this.browser = await puppeteer.launch(this.env.MYBROWSER);
      // Set the first alarm only when a browser is launched
      await this.storage.setAlarm(Date.now() + 60 * 1000); // Check in 1 minute
    }

    const page = await this.browser.newPage();
    try {
      await page.setViewport({ width: BROWSER_WIDTH, height: BROWSER_HEIGHT });
      page.setDefaultNavigationTimeout(DEFAULT_PAGE_TIMEOUT_MS);
      page.setDefaultTimeout(DEFAULT_ACTION_TIMEOUT_MS);

      logAndStore(`Navigating to ${baseUrl}...`);
      await page.goto(baseUrl, { waitUntil: 'networkidle2' });

      const initialHtml = await getCleanHtml(page);
      logAndStore(`Page loaded. HTML size: ${initialHtml.length} chars.`);

      const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Goal: ${goal}\n${initialHtml}` }
      ];

      let completion: ChatCompletion;
      let loopCount = 0;
      const maxLoops = 15;

      do {
        loopCount++;
        if (loopCount > maxLoops) {
          logAndStore("Exceeded maximum interaction loops.");
          break;
        }

        await this.storeScreenshot(page, jobId, `step-${loopCount}`);
        logAndStore(`[Step ${loopCount}] Stored screenshot. Thinking...`);

        completion = await this.openai.chat.completions.create({
          model: "gpt-4o",
          messages: removeHtmlsFromMessages(messages),
          tools,
        });

        const newMessage = completion.choices[0].message;
        messages.push(newMessage);
        await this.db.updateJob(jobId, messages, logs.join('\n'), new Date().toISOString());

        if (!newMessage.tool_calls) break;

        for (const toolCall of newMessage.tool_calls) {
          const functionCall = toolCall.function;
          const parsedArg = JSON.parse(functionCall.arguments);
          logAndStore(`AI: ${parsedArg.reasoning} -> ${functionCall.name}(${parsedArg.selector || ''})`);
          try {
            switch (functionCall.name) {
              case "click": await page.click(parsedArg.selector); break;
              case "type": await page.type(parsedArg.selector, parsedArg.value); break;
              case "select": await page.select(parsedArg.selector, parsedArg.value); break;
            }
            await page.waitForTimeout(UI_UPDATE_WAIT_MS);
            logAndStore(`Action '${functionCall.name}' succeeded.`);
            messages.push({ role: "tool", content: await getCleanHtml(page), tool_call_id: toolCall.id });
          } catch (error: any) {
            logAndStore(`Action Error: ${error.message}`);
            messages.push({ role: "tool", content: `Error: ${error.message}\n${await getCleanHtml(page)}`, tool_call_id: toolCall.id });
          }
        }
      } while (completion.choices[0].message.tool_calls);

      const finalAnswer = completion.choices[0].message.content || "Task completed.";
      logAndStore(`Final Answer: ${finalAnswer}`);
      await this.storeScreenshot(page, jobId, 'final');
      await this.db.finalizeJob(jobId, finalAnswer, messages, logs.join('\n'), new Date().toISOString(), "success");
    } finally {
      await page.close();
      this.keptAliveInSeconds = 0; // Reset timer after job
    }
  }

  private async storeScreenshot(page: puppeteer.Page, jobId: number, suffix: string) {
    const screenshotData = await page.screenshot({ type: "jpeg", quality: SCREENSHOT_JPEG_QUALITY });
    const key = `${jobId}/${suffix}-${new Date().toISOString()}.jpeg`;
    await this.env.BROWSER_AGENT_BUCKET.put(key, screenshotData);
    return { key };
  }

  async alarm() {
    this.keptAliveInSeconds += 60; // We're checking every 60 seconds

    if (!this.browser) {
      return;
    }

    if (this.keptAliveInSeconds > BROWSER_IDLE_TIMEOUT_SECONDS) {
      console.log(`Browser DO: Closing browser due to inactivity after ${this.keptAliveInSeconds} seconds.`);
      if (this.browser.isConnected()) {
        await this.browser.close();
      }
      this.browser = null;
    } else {
      console.log(`Browser DO: Browser is idle for ${this.keptAliveInSeconds} seconds. Scheduling next check...`);
      await this.storage.setAlarm(Date.now() + 60 * 1000);
    }
  }
}

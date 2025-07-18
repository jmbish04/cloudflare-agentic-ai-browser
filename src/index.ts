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

const app = new Hono<{ Bindings: Env }>();

// Static asset routes
app.get("/static/css/base.css", (c) => {
  return new Response(BASE_CSS, {
    headers: { "Content-Type": "text/css" }
  });
});

app.get("/static/css/dashboard.css", (c) => {
  return new Response(DASHBOARD_CSS, {
    headers: { "Content-Type": "text/css" }
  });
});

app.get("/static/css/job-detail.css", (c) => {
  return new Response(JOB_DETAIL_CSS, {
    headers: { "Content-Type": "text/css" }
  });
});

app.get("/static/css/progress.css", (c) => {
  return new Response(PROGRESS_CSS, {
    headers: { "Content-Type": "text/css" }
  });
});

app.get("/static/js/dashboard.js", (c) => {
  return new Response(DASHBOARD_JS, {
    headers: { "Content-Type": "application/javascript" }
  });
});

app.get("/static/js/progress.js", (c) => {
  return new Response(PROGRESS_JS, {
    headers: { "Content-Type": "application/javascript" }
  });
});


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

  const htmlContent = renderTemplate(DASHBOARD_TEMPLATE, {
    JOBS_CONTENT: jobsContent
  });

  return c.html(htmlContent);
});

// Job detail page
app.get("/job/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  const db = new Database(c.env);
  const job = await db.getJob(id);

  if (!job) {
    return c.html("Job not found", 404);
  }

  const autoRefreshScript = job.status === 'running'
    ? '<script>setTimeout(() => { window.location.reload(); }, 5000);</script>'
    : '';

  const refreshButton = job.status === 'running'
    ? '<button onclick="window.location.reload()" class="refresh-btn">Refresh</button>'
    : '';

  const completionInfo = job.completedAt
    ? `<div class="info-group">
         <div class="info-label">Completed:</div>
         <div class="info-value">${job.completedAt}</div>
       </div>`
    : '';

  const outputInfo = job.output
    ? `<div class="info-group">
         <div class="info-label">Result:</div>
         <div class="output">${job.output}</div>
       </div>`
    : '';

  const logInfo = job.log
    ? `<div class="info-group">
         <div class="info-label">Execution Log:</div>
         <div class="logs">${job.log}</div>
       </div>`
    : '';

  const runningNotice = job.status === 'running'
    ? `<div style="margin-top: 20px; padding: 10px; background: #fff3cd; border-radius: 4px; color: #856404;">
         <strong>Job is running...</strong> This page will auto-refresh every 5 seconds.
       </div>`
    : '';

  const htmlContent = renderTemplate(JOB_DETAIL_TEMPLATE, {
    JOB_ID: job.id.toString(),
    JOB_STATUS: job.status,
    JOB_GOAL: job.goal,
    JOB_URL: job.startingUrl,
    JOB_CREATED: job.createdAt,
    AUTO_REFRESH_SCRIPT: autoRefreshScript,
    REFRESH_BUTTON: refreshButton,
    COMPLETION_INFO: completionInfo,
    OUTPUT_INFO: outputInfo,
    LOG_INFO: logInfo,
    RUNNING_NOTICE: runningNotice
  });

  return c.html(htmlContent);
});

// Progress page for new jobs
app.get("/progress", async (c) => {
    const htmlContent = renderTemplate(PROGRESS_TEMPLATE, {});
    return c.html(htmlContent);
});

// API routes
app.post("/api/jobs", async (c) => {
  const { success } = await c.env.RATE_LIMITER.limit({ key: c.req.header("CF-Connecting-IP") ?? "local" });
  if (!success) {
    return c.json({ error: "Rate limit exceeded" }, 429);
  }

  const data: { baseUrl?: string; goal?: string } = await c.req.json();
  const baseUrl = data.baseUrl;
  const goal = data.goal;

  if (!baseUrl || !goal) {
    return c.json({ error: "Base URL and Goal are required" }, 400);
  }
  
  const db = new Database(c.env);
  const job = await db.insertJob(goal, baseUrl);
  
  // Start job execution asynchronously by calling the Durable Object
  const id = c.env.BROWSER.idFromName("browser-v1");
  const obj = c.env.BROWSER.get(id);
  
  // We don't await this fetch call. This is "fire and forget".
  // The DO will process the job in the background.
  c.executionCtx.waitUntil(obj.fetch(new Request(c.req.url, {
    method: 'POST',
    body: JSON.stringify({ jobId: job.id, baseUrl, goal }),
    headers: { 'Content-Type': 'application/json' }
  })));
  
  return c.json({ 
    jobId: job.id,
    status: 'pending',
    createdAt: job.createdAt
  });
});

app.get("/api/jobs", async (c) => {
  const db = new Database(c.env);
  const jobs = await db.getAllJobs();
  return c.json(jobs);
});

app.get("/api/jobs/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  const db = new Database(c.env);
  const job = await db.getJob(id);
  
  if (!job) {
    return c.json({ error: "Job not found" }, 404);
  }
  
  return c.json(job);
});

// Legacy POST route for backwards compatibility with the original demo
app.post("/", async (c) => {
  const { success } = await c.env.RATE_LIMITER.limit({ key: c.req.header("CF-Connecting-IP") ?? "local" });
  if (!success) {
    return new Response(`429 Failure – rate limit exceeded`, { status: 429 });
  }

  const id = c.env.BROWSER.idFromName("browser-v1");
  const obj = c.env.BROWSER.get(id);

  // This route streams the response directly, used for simpler clients.
  return obj.fetch(c.req.raw);
});


export class Browser {
  private browser: puppeteer.Browser | null = null;
  private keptAliveInSeconds: number;
  private env: Env;
  private state: DurableObjectState;
  private storage: DurableObjectStorage;
  private openai: OpenAI;
  private db: Database;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.keptAliveInSeconds = 0;
    this.storage = this.state.storage;
    this.openai = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      baseURL: `https://gateway.ai.cloudflare.com/v1/${env.ACCOUNT_ID}/agentic-browser-ai-gateway/openai`,
    });
    this.db = new Database(env);
  }

  async fetch(request: Request) {
    const data: { baseUrl?: string; goal?: string; jobId?: number } = await request.json().catch(() => ({}));

    // New async job execution path
    if (data.jobId && data.baseUrl && data.goal) {
      // Execute the job in the background. waitUntil ensures it runs to completion.
      this.state.waitUntil(this.executeJob(data.jobId, data.baseUrl, data.goal));
      return new Response("Job execution started in background.", { status: 202 });
    }

    // Legacy streaming path
    return new Response("Invalid request. Please use the API endpoints.", { status: 400 });
  }

  private async executeJob(jobId: number, baseUrl: string, goal: string) {
    try {
      await this.db.updateJobStatus(jobId, "running");

      const logs: string[] = [];
      const startingTs: number = +new Date();
      const log = (msg: string) => {
        const elapsed = +new Date() - startingTs;
        const fullMsg = `[${elapsed}ms]: ${msg}`;
        logs.push(fullMsg);
        console.log(`Job ${jobId}: ${fullMsg}`);
      };

      // Folder for R2 screenshots
      const folder = `${new Date().toISOString().split('T')[0]}/${jobId}`;

      if (!this.browser || !this.browser.isConnected()) {
        log(`Starting new browser instance for job ${jobId}`);
        this.browser = await puppeteer.launch(this.env.MYBROWSER);
      }

      this.keptAliveInSeconds = 0;
      this.ensureAlarm();

      const page = await this.browser.newPage();
      const width = 1920;
      const height = 1080;
      await page.setViewport({ width, height });
      page.setDefaultNavigationTimeout(20000); // Increased timeout
      page.setDefaultTimeout(15000); // Increased timeout
      
      log(`Navigating to ${baseUrl}`);
      await page.goto(baseUrl, { waitUntil: 'networkidle2' });

      const initialHtml = await getCleanHtml(page);
      log(`Page loaded. HTML size: ${initialHtml.length} chars.`);

      const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Goal: ${goal}\n${initialHtml}` }
      ];

      let completion: ChatCompletion;
      let loopCount = 0;
      const maxLoops = 15; // Safety break to prevent infinite loops

      do {
        loopCount++;
        if(loopCount > maxLoops) {
            log("Exceeded maximum interaction loops. Concluding job.");
            break;
        }

        const messagesSanitized = removeHtmlsFromMessages(messages);
        
        await this.storeScreenshot(page, folder, `step_${loopCount}`);
        log(`Stored screenshot. Thinking about next step... (Loop ${loopCount})`);

        completion = await this.openai.chat.completions.create({
          model: "gpt-4o",
          messages: messagesSanitized,
          tools,
          tool_choice: "auto",
        });

        const newMessage = completion.choices[0].message;
        messages.push(newMessage);
        
        await this.db.updateJob(jobId, messages, logs, new Date().toISOString());

        if (!newMessage.tool_calls) {
            log("Model decided to finish.");
            break;
        }

        // To prevent parallel tool calls, we process them sequentially.
        const toolCalls = newMessage.tool_calls;
        for (const toolCall of toolCalls) {
          const functionCall = toolCall.function;
          const arg = functionCall?.arguments;
          const parsedArg = JSON.parse(arg!);

          log(`AI: ${parsedArg.reasoning} -> ${functionCall?.name}(${parsedArg.selector || ''})`);

          try {
            switch (functionCall?.name) {
              case "click":
                await page.click(parsedArg.selector);
                break;
              case "type":
                await page.type(parsedArg.selector, parsedArg.value);
                break;
              case "select":
                await page.select(parsedArg.selector, parsedArg.value);
                break;
            }
            await page.waitForTimeout(1000); // Wait a moment for UI to update
            log(`Action '${functionCall?.name}' on '${parsedArg.selector}' succeeded.`);
            
            messages.push({
              role: "tool",
              content: await getCleanHtml(page),
              tool_call_id: toolCall.id,
            });

          } catch (error: any) {
            log(`Action Error: ${error.message}`);
            messages.push({
              role: "tool",
              content: `Error performing action: ${error.message}\nOn page:\n${await getCleanHtml(page)}`,
              tool_call_id: toolCall.id,
            });
          }
        }
      } while (completion?.choices[0].message.tool_calls);

      const finalAnswer = completion?.choices[0].message.content || "No final answer provided by model.";
      log(`Final Answer: ${finalAnswer}`);
      
      await this.storeScreenshot(page, folder, 'final');
      await this.db.finalizeJob(jobId, finalAnswer, messages, logs, new Date().toISOString());
      
      await page.close();

    } catch (error: any) {
      console.error(`Job ${jobId} failed catastrophically:`, error);
      await this.db.updateJobStatus(jobId, "failed");
    } finally {
        this.keptAliveInSeconds = 0; // Reset keep-alive counter
    }
  }

  private async storeScreenshot(page: puppeteer.Page, folder: string, name: string) {
    const fileName = `${name}_${new Date().toISOString()}.jpeg`;
    const fullPath = `${folder}/${fileName}`;
    const sc = await page.screenshot({ type: "jpeg", quality: 70 });
    return this.env.BUCKET.put(fullPath, sc);
  }

  async ensureAlarm() {
      if (await this.storage.getAlarm() === null) {
          console.log("Browser DO: setting initial alarm.");
          const TEN_SECONDS = 10 * 1000;
          await this.storage.setAlarm(Date.now() + TEN_SECONDS);
      }
  }

  async alarm() {
    this.keptAliveInSeconds += 10;
    const KEEP_BROWSER_ALIVE_IN_SECONDS = 180;

    if (this.browser?.isConnected() && this.keptAliveInSeconds < KEEP_BROWSER_ALIVE_IN_SECONDS) {
        console.log(`Browser DO: has been kept alive for ${this.keptAliveInSeconds} seconds. Extending lifespan.`);
        await this.storage.setAlarm(Date.now() + 10 * 1000);
    } else {
        console.log(`Browser DO: alarm expired or browser disconnected. Exceeded life of ${KEEP_BROWSER_ALIVE_IN_SECONDS}s.`);
        if (this.browser) {
            console.log("Closing browser due to inactivity.");
            await this.browser.close();
            this.browser = null;
        }
    }
  }
}

export default {
    fetch: app.fetch,
} satisfies ExportedHandler<Env>;
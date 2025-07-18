import puppeteer from "@cloudflare/puppeteer";
import OpenAI from "openai";
import { ChatCompletion, ChatCompletionMessageParam } from "openai/resources";
import { tools } from "./tools";
import { systemPrompt } from "./prompts";
import { getCleanHtml, removeHtmlsFromMessages } from "./utils";
import { Database } from "./db";
import { Hono } from "hono";
import { html } from "hono/html";
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
  const urlParams = new URL(c.req.url).searchParams;
  const jobId = urlParams.get('jobId');
  
  if (!jobId) {
    return c.html(`
      <p>No job ID provided. <a href="/">Return to dashboard</a></p>
    `, 400);
  }
  
  const htmlContent = renderTemplate(PROGRESS_TEMPLATE, {
    JOB_ID: jobId
  });
  
  return c.html(htmlContent);
});

// API routes
app.post("/api/jobs", async (c) => {
  const { success } = await c.env.RATE_LIMITER.limit({ key: "/" });
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
  
  // Start job execution asynchronously
  const id = c.env.BROWSER.idFromName("browser");
  const obj = c.env.BROWSER.get(id);
  
  // Don't await this - let it run in the background
  obj.fetch(new Request(c.req.url, {
    method: 'POST',
    body: JSON.stringify({ jobId: job.id, baseUrl, goal }),
    headers: { 'Content-Type': 'application/json' }
  }));
  
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

// Legacy POST route for backwards compatibility
app.post("/", async (c) => {
  const { success } = await c.env.RATE_LIMITER.limit({ key: "/" });
  if (!success) {
    return new Response(`429 Failure – rate limit exceeded`, { status: 429 });
  }

  const id = c.env.BROWSER.idFromName("browser");
  const obj = c.env.BROWSER.get(id);

  const response = await obj.fetch(c.req.raw);
  const { readable, writable } = new TransformStream();
  response.body?.pipeTo(writable);

  return new Response(readable, response);
});

const handler = {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;

const width = 1920;
const height = 1080;
const KEEP_BROWSER_ALIVE_IN_SECONDS = 180;

export class Browser {
  private browser: puppeteer.Browser;
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
    const data: { baseUrl?: string; goal?: string; jobId?: number } = await request.json().catch((e) => {
      console.error("Failed to parse request JSON:", e);
      return {};
    });
    
    // Check if this is a new API request with jobId
    if (data.jobId && data.baseUrl && data.goal) {
      // This is an async job execution request
      this.state.waitUntil(this.executeJob(data.jobId, data.baseUrl, data.goal));
      return new Response("Job execution started in background.", { status: 202 });
    }

    // Legacy streaming response format for backward compatibility
    if (data.baseUrl && data.goal) {
      return this.handleLegacyStreamingRequest(data.baseUrl, data.goal);
    }

    // Invalid request
    return new Response("Invalid request. Please provide baseUrl and goal.", { status: 400 });
  }

  async handleLegacyStreamingRequest(baseUrl: string, goal: string) {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const textEncoder = new TextEncoder();
    const logs: string[] = [];
    const startingTs: number = +new Date();

    const log = (msg: string) => {
      const elapsed = +new Date() - startingTs;
      const fullMsg = `[${elapsed}ms]: ${msg}`;
      logs.push(fullMsg);
      console.log(fullMsg);
      writer.write(textEncoder.encode(`${fullMsg}\n`));
    };

    const { id } = await this.db.insertJob(goal, baseUrl);

    // use the current date and time to create a folder structure for R2
    const nowDate = new Date();
    const coeff = 1000 * 60 * 5;
    const roundedDate = new Date(Math.round(nowDate.getTime() / coeff) * coeff).toString();
    const folder =
      roundedDate.split(" GMT")[0] + "_" + baseUrl.replace("https://", "").replace("http://", "");

    // Start the job execution in the background
    this.state.waitUntil(
      (async () => {
        try {
          // If there's a browser session open, re-use it
          if (!this.browser || !this.browser.isConnected()) {
            log(`Starting new browser instance`);
            try {
              this.browser = await puppeteer.launch(this.env.MYBROWSER);
            } catch (e) {
              log(`Could not start browser instance. Error: ${e}`);
              await this.db.updateJobStatus(id, "failed");
              writer.close();
              return;
            }
          }

          await this.db.updateJobStatus(id, "running");

          // Reset keptAlive after each call to the DO
          this.keptAliveInSeconds = 0;

          const page = await this.browser.newPage();
          await page.setViewport({ width, height });
          page.setDefaultNavigationTimeout(10000);
          page.setDefaultTimeout(10000);
          await page.goto(baseUrl);

          const initialHtml = await getCleanHtml(page);

          log(`Page ${baseUrl} loaded. HTML chars: ${initialHtml.length}`);

          const messages: ChatCompletionMessageParam[] = [];
          messages.push({
            role: "system",
            content: systemPrompt,
          });
          messages.push({
            role: "user",
            content: `Goal: ${goal}\n${initialHtml}`,
          });

          let completion: ChatCompletion;

          do {
            const messagesSanitized = removeHtmlsFromMessages(messages);

            const r2Obj = await this.storeScreenshot(page, folder);
            log(`Stored screenshot at ${r2Obj.key}. Thinking about next step...`);

            completion = await this.openai.chat.completions.create({
              model: "gpt-4o",
              messages: messagesSanitized,
              tools,
            });
            const newMessage = completion.choices[0].message;

            // Take just one. Hack to prevent parallel function calling
            if (newMessage.tool_calls && newMessage.tool_calls?.length > 0) {
              newMessage.tool_calls = [newMessage.tool_calls[0]];
            }

            messages.push(newMessage);

            await this.db.updateJob(id, messages, logs, new Date().toISOString());

            const toolCalls = completion.choices[0].message.tool_calls || [];

            for (const toolCall of toolCalls) {
              const functionCall = toolCall.function;
              const arg = functionCall?.arguments;
              const parsedArg = JSON.parse(arg!);

              log(`AI: ${parsedArg.reasoning} (${functionCall?.name} on ${parsedArg.selector})`);

              try {
                switch (functionCall?.name) {
                  case "click":
                    await page.click(parsedArg.selector, {});
                    break;
                  case "type":
                    await page.type(parsedArg.selector, parsedArg.value);
                    break;
                  case "select":
                    await page.select(parsedArg.selector, parsedArg.value);
                    break;
                }

                log(`Action ${functionCall?.name} on ${parsedArg.selector} succeeded`);

                messages.push({
                  role: "tool",
                  content: await getCleanHtml(page),
                  tool_call_id: toolCall.id,
                });
              } catch (error) {
                log(`AI Error: ${error.message}`);
                messages.push({
                  role: "tool",
                  content: `Error: ${error.message}\n${await getCleanHtml(page)}`,
                  tool_call_id: toolCall.id,
                });
              }
            }
          } while (!completion || completion?.choices[0].message.tool_calls?.[0]);

          const finalAnswer = completion?.choices[0].message.content;
          log(`Final Answer: ${finalAnswer}`);

          await this.db.finalizeJob(id, finalAnswer, messages, logs, new Date().toISOString());

          // Close tab when there is no more work to be done on the page
          await page.close();

          // Reset keptAlive after performing tasks to the DO.
          this.keptAliveInSeconds = 0;

          // set the first alarm to keep DO alive
          let currentAlarm = await this.storage.getAlarm();
          if (currentAlarm == null) {
            console.log(`Browser DO: setting alarm`);
            const TEN_SECONDS = 10 * 1000;
            await this.storage.setAlarm(Date.now() + TEN_SECONDS);
          }

          writer.close();
        } catch (error) {
          log(`Error: ${error.message}`);
          await this.db.updateJobStatus(id, "failed");
          writer.close();
        }
      })()
    );

    return new Response(readable);
  }

  private async executeJob(jobId: number, baseUrl: string, goal: string) {
    try {
      await this.db.updateJobStatus(jobId, "running");

      // use the current date and time to create a folder structure for R2
      const nowDate = new Date();
      const coeff = 1000 * 60 * 5;
      const roundedDate = new Date(Math.round(nowDate.getTime() / coeff) * coeff).toString();
      const folder =
        roundedDate.split(" GMT")[0] + "_" + baseUrl.replace("https://", "").replace("http://", "");

      // If there's a browser session open, re-use it
      if (!this.browser || !this.browser.isConnected()) {
        console.log(`Starting new browser instance for job ${jobId}`);
        try {
          this.browser = await puppeteer.launch(this.env.MYBROWSER);
        } catch (e) {
          console.log(`Could not start browser instance. Error: ${e}`);
          await this.db.updateJobStatus(jobId, "failed");
          return;
        }
      }

      // Reset keptAlive after each call to the DO
      this.keptAliveInSeconds = 0;

      const page = await this.browser.newPage();
      await page.setViewport({ width, height });
      page.setDefaultNavigationTimeout(10000);
      page.setDefaultTimeout(10000);
      await page.goto(baseUrl);

      const initialHtml = await getCleanHtml(page);
      console.log(`Page ${baseUrl} loaded for job ${jobId}. HTML chars: ${initialHtml.length}`);

      const messages: ChatCompletionMessageParam[] = [];
      messages.push({
        role: "system",
        content: systemPrompt,
      });
      messages.push({
        role: "user",
        content: `Goal: ${goal}\n${initialHtml}`,
      });

      const logs: string[] = [];
      const startingTs: number = +new Date();

      const log = (msg: string) => {
        const elapsed = +new Date() - startingTs;
        const fullMsg = `[${elapsed}ms]: ${msg}`;
        logs.push(fullMsg);
        console.log(`Job ${jobId}: ${fullMsg}`);
      };

      let completion: ChatCompletion;

      do {
        const messagesSanitized = removeHtmlsFromMessages(messages);

        const r2Obj = await this.storeScreenshot(page, folder);
        log(`Stored screenshot at ${r2Obj.key}. Thinking about next step...`);

        completion = await this.openai.chat.completions.create({
          model: "gpt-4o",
          messages: messagesSanitized,
          tools,
        });
        const newMessage = completion.choices[0].message;

        // Take just one. Hack to prevent parallel function calling
        if (newMessage.tool_calls && newMessage.tool_calls?.length > 0) {
          newMessage.tool_calls = [newMessage.tool_calls[0]];
        }

        messages.push(newMessage);

        // Update job with current progress
        await this.db.updateJob(jobId, messages, logs, new Date().toISOString());

        const toolCalls = completion.choices[0].message.tool_calls || [];

        for (const toolCall of toolCalls) {
          const functionCall = toolCall.function;
          const arg = functionCall?.arguments;
          const parsedArg = JSON.parse(arg!);

          log(`AI: ${parsedArg.reasoning} (${functionCall?.name} on ${parsedArg.selector})`);

          try {
            switch (functionCall?.name) {
              case "click":
                await page.click(parsedArg.selector, {});
                break;
              case "type":
                await page.type(parsedArg.selector, parsedArg.value);
                break;
              case "select":
                await page.select(parsedArg.selector, parsedArg.value);
                break;
            }

            log(`Action ${functionCall?.name} on ${parsedArg.selector} succeeded`);

            messages.push({
              role: "tool",
              content: await getCleanHtml(page),
              tool_call_id: toolCall.id,
            });
          } catch (error) {
            log(`AI Error: ${error.message}`);
            messages.push({
              role: "tool",
              content: `Error: ${error.message}\n${await getCleanHtml(page)}`,
              tool_call_id: toolCall.id,
            });
          }
        }
      } while (!completion || completion?.choices[0].message.tool_calls?.[0]);

      const finalAnswer = completion?.choices[0].message.content;
      log(`Final Answer: ${finalAnswer}`);

      await this.db.finalizeJob(jobId, finalAnswer, messages, logs, new Date().toISOString());

      // Close tab when there is no more work to be done on the page
      await page.close();

      // Reset keptAlive after performing tasks to the DO.
      this.keptAliveInSeconds = 0;

      // set the first alarm to keep DO alive
      let currentAlarm = await this.storage.getAlarm();
      if (currentAlarm == null) {
        console.log(`Browser DO: setting alarm`);
        const TEN_SECONDS = 10 * 1000;
        await this.storage.setAlarm(Date.now() + TEN_SECONDS);
      }
    } catch (error) {
      console.error(`Job ${jobId} failed:`, error);
      await this.db.updateJobStatus(jobId, "failed");
    }
  }

  private async storeScreenshot(page: puppeteer.Page, folder: string) {
    const fileName = "screenshot_" + new Date().toISOString();

    const sc = await page.screenshot({ path: fileName + ".jpg" });
    return this.env.BUCKET.put(folder + "/" + fileName + ".jpg", sc);
  }

  async alarm() {
    this.keptAliveInSeconds += 10;

    // Extend browser DO life
    if (this.keptAliveInSeconds < KEEP_BROWSER_ALIVE_IN_SECONDS) {
      console.log(
        `Browser DO: has been kept alive for ${this.keptAliveInSeconds} seconds. Extending lifespan.`
      );
      await this.storage.setAlarm(Date.now() + 10 * 1000);
      // You could ensure the ws connection is kept alive by requesting something
      // or just let it close automatically when there  is no work to be done
      // for example, `await this.browser.version()`
    } else {
      console.log(`Browser DO: exceeded life of ${KEEP_BROWSER_ALIVE_IN_SECONDS}s.`);
      if (this.browser) {
        console.log(`Closing browser.`);
        await this.browser.close();
      }
    }
  }
}

export default handler;

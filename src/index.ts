import puppeteer from "@cloudflare/puppeteer";
import OpenAI from "openai";
import { ChatCompletion, ChatCompletionMessageParam } from "openai/resources";
import { tools } from "./tools";
import { systemPrompt } from "./prompts";
import { getCleanHtml, removeHtmlsFromMessages } from "./utils";
import { Database } from "./db";
import { Hono } from "hono";
import { dashboardTemplate } from "./templates/dashboard";
import { jobDetailTemplate } from "./templates/job-detail";
import { parseIntSafe, validateJobRequest } from "./utils/validation";
import { 
  BROWSER_WIDTH, 
  BROWSER_HEIGHT, 
  KEEP_BROWSER_ALIVE_IN_SECONDS, 
  ALARM_INTERVAL_SECONDS 
} from "./constants";

const app = new Hono<{ Bindings: Env }>();

// Frontend routes
app.get("/", async (c) => {
  const db = new Database(c.env);
  const jobs = await db.getAllJobs();
  return c.html(dashboardTemplate(jobs));
});

// Job detail page
app.get("/job/:id", async (c) => {
  const idParam = c.req.param("id");
  const id = parseIntSafe(idParam);
  
  if (id === null) {
    return c.html("Invalid job ID", 400);
  }
  
  const db = new Database(c.env);
  const job = await db.getJob(id);
  
  if (!job) {
    return c.html("Job not found", 404);
  }
  
  return c.html(jobDetailTemplate(job));
});

// API routes

// Get all jobs
app.get("/api/jobs", async (c) => {
  const db = new Database(c.env);
  const jobs = await db.getAllJobs();
  return c.json(jobs);
});

// Get specific job
app.get("/api/jobs/:id", async (c) => {
  const idParam = c.req.param("id");
  const id = parseIntSafe(idParam);
  
  if (id === null) {
    return c.json({ error: "Invalid job ID" }, 400);
  }
  
  const db = new Database(c.env);
  const job = await db.getJob(id);
  
  if (!job) {
    return c.json({ error: "Job not found" }, 404);
  }
  
  return c.json(job);
});

// Create new job (frontend API)
app.post("/api/jobs", async (c) => {
  try {
    const data = await c.req.json();
    const validation = validateJobRequest(data);
    
    if (!validation.isValid) {
      return c.json({ error: validation.error }, 400);
    }

    const { baseUrl, goal } = data;
    
    // Create job in database first
    const db = new Database(c.env);
    const job = await db.insertJob(goal, baseUrl);
    
    // Start browser automation asynchronously
    c.executionCtx.waitUntil(
      processBrowserJob(c.env, job.id, baseUrl, goal)
    );
    
    // Return the jobId immediately to prevent race condition
    return c.json({ 
      success: true, 
      jobId: job.id,
      message: "Job created and started"
    });
  } catch (error) {
    console.error("Error creating job:", error);
    return c.json({ error: "Failed to create job" }, 500);
  }
});

// Legacy API endpoint for backwards compatibility
app.post("/", async (c) => {
  const id = c.env.BROWSER.idFromName("browser");
  const obj = c.env.BROWSER.get(id);

  const { success } = await c.env.RATE_LIMITER.limit({ key: "/" });
  if (!success) {
    return new Response(`429 Failure – rate limit exceeded`, { status: 429 });
  }

  const response = await obj.fetch(c.req.raw);
  const { readable, writable } = new TransformStream();
  response.body?.pipeTo(writable);

  return new Response(readable, response);
});

// Handle other methods
app.all("*", (c) => {
  if (c.req.method !== "GET" && c.req.method !== "POST") {
    return c.text("Method not allowed", 405);
  }
  return c.text("Not found", 404);
});

// Separate function to process browser job asynchronously
async function processBrowserJob(env: Env, jobId: number, baseUrl: string, goal: string) {
  const id = env.BROWSER.idFromName("browser");
  const obj = env.BROWSER.get(id);
  
  try {
    // Create a request for the browser automation
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ baseUrl, goal, jobId }),
      headers: { "Content-Type": "application/json" }
    });
    
    await obj.fetch(request);
  } catch (error) {
    console.error(`Error processing job ${jobId}:`, error);
    // Update job status to failed
    const db = new Database(env);
    await db.updateJob(jobId, [], [`Error: ${error.message}`], new Date().toISOString());
  }
}

const handler = {
  async fetch(request, env): Promise<Response> {
    return app.fetch(request, env);
  },
} satisfies ExportedHandler<Env>;

const width = BROWSER_WIDTH;
const height = BROWSER_HEIGHT;
const KEEP_BROWSER_ALIVE_IN_SECONDS_CONSTANT = KEEP_BROWSER_ALIVE_IN_SECONDS;

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

    const data: { baseUrl?: string; goal?: string; jobId?: number } = await request.json();
    const baseUrl = data.baseUrl ?? "https://bubble.io";
    const goal = data.goal ?? "Extract pricing model for this company";
    
    // Use provided jobId or create new job (backwards compatibility)
    let jobId = data.jobId;
    if (!jobId) {
      const job = await this.db.insertJob(goal, baseUrl);
      jobId = job.id;
    }

    // use the current date and time to create a folder structure for R2
    const nowDate = new Date();
    const coeff = 1000 * 60 * 5;
    const roundedDate = new Date(Math.round(nowDate.getTime() / coeff) * coeff).toString();
    const folder =
      roundedDate.split(" GMT")[0] + "_" + baseUrl.replace("https://", "").replace("http://", "");

    // If there's a browser session open, re-use it
    if (!this.browser || !this.browser.isConnected()) {
      log(`Starting new browser instance`);
      try {
        this.browser = await puppeteer.launch(this.env.MYBROWSER);
      } catch (e) {
        log(`Could not start browser instance. Error: ${e}`);
      }
    }

    // Reset keptAlive after each call to the DO
    this.keptAliveInSeconds = 0;
    this.state.waitUntil(
      (async () => {
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

          await this.db.updateJob(jobId!, messages, logs, new Date().toISOString());

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

              // await page.waitForNavigation();

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

        await this.db.finalizeJob(jobId!, finalAnswer, messages, logs, new Date().toISOString());

        // Close tab when there is no more work to be done on the page
        await page.close();

        // Reset keptAlive after performing tasks to the DO.
        this.keptAliveInSeconds = 0;

        // set the first alarm to keep DO alive
        let currentAlarm = await this.storage.getAlarm();
        if (currentAlarm == null) {
          console.log(`Browser DO: setting alarm`);
          const TEN_SECONDS = ALARM_INTERVAL_SECONDS * 1000;
          await this.storage.setAlarm(Date.now() + TEN_SECONDS);
        }

        writer.close();
      })()
    );

    return new Response(readable);
  }

  private async storeScreenshot(page: puppeteer.Page, folder: string) {
    const fileName = "screenshot_" + new Date().toISOString();

    const sc = await page.screenshot({ path: fileName + ".jpg" });
    return this.env.BUCKET.put(folder + "/" + fileName + ".jpg", sc);
  }

  async alarm() {
    this.keptAliveInSeconds += ALARM_INTERVAL_SECONDS;

    // Extend browser DO life
    if (this.keptAliveInSeconds < KEEP_BROWSER_ALIVE_IN_SECONDS_CONSTANT) {
      console.log(
        `Browser DO: has been kept alive for ${this.keptAliveInSeconds} seconds. Extending lifespan.`
      );
      await this.storage.setAlarm(Date.now() + ALARM_INTERVAL_SECONDS * 1000);
      // You could ensure the ws connection is kept alive by requesting something
      // or just let it close automatically when there  is no work to be done
      // for example, `await this.browser.version()`
    } else {
      console.log(`Browser DO: exceeded life of ${KEEP_BROWSER_ALIVE_IN_SECONDS_CONSTANT}s.`);
      if (this.browser) {
        console.log(`Closing browser.`);
        await this.browser.close();
      }
    }
  }
}

export default handler;

import puppeteer from "@cloudflare/puppeteer";
import OpenAI from "openai";
import { ChatCompletion, ChatCompletionMessageParam } from "openai/resources";
import { tools } from "./tools";
import { systemPrompt } from "./prompts";
import { getCleanHtml, removeHtmlsFromMessages } from "./utils";
import { Database } from "./db";

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
    const data: { baseUrl?: string; goal?: string; jobId?: number } = await request.json();
    
    // Check if this is a new API request with jobId
    if (data.jobId) {
      // This is a job-based request
      await this.processJobRequest(data.jobId);
      return new Response(JSON.stringify({ status: "started" }), {
        headers: { "Content-Type": "application/json" },
      });
    } else if (data.baseUrl && data.goal) {
      // This is a direct browser request
      const result = await this.browse(data.baseUrl, data.goal);
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    }
    
    return new Response("Invalid request", { status: 400 });
  }

  async processJobRequest(jobId: number) {
    try {
      const job = await this.db.getJob(jobId);
      if (!job) {
        console.log(`Job ${jobId} not found`);
        return;
      }

      if (job.status !== 'pending') {
        console.log(`Job ${jobId} is not pending (status: ${job.status})`);
        return;
      }

      // Update job status to in-progress
      await this.db.updateJobStatus(jobId, 'in-progress');
      
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

      console.log(`Processing job ${jobId}: ${job.goal} on ${job.startingUrl}`);
      
      // Process the job
      const result = await this.browseForJob(job.startingUrl, job.goal, jobId);
      
      // Update job with result
      await this.db.updateJobResult(jobId, result.content, result.messages);
      await this.db.updateJobStatus(jobId, 'completed');
      
      console.log(`Job ${jobId} completed successfully`);
    } catch (error) {
      console.error(`Error processing job ${jobId}:`, error);
      await this.db.updateJobStatus(jobId, 'failed');
    }
  }

  async browse(baseUrl: string, goal: string): Promise<any> {
    const log = (message: string) => {
      console.log(`[Browser] ${message}`);
    };

    const nowDate = new Date();
    const coeff = 1000 * 60 * 5; // 5 minutes
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

    // Set up the alarm so we can keep the browser alive
    const currentAlarm = await this.storage.getAlarm();
    if (currentAlarm == null) {
      log(`Setting alarm`);
      const TEN_SECONDS = 10 * 1000;
      await this.storage.setAlarm(Date.now() + TEN_SECONDS);
    }

    const page = await this.browser.newPage();
    await page.setViewport({ width, height });

    let iterationCount = 0;
    const maxIterations = 10;
    const messages: ChatCompletionMessageParam[] = [];

    messages.push({
      role: "system",
      content: systemPrompt,
    });

    messages.push({
      role: "user",
      content: `Please go to ${baseUrl} and ${goal}`,
    });

    log(`Navigating to ${baseUrl}`);
    await page.goto(baseUrl);

    log(`Getting page content`);
    const content = await page.content();
    const cleanContent = getCleanHtml(content);

    messages.push({
      role: "user",
      content: `The page content is: ${cleanContent}`,
    });

    while (iterationCount < maxIterations) {
      iterationCount++;
      log(`Iteration ${iterationCount}`);

      const currentUrl = page.url();
      if (currentUrl !== baseUrl) {
        log(`Page navigated to: ${currentUrl}`);
      }

      const messagesForAI = removeHtmlsFromMessages(messages);
      const response: ChatCompletion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messagesForAI,
        tools: tools,
        tool_choice: "auto",
        max_tokens: 4000,
      });

      const message = response.choices[0].message;
      messages.push(message);

      log(`Response: ${message.content}`);

      if (message.tool_calls) {
        for (const toolCall of message.tool_calls) {
          let toolResult: any;
          if (toolCall.function.name === "click") {
            const { selector } = JSON.parse(toolCall.function.arguments);
            log(`Clicking on element: ${selector}`);
            try {
              await page.click(selector);
              await page.waitForTimeout(2000);
              toolResult = `Successfully clicked on element: ${selector}`;
            } catch (error) {
              toolResult = `Failed to click on element: ${selector}. Error: ${error}`;
            }
          } else if (toolCall.function.name === "type") {
            const { selector, text } = JSON.parse(toolCall.function.arguments);
            log(`Typing text: "${text}" into element: ${selector}`);
            try {
              await page.focus(selector);
              await page.keyboard.type(text);
              await page.waitForTimeout(1000);
              toolResult = `Successfully typed text: "${text}" into element: ${selector}`;
            } catch (error) {
              toolResult = `Failed to type text into element: ${selector}. Error: ${error}`;
            }
          } else if (toolCall.function.name === "navigate") {
            const { url } = JSON.parse(toolCall.function.arguments);
            log(`Navigating to: ${url}`);
            try {
              await page.goto(url);
              await page.waitForTimeout(3000);
              toolResult = `Successfully navigated to: ${url}`;
            } catch (error) {
              toolResult = `Failed to navigate to: ${url}. Error: ${error}`;
            }
          } else if (toolCall.function.name === "wait") {
            const { seconds } = JSON.parse(toolCall.function.arguments);
            log(`Waiting for ${seconds} seconds`);
            await page.waitForTimeout(seconds * 1000);
            toolResult = `Successfully waited for ${seconds} seconds`;
          } else if (toolCall.function.name === "scroll") {
            const { direction } = JSON.parse(toolCall.function.arguments);
            log(`Scrolling ${direction}`);
            try {
              if (direction === "down") {
                await page.evaluate("window.scrollBy(0, 500)");
              } else if (direction === "up") {
                await page.evaluate("window.scrollBy(0, -500)");
              }
              await page.waitForTimeout(1000);
              toolResult = `Successfully scrolled ${direction}`;
            } catch (error) {
              toolResult = `Failed to scroll ${direction}. Error: ${error}`;
            }
          } else if (toolCall.function.name === "getPageContent") {
            log(`Getting page content`);
            try {
              const pageContent = await page.content();
              const cleanPageContent = getCleanHtml(pageContent);
              toolResult = `Page content: ${cleanPageContent}`;
            } catch (error) {
              toolResult = `Failed to get page content. Error: ${error}`;
            }
          } else if (toolCall.function.name === "screenshot") {
            log(`Taking screenshot`);
            try {
              const screenshot = await page.screenshot();
              // For now, we'll just indicate that a screenshot was taken
              toolResult = `Screenshot taken successfully`;
            } catch (error) {
              toolResult = `Failed to take screenshot. Error: ${error}`;
            }
          } else if (toolCall.function.name === "evaluate") {
            const { code } = JSON.parse(toolCall.function.arguments);
            log(`Evaluating JavaScript: ${code}`);
            try {
              const result = await page.evaluate(code);
              toolResult = `JavaScript evaluation result: ${JSON.stringify(result)}`;
            } catch (error) {
              toolResult = `Failed to evaluate JavaScript. Error: ${error}`;
            }
          } else if (toolCall.function.name === "finish") {
            const { result } = JSON.parse(toolCall.function.arguments);
            log(`Task completed: ${result}`);
            await page.close();
            return {
              content: result,
              messages: messages,
            };
          }

          messages.push({
            role: "tool",
            content: toolResult,
            tool_call_id: toolCall.id,
          });
        }
      } else {
        // If no tool calls, the AI might think the task is complete
        log(`No tool calls made. Task might be complete.`);
        await page.close();
        return {
          content: message.content || "Task completed without explicit finish call",
          messages: messages,
        };
      }
    }

    log(`Maximum iterations reached. Closing page.`);
    await page.close();
    return {
      content: "Maximum iterations reached. Task may be incomplete.",
      messages: messages,
    };
  }

  async browseForJob(baseUrl: string, goal: string, jobId: number): Promise<any> {
    const log = (message: string) => {
      console.log(`[Browser Job ${jobId}] ${message}`);
    };

    const nowDate = new Date();
    const coeff = 1000 * 60 * 5; // 5 minutes
    const roundedDate = new Date(Math.round(nowDate.getTime() / coeff) * coeff).toString();
    const folder =
      roundedDate.split(" GMT")[0] + "_" + baseUrl.replace("https://", "").replace("http://", "");

    // Reset keptAlive after each call to the DO
    this.keptAliveInSeconds = 0;

    // Set up the alarm so we can keep the browser alive
    const currentAlarm = await this.storage.getAlarm();
    if (currentAlarm == null) {
      log(`Setting alarm`);
      const TEN_SECONDS = 10 * 1000;
      await this.storage.setAlarm(Date.now() + TEN_SECONDS);
    }

    const page = await this.browser.newPage();
    await page.setViewport({ width, height });

    let iterationCount = 0;
    const maxIterations = 10;
    const messages: ChatCompletionMessageParam[] = [];

    messages.push({
      role: "system",
      content: systemPrompt,
    });

    messages.push({
      role: "user",
      content: `Please go to ${baseUrl} and ${goal}`,
    });

    log(`Navigating to ${baseUrl}`);
    await page.goto(baseUrl);

    log(`Getting page content`);
    const content = await page.content();
    const cleanContent = getCleanHtml(content);

    messages.push({
      role: "user",
      content: `The page content is: ${cleanContent}`,
    });

    while (iterationCount < maxIterations) {
      iterationCount++;
      log(`Iteration ${iterationCount}`);

      const currentUrl = page.url();
      if (currentUrl !== baseUrl) {
        log(`Page navigated to: ${currentUrl}`);
      }

      const messagesForAI = removeHtmlsFromMessages(messages);
      const response: ChatCompletion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messagesForAI,
        tools: tools,
        tool_choice: "auto",
        max_tokens: 4000,
      });

      const message = response.choices[0].message;
      messages.push(message);

      log(`Response: ${message.content}`);

      if (message.tool_calls) {
        for (const toolCall of message.tool_calls) {
          let toolResult: any;
          if (toolCall.function.name === "click") {
            const { selector } = JSON.parse(toolCall.function.arguments);
            log(`Clicking on element: ${selector}`);
            try {
              await page.click(selector);
              await page.waitForTimeout(2000);
              toolResult = `Successfully clicked on element: ${selector}`;
            } catch (error) {
              toolResult = `Failed to click on element: ${selector}. Error: ${error}`;
            }
          } else if (toolCall.function.name === "type") {
            const { selector, text } = JSON.parse(toolCall.function.arguments);
            log(`Typing text: "${text}" into element: ${selector}`);
            try {
              await page.focus(selector);
              await page.keyboard.type(text);
              await page.waitForTimeout(1000);
              toolResult = `Successfully typed text: "${text}" into element: ${selector}`;
            } catch (error) {
              toolResult = `Failed to type text into element: ${selector}. Error: ${error}`;
            }
          } else if (toolCall.function.name === "navigate") {
            const { url } = JSON.parse(toolCall.function.arguments);
            log(`Navigating to: ${url}`);
            try {
              await page.goto(url);
              await page.waitForTimeout(3000);
              toolResult = `Successfully navigated to: ${url}`;
            } catch (error) {
              toolResult = `Failed to navigate to: ${url}. Error: ${error}`;
            }
          } else if (toolCall.function.name === "wait") {
            const { seconds } = JSON.parse(toolCall.function.arguments);
            log(`Waiting for ${seconds} seconds`);
            await page.waitForTimeout(seconds * 1000);
            toolResult = `Successfully waited for ${seconds} seconds`;
          } else if (toolCall.function.name === "scroll") {
            const { direction } = JSON.parse(toolCall.function.arguments);
            log(`Scrolling ${direction}`);
            try {
              if (direction === "down") {
                await page.evaluate("window.scrollBy(0, 500)");
              } else if (direction === "up") {
                await page.evaluate("window.scrollBy(0, -500)");
              }
              await page.waitForTimeout(1000);
              toolResult = `Successfully scrolled ${direction}`;
            } catch (error) {
              toolResult = `Failed to scroll ${direction}. Error: ${error}`;
            }
          } else if (toolCall.function.name === "getPageContent") {
            log(`Getting page content`);
            try {
              const pageContent = await page.content();
              const cleanPageContent = getCleanHtml(pageContent);
              toolResult = `Page content: ${cleanPageContent}`;
            } catch (error) {
              toolResult = `Failed to get page content. Error: ${error}`;
            }
          } else if (toolCall.function.name === "screenshot") {
            log(`Taking screenshot`);
            try {
              const screenshot = await page.screenshot();
              // For now, we'll just indicate that a screenshot was taken
              toolResult = `Screenshot taken successfully`;
            } catch (error) {
              toolResult = `Failed to take screenshot. Error: ${error}`;
            }
          } else if (toolCall.function.name === "evaluate") {
            const { code } = JSON.parse(toolCall.function.arguments);
            log(`Evaluating JavaScript: ${code}`);
            try {
              const result = await page.evaluate(code);
              toolResult = `JavaScript evaluation result: ${JSON.stringify(result)}`;
            } catch (error) {
              toolResult = `Failed to evaluate JavaScript. Error: ${error}`;
            }
          } else if (toolCall.function.name === "finish") {
            const { result } = JSON.parse(toolCall.function.arguments);
            log(`Task completed: ${result}`);
            await page.close();
            return {
              content: result,
              messages: messages,
            };
          }

          messages.push({
            role: "tool",
            content: toolResult,
            tool_call_id: toolCall.id,
          });
        }
      } else {
        // If no tool calls, the AI might think the task is complete
        log(`No tool calls made. Task might be complete.`);
        await page.close();
        return {
          content: message.content || "Task completed without explicit finish call",
          messages: messages,
        };
      }
    }

    log(`Maximum iterations reached. Closing page.`);
    await page.close();
    return {
      content: "Maximum iterations reached. Task may be incomplete.",
      messages: messages,
    };
  }

  async alarm() {
    this.keptAliveInSeconds += 10;

    if (this.keptAliveInSeconds < KEEP_BROWSER_ALIVE_IN_SECONDS) {
      console.log(`[Browser] Keeping browser alive for ${this.keptAliveInSeconds} seconds`);
      const TEN_SECONDS = 10 * 1000;
      await this.storage.setAlarm(Date.now() + TEN_SECONDS);
    } else {
      console.log(`[Browser] Browser kept alive for ${this.keptAliveInSeconds} seconds. Closing browser.`);
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}
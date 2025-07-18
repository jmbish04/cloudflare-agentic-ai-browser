import puppeteer from "@cloudflare/puppeteer";
import OpenAI from "openai";
import { ChatCompletion, ChatCompletionMessageParam } from "openai/resources";
import { tools } from "./tools";
import { systemPrompt } from "./prompts";
import { getCleanHtml, removeHtmlsFromMessages } from "./utils";
import { Database } from "./db";
import { Hono } from "hono";
import { html } from "hono/html";


const app = new Hono<{ Bindings: Env }>();


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
  

  return c.html(html`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AI Browser Agent Dashboard</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
          }
          .header {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          .form-container {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          .form-group {
            margin-bottom: 15px;
          }
          label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
          }
          input, textarea {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
          }
          textarea {
            resize: vertical;
            min-height: 80px;
          }
          button {
            background: #007acc;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          }
          button:hover {
            background: #005fa3;
          }
          .jobs-container {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          .job {
            border: 1px solid #eee;
            border-radius: 4px;
            padding: 15px;
            margin-bottom: 10px;
            cursor: pointer;
          }
          .job:hover {
            background: #fafafa;
          }
          .job-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
          }
          .job-id {
            font-weight: bold;
            color: #333;
          }
          .job-status {
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
          }
          .status-running {
            background: #fff3cd;
            color: #856404;
          }
          .status-success {
            background: #d4edda;
            color: #155724;
          }
          .status-pending {
            background: #cce5ff;
            color: #004085;
          }
          .job-goal {
            margin-bottom: 5px;
            color: #555;
          }
          .job-url {
            font-size: 12px;
            color: #888;
          }
          .job-time {
            font-size: 12px;
            color: #888;
          }
          .refresh-btn {
            margin-bottom: 20px;
          }
          .jobs-list-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🤖 AI Browser Agent Dashboard</h1>
          <p>Create browser automation requests and monitor their progress</p>
        </div>

        <div class="form-container">
          <h2>Create New Request</h2>
          <form id="newJobForm" onsubmit="submitJob(event)">
            <div class="form-group">
              <label for="baseUrl">Base URL:</label>
              <input type="url" id="baseUrl" name="baseUrl" required placeholder="https://example.com" />
            </div>
            <div class="form-group">
              <label for="goal">Goal:</label>
              <textarea id="goal" name="goal" required placeholder="Extract pricing information from this website"></textarea>
            </div>
            <button type="submit">Start Browser Agent</button>
          </form>
        </div>

        <div class="jobs-container">
          <div class="jobs-list-header">
            <h2>Job History</h2>
            <button onclick="window.location.reload()" class="refresh-btn">Refresh</button>
          </div>
          
          ${jobs.length === 0 ? 
            html`<p>No jobs yet. Create your first browser automation request above!</p>` :
            jobs.map(job => html`
              <div class="job" onclick="viewJob(${job.id})">
                <div class="job-header">
                  <span class="job-id">Job #${job.id}</span>
                  <span class="job-status status-${job.status}">${job.status}</span>
                </div>
                <div class="job-goal"><strong>Goal:</strong> ${job.goal}</div>
                <div class="job-url"><strong>URL:</strong> ${job.startingUrl}</div>
                <div class="job-time"><strong>Created:</strong> ${job.createdAt}</div>
              </div>
            `)
          }
        </div>

        <script>
          async function submitJob(event) {
            event.preventDefault();
            
            const formData = new FormData(event.target);
            const baseUrl = formData.get('baseUrl');
            const goal = formData.get('goal');
            
            const button = event.target.querySelector('button');
            button.disabled = true;
            button.textContent = 'Starting...';
            
            try {
              // Submit the job
              const response = await fetch('/api/jobs', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ baseUrl, goal })
              });
              
              if (response.ok) {
                const jobData = await response.json();
                // Open progress page with the specific job ID
                window.open('/progress?jobId=' + jobData.jobId, '_blank');
                
                // Reset form and refresh page
                event.target.reset();
                setTimeout(() => window.location.reload(), 2000);
              } else {
                alert('Failed to create job');
              }
            } catch (error) {
              alert('Error: ' + error.message);
            } finally {
              button.disabled = false;
              button.textContent = 'Start Browser Agent';
            }
          }
          
          function viewJob(id) {
            window.open('/job/' + id, '_blank');
          }
        </script>
      </body>
    </html>
  `);

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
  

  return c.html(html`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Job #${job.id} - AI Browser Agent</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
          }
          .container {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          .job-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 20px;
            border-bottom: 1px solid #eee;
          }
          .job-status {
            padding: 6px 12px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 500;
          }
          .status-running {
            background: #fff3cd;
            color: #856404;
          }
          .status-success {
            background: #d4edda;
            color: #155724;
          }
          .status-pending {
            background: #cce5ff;
            color: #004085;
          }
          .info-group {
            margin-bottom: 20px;
          }
          .info-label {
            font-weight: 500;
            color: #333;
            margin-bottom: 5px;
          }
          .info-value {
            color: #666;
            word-break: break-all;
          }
          .logs {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 12px;
            white-space: pre-wrap;
            max-height: 400px;
            overflow-y: auto;
            border: 1px solid #e9ecef;
          }
          .output {
            background: #e8f5e8;
            padding: 15px;
            border-radius: 4px;
            border: 1px solid #c3e6c3;
          }
          .back-link {
            color: #007acc;
            text-decoration: none;
            margin-bottom: 20px;
            display: inline-block;
          }
          .back-link:hover {
            text-decoration: underline;
          }
          .refresh-btn {
            background: #28a745;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
          }
          .refresh-btn:hover {
            background: #218838;
          }
        </style>
        <script>
          // Auto-refresh for running jobs
          ${job.status === 'running' ? `
            setTimeout(() => {
              window.location.reload();
            }, 5000);
          ` : ''}
        </script>
      </head>
      <body>
        <a href="/" class="back-link">← Back to Dashboard</a>

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
  const { success } = await c.env.RATE_LIMITER.limit({ key: "/" });
  if (!success) {
    return c.json({ error: "Rate limit exceeded" }, 429);
  }


//   const id = c.env.BROWSER.idFromName("browser");
//   const obj = c.env.BROWSER.get(id);
  
//   // Start the browser job and get the streaming response
//   const response = await obj.fetch(c.req.raw);
  
//   // For the frontend, we need to return job info immediately
//   // The actual job creation happens in the Browser class
//   // We'll modify this to extract job ID when available
  
//   return new Response(response.body, {
//     headers: {
//       "Content-Type": "text/plain",
//       "Transfer-Encoding": "chunked"

// const handler = {
//   async fetch(request, env): Promise<Response> {
//     const { success } = await env.RATE_LIMITER.limit({ key: "/" });
//     if (!success) {
//       return new Response(`429 Failure – rate limit exceeded`, { status: 429 });

//     }
//   });
// });

app.get("/api/jobs", async (c) => {
  const db = new Database(c.env);
  const jobs = await db.getAllJobs();
  return c.json(jobs);
});

app.get("/api/jobs/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
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

    const url = new URL(request.url);
    const path = url.pathname;

    // Handle API routes
    if (path.startsWith('/api/jobs')) {
      const db = new Database(env);
      
      if (request.method === 'POST' && path === '/api/jobs') {
        // Create new job
        const data: { baseUrl?: string; goal?: string } = await request.json();
        const baseUrl = data.baseUrl ?? "https://bubble.io";
        const goal = data.goal ?? "Extract pricing model for this company";
        
        const job = await db.insertJob(goal, baseUrl);
        
        // Start job execution asynchronously
        const id = env.BROWSER.idFromName("browser");
        const obj = env.BROWSER.get(id);
        
        // Don't await this - let it run in the background
        obj.fetch(new Request(request.url, {
          method: 'POST',
          body: JSON.stringify({ jobId: job.id, baseUrl, goal }),
          headers: { 'Content-Type': 'application/json' }
        }));
        
        return new Response(JSON.stringify({ 
          jobId: job.id,
          status: 'pending',
          createdAt: job.createdAt
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (request.method === 'GET' && path.match(/^\/api\/jobs\/\d+$/)) {
        // Get job status
        const jobId = parseInt(path.split('/')[3]);
        const job = await db.getJob(jobId);

        
        <div class="container">
          <div class="job-header">
            <h1>Job #${job.id}</h1>
            <div>
              <span class="job-status status-${job.status}">${job.status}</span>
              ${job.status === 'running' ? html`<button onclick="window.location.reload()" class="refresh-btn">Refresh</button>` : ''}
            </div>
          </div>
          
          <div class="info-group">
            <div class="info-label">Goal:</div>
            <div class="info-value">${job.goal}</div>
          </div>
          
          <div class="info-group">
            <div class="info-label">Starting URL:</div>
            <div class="info-value"><a href="${job.startingUrl}" target="_blank">${job.startingUrl}</a></div>
          </div>
          
          <div class="info-group">
            <div class="info-label">Created:</div>
            <div class="info-value">${job.createdAt}</div>
          </div>
          
          ${job.completedAt ? html`
            <div class="info-group">
              <div class="info-label">Completed:</div>
              <div class="info-value">${job.completedAt}</div>
            </div>
          ` : ''}
          
          ${job.output ? html`
            <div class="info-group">
              <div class="info-label">Result:</div>
              <div class="output">${job.output}</div>
            </div>
          ` : ''}
          
          ${job.log ? html`
            <div class="info-group">
              <div class="info-label">Execution Log:</div>
              <div class="logs">${job.log}</div>
            </div>
          ` : ''}
          
          ${job.status === 'running' ? html`
            <div style="margin-top: 20px; padding: 10px; background: #fff3cd; border-radius: 4px; color: #856404;">
              <strong>Job is running...</strong> This page will auto-refresh every 5 seconds.
            </div>
          ` : ''}
        </div>
      </body>
    </html>
  `);
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
  
  return c.html(html`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Job Progress - AI Browser Agent</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
          }
          .container {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            text-align: center;
          }
          .spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #007acc;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 2s linear infinite;
            margin: 20px auto;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .status {
            color: #666;
            margin: 10px 0;
          }
          .back-link {
            color: #007acc;
            text-decoration: none;
            margin-bottom: 20px;
            display: inline-block;
          }
          .back-link:hover {
            text-decoration: underline;
          }
        </style>
        <script>
          const POLLING_INTERVAL_MS = 5000;
          const MAX_CHECKS = 60; // ~5 minutes timeout
          const JOB_ID = ${jobId};
          let checkCount = 0;
          
          async function checkJobStatus() {
            try {
              const response = await fetch('/api/jobs/' + JOB_ID);
              
              if (response.ok) {
                const job = await response.json();
                
                // If job is running or completed, redirect to job page
                if (job.status === 'running' || job.status === 'completed' || job.status === 'failed') {
                  window.location.href = '/job/' + JOB_ID;
                  return;
                }
                
                // Job is still pending, continue polling
                checkCount++;
                if (checkCount < MAX_CHECKS) {
                  setTimeout(checkJobStatus, POLLING_INTERVAL_MS);
                } else {
                  document.getElementById('status').textContent = 'Job creation timed out. Please check the dashboard.';
                  setTimeout(() => {
                    window.location.href = '/';
                  }, 3000);
                }
              } else {
                // Job not found, redirect to job page which will show "not found"
                window.location.href = '/job/' + JOB_ID;
              }
            } catch (error) {
              console.error('Error checking for job:', error);
              checkCount++;
              if (checkCount < MAX_CHECKS) {
                setTimeout(checkJobStatus, POLLING_INTERVAL_MS);
              } else {
                document.getElementById('status').textContent = 'An error occurred while checking for the job. Please check the dashboard.';
                setTimeout(() => {
                  window.location.href = '/';
                }, 3000);
              }
            }
          }
          
          // Start checking after a short delay
          setTimeout(checkJobStatus, 2000);
        </script>
      </head>
      <body>
        <a href="/" class="back-link">← Back to Dashboard</a>
        
        <div class="container">
          <h1>🚀 Starting Browser Agent</h1>
          <div class="spinner"></div>
          <div id="status" class="status">Creating job and initializing browser...</div>
          <p>This page will automatically redirect to the job progress once it's ready.</p>
        </div>
      </body>
    </html>
  `);
});

// API routes
app.post("/api/jobs", async (c) => {
  const { success } = await c.env.RATE_LIMITER.limit({ key: "/" });
  if (!success) {
    return c.json({ error: "Rate limit exceeded" }, 429);
  }

  const data: { baseUrl?: string; goal?: string } = await c.req.json();
  const baseUrl = data.baseUrl ?? "https://bubble.io";
  const goal = data.goal ?? "Extract pricing model for this company";
  
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

      return new Response(readable, response);
    }
    
    return new Response("Please use POST request or API endpoints", { status: 400 });
  },


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
    const data: { baseUrl?: string; goal?: string; jobId?: number } = await request.json();
    
    // Check if this is a new API request with jobId
    if (data.jobId) {
      // This is an async job execution request
      await this.executeJob(data.jobId, data.baseUrl!, data.goal!);
      return new Response("Job execution started", { status: 200 });
    }

    // Legacy streaming response format
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

    const baseUrl = data.baseUrl ?? "https://bubble.io";
    const goal = data.goal ?? "Extract pricing model for this company";

    const { id } = await this.db.insertJob(goal, baseUrl);

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

          // await this.db.updateJob(id, messages, logs, new Date().toISOString());

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

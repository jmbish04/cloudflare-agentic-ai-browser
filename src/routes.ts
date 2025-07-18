import { Hono } from "hono";
import { html } from "hono/html";
import { Database } from "./db";
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

// Dashboard route
app.get("/", async (c) => {
  const db = new Database(c.env);
  
  try {
    const jobs = await db.getJobs();
    
    const jobRows = jobs.map(job => {
      const statusClass = job.status === 'completed' ? 'status-completed' : 
                         job.status === 'failed' ? 'status-failed' : 
                         job.status === 'in-progress' ? 'status-in-progress' : 
                         'status-pending';
      
      const createdAt = new Date(job.createdAt).toLocaleString();
      const completedAt = job.completedAt ? new Date(job.completedAt).toLocaleString() : '-';
      
      return `
        <tr>
          <td><a href="/job/${job.id}" class="job-link">#${job.id}</a></td>
          <td class="goal-cell">${job.goal}</td>
          <td><span class="status ${statusClass}">${job.status}</span></td>
          <td class="url-cell">
            ${job.startingUrl ? `<a href="${job.startingUrl}" target="_blank" class="url-link">${job.startingUrl}</a>` : '-'}
          </td>
          <td class="date-cell">${createdAt}</td>
          <td class="date-cell">${completedAt}</td>
        </tr>
      `;
    }).join('');
    
    const content = renderTemplate(DASHBOARD_TEMPLATE, {
      jobRows: jobRows || '<tr><td colspan="6" class="no-jobs">No jobs found</td></tr>',
      totalJobs: jobs.length.toString(),
      completedJobs: jobs.filter(j => j.status === 'completed').length.toString(),
      failedJobs: jobs.filter(j => j.status === 'failed').length.toString(),
      inProgressJobs: jobs.filter(j => j.status === 'in-progress').length.toString()
    });
    
    return c.html(content);
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return c.html(`
      <html>
        <head>
          <title>Error - Cloudflare Agentic AI Browser</title>
          <link rel="stylesheet" href="/static/css/base.css">
        </head>
        <body>
          <div class="container">
            <h1>Error</h1>
            <p>Failed to load jobs: ${error}</p>
            <a href="/" class="btn btn-primary">Retry</a>
          </div>
        </body>
      </html>
    `);
  }
});

// Job detail route
app.get("/job/:id", async (c) => {
  const jobId = parseInt(c.req.param("id"));
  const db = new Database(c.env);
  
  try {
    const job = await db.getJob(jobId);
    
    if (!job) {
      return c.html(`
        <html>
          <head>
            <title>Job Not Found - Cloudflare Agentic AI Browser</title>
            <link rel="stylesheet" href="/static/css/base.css">
          </head>
          <body>
            <div class="container">
              <h1>Job Not Found</h1>
              <p>Job with ID ${jobId} was not found.</p>
              <a href="/" class="btn btn-primary">Back to Dashboard</a>
            </div>
          </body>
        </html>
      `);
    }
    
    const statusClass = job.status === 'completed' ? 'status-completed' : 
                       job.status === 'failed' ? 'status-failed' : 
                       job.status === 'in-progress' ? 'status-in-progress' : 
                       'status-pending';
    
    const createdAt = new Date(job.createdAt).toLocaleString();
    const completedAt = job.completedAt ? new Date(job.completedAt).toLocaleString() : '-';
    
    // Format messages for display
    const messagesHtml = job.messages ? JSON.parse(job.messages).map((msg: any, index: number) => {
      const role = msg.role || 'unknown';
      const content = msg.content || '';
      const timestamp = new Date().toLocaleString(); // You might want to add actual timestamps
      
      return `
        <div class="message message-${role}">
          <div class="message-header">
            <span class="message-role">${role}</span>
            <span class="message-timestamp">${timestamp}</span>
          </div>
          <div class="message-content">
            ${typeof content === 'string' ? content : JSON.stringify(content)}
          </div>
        </div>
      `;
    }).join('') : '<div class="no-messages">No messages available</div>';
    
    const content = renderTemplate(JOB_DETAIL_TEMPLATE, {
      jobId: job.id.toString(),
      goal: job.goal,
      status: job.status,
      statusClass: statusClass,
      baseUrl: job.startingUrl || 'N/A',
      createdAt: createdAt,
      completedAt: completedAt,
      result: job.output || 'No result available',
      messages: messagesHtml
    });
    
    return c.html(content);
  } catch (error) {
    console.error('Error fetching job:', error);
    return c.html(`
      <html>
        <head>
          <title>Error - Cloudflare Agentic AI Browser</title>
          <link rel="stylesheet" href="/static/css/base.css">
        </head>
        <body>
          <div class="container">
            <h1>Error</h1>
            <p>Failed to load job: ${error}</p>
            <a href="/" class="btn btn-primary">Back to Dashboard</a>
          </div>
        </body>
      </html>
    `);
  }
});

// Progress route
app.get("/progress", async (c) => {
  const db = new Database(c.env);
  
  try {
    const inProgressJobs = await db.getJobsByStatus('in-progress');
    
    const jobsData = inProgressJobs.map(job => {
      const createdAt = new Date(job.createdAt).toLocaleString();
      const messages = job.messages ? JSON.parse(job.messages) : [];
      const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
      
      return {
        id: job.id,
        goal: job.goal,
        baseUrl: job.startingUrl || '',
        createdAt: createdAt,
        lastUpdate: lastMessage ? (lastMessage.content || 'Processing...') : 'Starting...',
        progress: Math.min(90, messages.length * 10) // Rough progress estimation
      };
    });
    
    const jobCards = jobsData.map(job => `
      <div class="job-card" data-job-id="${job.id}">
        <div class="job-header">
          <h3><a href="/job/${job.id}">#${job.id}</a></h3>
          <span class="job-progress">${job.progress}%</span>
        </div>
        <div class="job-details">
          <div class="job-goal">${job.goal}</div>
          <div class="job-url">${job.baseUrl}</div>
          <div class="job-status">${job.lastUpdate}</div>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${job.progress}%"></div>
        </div>
        <div class="job-time">Started: ${job.createdAt}</div>
      </div>
    `).join('');
    
    const content = renderTemplate(PROGRESS_TEMPLATE, {
      jobCards: jobCards || '<div class="no-jobs">No jobs in progress</div>',
      totalInProgress: jobsData.length.toString()
    });
    
    return c.html(content);
  } catch (error) {
    console.error('Error fetching progress:', error);
    return c.html(`
      <html>
        <head>
          <title>Error - Cloudflare Agentic AI Browser</title>
          <link rel="stylesheet" href="/static/css/base.css">
        </head>
        <body>
          <div class="container">
            <h1>Error</h1>
            <p>Failed to load progress: ${error}</p>
            <a href="/" class="btn btn-primary">Back to Dashboard</a>
          </div>
        </body>
      </html>
    `);
  }
});

// API route for creating jobs
app.post("/api/jobs", async (c) => {
  try {
    const body = await c.req.json();
    const { goal, baseUrl } = body;
    
    if (!goal || !baseUrl) {
      return c.json({ error: "Goal and baseUrl are required" }, 400);
    }
    
    const db = new Database(c.env);
    const jobId = await db.createJob(goal, baseUrl);
    
    // Start the job asynchronously
    const id = c.env.BROWSER.idFromName("browser");
    const obj = c.env.BROWSER.get(id);
    
    // Fire and forget - start the job
    obj.fetch(new Request("http://localhost/start-job", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, goal, baseUrl })
    }));
    
    return c.json({ jobId, status: "created" });
  } catch (error) {
    console.error('Error creating job:', error);
    return c.json({ error: "Failed to create job" }, 500);
  }
});

// API route for browser automation
app.post("/api/browse", async (c) => {
  const body = await c.req.json();
  const { baseUrl, goal } = body;
  
  if (!baseUrl || !goal) {
    return c.json({ error: "baseUrl and goal are required" }, 400);
  }

  const id = c.env.BROWSER.idFromName("browser");
  const obj = c.env.BROWSER.get(id);

  const response = await obj.fetch(c.req.raw);
  const { readable, writable } = new TransformStream();
  response.body?.pipeTo(writable);

  return new Response(readable, response);
});

export { app };
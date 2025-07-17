import { html } from "hono/html";
import { commonStyles } from "../styles/common";
import { POLLING_INTERVAL_MS } from "../constants";

interface Job {
  id: number;
  goal: string;
  startingUrl: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  output?: string;
  log?: string;
}

export function jobDetailTemplate(job: Job) {
  return html`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Job #${job.id} - AI Browser Agent</title>
        <style>${commonStyles}</style>
        <script>
          // Auto-refresh for running jobs
          ${job.status === 'running' ? `
            setTimeout(() => {
              window.location.reload();
            }, ${POLLING_INTERVAL_MS});
          ` : ''}
        </script>
      </head>
      <body>
        <a href="/" class="back-link">← Back to Dashboard</a>
        
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
            <div class="info-group">
              <div class="info-value"><strong>Job is running...</strong> This page will auto-refresh every ${POLLING_INTERVAL_MS / 1000} seconds.</div>
            </div>
          ` : ''}
        </div>
      </body>
    </html>
  `;
}
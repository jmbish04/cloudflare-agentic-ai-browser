// Template and static asset utilities for Cloudflare Workers

/**
 * Dashboard page template
 */
export const DASHBOARD_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Browser Agent Dashboard</title>
    <link rel="stylesheet" href="/static/css/base.css">
    <link rel="stylesheet" href="/static/css/dashboard.css">
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
      
      {{JOBS_CONTENT}}
    </div>

    <script src="/static/js/dashboard.js"></script>
  </body>
</html>`;

/**
 * Job detail page template
 */
export const JOB_DETAIL_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Job #{{JOB_ID}} - AI Browser Agent</title>
    <link rel="stylesheet" href="/static/css/base.css">
    <link rel="stylesheet" href="/static/css/job-detail.css">
    {{AUTO_REFRESH_SCRIPT}}
  </head>
  <body>
    <a href="/" class="back-link">← Back to Dashboard</a>
    
    <div class="container">
      <div class="job-header">
        <h1>Job #{{JOB_ID}}</h1>
        <div>
          <span class="job-status status-{{JOB_STATUS}}">{{JOB_STATUS}}</span>
          {{REFRESH_BUTTON}}
        </div>
      </div>
      
      <div class="info-group">
        <div class="info-label">Goal:</div>
        <div class="info-value">{{JOB_GOAL}}</div>
      </div>
      
      <div class="info-group">
        <div class="info-label">Starting URL:</div>
        <div class="info-value"><a href="{{JOB_URL}}" target="_blank">{{JOB_URL}}</a></div>
      </div>
      
      <div class="info-group">
        <div class="info-label">Created:</div>
        <div class="info-value">{{JOB_CREATED}}</div>
      </div>
      
      {{COMPLETION_INFO}}
      
      {{OUTPUT_INFO}}
      
      {{ERROR_INFO}}
      
      {{LOG_INFO}}
      
      {{RUNNING_NOTICE}}
      
      {{FAILED_NOTICE}}
    </div>
  </body>
</html>`;

/**
 * Progress page template
 */
export const PROGRESS_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Job Progress - AI Browser Agent</title>
    <link rel="stylesheet" href="/static/css/base.css">
    <link rel="stylesheet" href="/static/css/progress.css">
  </head>
  <body>
    <a href="/" class="back-link">← Back to Dashboard</a>
    
    <div class="container">
      <h1>🚀 Starting Browser Agent</h1>
      <div class="spinner"></div>
      <div id="status" class="status">Creating job and initializing browser...</div>
      <p>This page will automatically redirect to the job progress once it's ready.</p>
    </div>

    <script src="/static/js/progress.js"></script>
  </body>
</html>`;

/**
 * Simple template renderer that replaces {{PLACEHOLDER}} with values
 */
export function renderTemplate(template: string, data: Record<string, string>): string {
  let result = template;
  
  for (const [key, value] of Object.entries(data)) {
    const placeholder = `{{${key}}}`;
    result = result.replace(new RegExp(placeholder, 'g'), value || '');
  }
  
  return result;
}
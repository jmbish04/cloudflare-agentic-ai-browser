import { html } from "hono/html";
import { commonStyles } from "../styles/common";
import { FORM_REFRESH_DELAY_MS } from "../constants";

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

export function dashboardTemplate(jobs: Job[]) {
  return html`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AI Browser Agent Dashboard</title>
        <style>${commonStyles}</style>
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
            
            // Basic client-side validation
            if (!baseUrl || !goal) {
              alert('Please fill in all required fields');
              return;
            }
            
            // Validate URL format
            try {
              new URL(baseUrl);
            } catch (e) {
              alert('Please enter a valid URL');
              return;
            }
            
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
                const result = await response.json();
                // Redirect to specific job page using returned jobId
                if (result.jobId) {
                  window.open('/job/' + result.jobId, '_blank');
                }
                // Reset form and refresh page
                event.target.reset();
                setTimeout(() => window.location.reload(), ${FORM_REFRESH_DELAY_MS});
              } else {
                const errorText = await response.text();
                alert('Failed to create job: ' + errorText);
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
  `;
}
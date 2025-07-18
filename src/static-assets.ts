// Static CSS and JavaScript assets embedded as strings

/**
 * Base CSS styles shared across all pages
 */
export const BASE_CSS = `/* Base styles shared across all pages */
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

.back-link {
  color: #007acc;
  text-decoration: none;
  margin-bottom: 20px;
  display: inline-block;
}

.back-link:hover {
  text-decoration: underline;
}

/* Status indicators */
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

/* Common button styles */
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
}`;

/**
 * Dashboard page specific CSS
 */
export const DASHBOARD_CSS = `/* Dashboard specific styles */
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

.jobs-container {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.jobs-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
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
}`;

/**
 * Job detail page specific CSS
 */
export const JOB_DETAIL_CSS = `/* Job detail page specific styles */
.job-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid #eee;
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
}`;

/**
 * Progress page specific CSS
 */
export const PROGRESS_CSS = `/* Progress page specific styles */
body {
  max-width: 800px;
}

.container {
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
}`;

/**
 * Dashboard JavaScript functionality
 */
export const DASHBOARD_JS = `// Dashboard functionality
async function submitJob(event) {
  event.preventDefault();
  
  const formData = new FormData(event.target);
  const baseUrl = formData.get('baseUrl');
  const goal = formData.get('goal');
  
  const button = event.target.querySelector('button');
  button.disabled = true;
  button.textContent = 'Starting...';
  
  try {
    // Submit the job first to get the specific jobId
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
}`;

/**
 * Progress page JavaScript functionality
 */
export const PROGRESS_JS = `// Progress page functionality
const POLLING_INTERVAL_MS = 5000;
const JOB_CREATION_LOOKBEHIND_MS = 120000; // 2 minutes
const MAX_CHECKS = 60; // ~5 minutes timeout

// Get jobId from URL parameters
const urlParams = new URLSearchParams(window.location.search);
const jobId = urlParams.get('jobId');

if (!jobId) {
  document.getElementById('status').textContent = 'No job ID provided. Redirecting to dashboard...';
  setTimeout(() => {
    window.location.href = '/';
  }, 3000);
} else {
  let checkCount = 0;
  
  async function checkJobStatus() {
    try {
      const response = await fetch('/api/jobs/' + jobId);
      
      if (response.ok) {
        const job = await response.json();
        
        // If job is running or completed, redirect to job page
        if (job.status === 'running' || job.status === 'completed' || job.status === 'failed') {
          window.location.href = '/job/' + jobId;
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
        window.location.href = '/job/' + jobId;
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
}`;
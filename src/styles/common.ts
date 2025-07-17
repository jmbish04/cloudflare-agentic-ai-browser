export const commonStyles = `
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
  .status-failed {
    background: #f8d7da;
    color: #721c24;
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
  .container {
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
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
  .error {
    color: #dc3545;
    font-weight: 500;
  }
  .success {
    color: #28a745;
    font-weight: 500;
  }
`;
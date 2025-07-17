import { dashboardTemplate } from '../src/templates/dashboard';

// Mock job data
const mockJobs = [
  {
    id: 1,
    goal: 'Extract pricing information from the website',
    startingUrl: 'https://example.com',
    status: 'success',
    createdAt: '2025-01-17 20:30:00',
    completedAt: '2025-01-17 20:31:30',
    output: 'Found pricing: $29/month for Pro plan, $99/month for Enterprise plan',
    log: '[1000ms]: Starting browser instance\n[2000ms]: Page loaded\n[3000ms]: Final Answer: Pricing extracted successfully'
  },
  {
    id: 2,
    goal: 'Find contact information',
    startingUrl: 'https://contact.example.com',
    status: 'running',
    createdAt: '2025-01-17 20:32:00'
  },
  {
    id: 3,
    goal: 'Check product availability',
    startingUrl: 'https://shop.example.com',
    status: 'pending',
    createdAt: '2025-01-17 20:33:00'
  }
];

// Generate the HTML and write to file
const html = dashboardTemplate(mockJobs);

// Write to temporary file for testing
import { writeFileSync } from 'fs';
writeFileSync('/tmp/test-output/dashboard-test.html', html.toString());
console.log('Dashboard HTML generated at /tmp/test-output/dashboard-test.html');
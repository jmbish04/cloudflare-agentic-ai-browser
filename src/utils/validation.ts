/**
 * Safely parse an integer with proper radix and validation
 */
export function parseIntSafe(value: string): number | null {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize HTML content to prevent XSS
 */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Validate job creation request
 */
export function validateJobRequest(data: any): { isValid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { isValid: false, error: 'Invalid request data' };
  }

  const { baseUrl, goal } = data;

  if (!baseUrl || typeof baseUrl !== 'string') {
    return { isValid: false, error: 'Base URL is required and must be a string' };
  }

  if (!goal || typeof goal !== 'string') {
    return { isValid: false, error: 'Goal is required and must be a string' };
  }

  if (!isValidUrl(baseUrl)) {
    return { isValid: false, error: 'Invalid URL format' };
  }

  if (goal.length > 1000) {
    return { isValid: false, error: 'Goal description is too long (max 1000 characters)' };
  }

  return { isValid: true };
}
import { describe, it, expect } from 'vitest';
import { parseIntSafe, validateJobRequest, isValidUrl } from '../src/utils/validation';

describe('Input Validation', () => {
  describe('parseIntSafe', () => {
    it('should parse valid integers with radix 10', () => {
      expect(parseIntSafe('123')).toBe(123);
      expect(parseIntSafe('0')).toBe(0);
      expect(parseIntSafe('-456')).toBe(-456);
    });

    it('should return null for invalid inputs', () => {
      expect(parseIntSafe('abc')).toBe(null);
      expect(parseIntSafe('')).toBe(null);
      expect(parseIntSafe('12.34')).toBe(12); // parseInt truncates
    });

    it('should handle octal-looking strings correctly with radix 10', () => {
      expect(parseIntSafe('010')).toBe(10); // Not 8 (octal)
      expect(parseIntSafe('089')).toBe(89); // Valid with radix 10
    });
  });

  describe('isValidUrl', () => {
    it('should validate correct URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
      expect(isValidUrl('https://api.example.com/v1/endpoint')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('')).toBe(false);
      expect(isValidUrl('example.com')).toBe(false); // Missing protocol
    });
  });

  describe('validateJobRequest', () => {
    it('should validate correct job requests', () => {
      const validRequest = {
        baseUrl: 'https://example.com',
        goal: 'Extract pricing information'
      };
      const result = validateJobRequest(validRequest);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject requests with missing baseUrl', () => {
      const invalidRequest = {
        goal: 'Extract pricing information'
      };
      const result = validateJobRequest(invalidRequest);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Base URL is required');
    });

    it('should reject requests with missing goal', () => {
      const invalidRequest = {
        baseUrl: 'https://example.com'
      };
      const result = validateJobRequest(invalidRequest);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Goal is required');
    });

    it('should reject requests with invalid URL', () => {
      const invalidRequest = {
        baseUrl: 'not-a-url',
        goal: 'Extract pricing information'
      };
      const result = validateJobRequest(invalidRequest);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid URL format');
    });

    it('should reject requests with excessively long goal', () => {
      const invalidRequest = {
        baseUrl: 'https://example.com',
        goal: 'A'.repeat(1001) // Over 1000 characters
      };
      const result = validateJobRequest(invalidRequest);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Goal description is too long');
    });

    it('should reject null or non-object requests', () => {
      expect(validateJobRequest(null).isValid).toBe(false);
      expect(validateJobRequest('string').isValid).toBe(false);
      expect(validateJobRequest(123).isValid).toBe(false);
    });
  });
});
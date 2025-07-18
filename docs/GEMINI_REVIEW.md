# Gemini Code Review System

This repository includes an automated code review system powered by Google's Gemini AI model that provides intelligent feedback on pull requests.

## How It Works

1. **Automatic Trigger**: The system automatically runs when a pull request is opened or updated
2. **Code Analysis**: Extracts the diff of changed files using git commands
3. **AI Review**: Sends the code changes to Gemini AI for comprehensive review
4. **Feedback Delivery**: Posts the review feedback as comments and saves to artifacts

## Features

- **Comprehensive Analysis**: Reviews code quality, security, performance, and maintainability
- **Constructive Feedback**: Provides specific suggestions for improvement
- **Multiple Output Methods**: 
  - Console output for debugging
  - File artifacts for persistence
  - PR comments (when properly configured)

## Setup

### Required Secrets

Add these secrets to your GitHub repository:

1. `GEMINI_API_KEY`: Your Google AI API key for Gemini
   - Get one from [Google AI Studio](https://makersuite.google.com/app/apikey)

### Optional Configuration

- The system automatically uses `GITHUB_TOKEN` for PR commenting when available
- Artifacts are uploaded for 7 days retention

## Review Focus Areas

The Gemini reviewer examines:

- **Code Quality**: Best practices, patterns, and conventions
- **Security Issues**: Potential vulnerabilities and security concerns
- **Performance**: Efficiency and optimization opportunities
- **Readability**: Code clarity and maintainability
- **Bug Prevention**: Logic errors and edge cases

## Files

- `.github/workflows/gemini-review.yml`: GitHub Actions workflow
- `scripts/gemini_review.py`: Main review script
- `gemini_review_output.txt`: Generated review output (artifact)

## Error Handling

The system is designed to be robust:
- Continues on errors to not block PR workflows
- Provides detailed error messages in logs
- Falls back gracefully when API keys are missing
- Uploads artifacts even when API calls fail

## Customization

You can modify the review prompt in `scripts/gemini_review.py` to focus on specific aspects of your codebase or adjust the review style.
# Gemini Code Review Integration

This repository includes an automated code review system powered by Google's Gemini AI model.

## How it works

1. **Trigger**: The review runs automatically on every pull request (opened or updated)
2. **Analysis**: The system fetches the PR diff and sends it to Gemini for analysis
3. **Review**: Gemini provides comprehensive feedback on code quality, security, performance, and best practices
4. **Output**: Review results are uploaded as GitHub Actions artifacts

## Configuration

### Required Secrets

The following secrets must be configured in your GitHub repository:

- `GEMINI_API_KEY`: Your Google Gemini API key (required)
- `GITHUB_TOKEN`: GitHub token for API access (automatically provided by GitHub Actions)

### Getting a Gemini API Key

1. Visit the [Google AI Studio](https://aistudio.google.com/)
2. Create or select a project
3. Generate an API key for the Gemini API
4. Add it to your repository secrets as `GEMINI_API_KEY`

## Features

The Gemini reviewer analyzes code for:

- **Code Quality**: Best practices, readability, maintainability
- **Security**: Potential vulnerabilities and security issues
- **Performance**: Optimization opportunities
- **Architecture**: Design patterns and structural concerns
- **Testing**: Coverage implications and test quality

## Files

- `.github/workflows/gemini-review.yml`: GitHub Actions workflow
- `scripts/gemini_review.py`: Main review script
- `gemini_review_output.md`: Generated review output (in artifacts)

## Manual Testing

You can test the review system locally by setting the required environment variables:

```bash
export GEMINI_API_KEY="your-api-key"
export GITHUB_TOKEN="your-github-token"
export GITHUB_EVENT_PATH="path-to-mock-event.json"

python scripts/gemini_review.py
```

## Limitations

- Reviews are generated based on diffs only, not full file context
- Large diffs may be truncated due to token limits
- The quality of reviews depends on the clarity of the code changes
- This is an AI-generated review - human judgment is still essential

## Future Enhancements

Potential improvements could include:
- Posting reviews directly as PR comments
- Integration with code quality metrics
- Custom review templates for different file types
- Integration with existing linting and testing tools
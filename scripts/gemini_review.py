import os
import sys
import json
import requests
from urllib.parse import urlparse

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GITHUB_EVENT_PATH = os.getenv("GITHUB_EVENT_PATH")

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent"

def get_pr_info():
    """Extract PR information from GitHub event."""
    if not GITHUB_EVENT_PATH or not os.path.exists(GITHUB_EVENT_PATH):
        print("No GitHub event path found or file doesn't exist")
        return None
    
    try:
        with open(GITHUB_EVENT_PATH, 'r') as f:
            event = json.load(f)
        
        if 'pull_request' not in event:
            print("Not a pull request event")
            return None
            
        pr = event['pull_request']
        return {
            'number': pr['number'],
            'repo_full_name': pr['base']['repo']['full_name'],
            'base_sha': pr['base']['sha'],
            'head_sha': pr['head']['sha'],
            'diff_url': pr['diff_url']
        }
    except Exception as e:
        print(f"Error reading GitHub event: {e}")
        return None

def get_pr_diff(pr_info):
    """Fetch the PR diff from GitHub."""
    if not pr_info:
        return None
    
    try:
        headers = {
            'Accept': 'application/vnd.github.v3.diff',
            'User-Agent': 'gemini-code-review/1.0'
        }
        
        if GITHUB_TOKEN:
            headers['Authorization'] = f'token {GITHUB_TOKEN}'
        
        response = requests.get(pr_info['diff_url'], headers=headers)
        response.raise_for_status()
        
        return response.text
    except Exception as e:
        print(f"Error fetching PR diff: {e}")
        return None

def create_review_prompt(diff):
    """Create a comprehensive prompt for Gemini to review the code."""
    prompt = f"""You are a senior software engineer conducting a code review. Please analyze the following pull request diff and provide constructive feedback.

Focus on:
1. Code quality and best practices
2. Potential bugs or security issues
3. Performance considerations
4. Code readability and maintainability
5. Architectural concerns
6. Test coverage implications

For each issue you identify, please:
- Specify the file and line number if possible
- Explain the issue clearly
- Suggest specific improvements
- Rate the severity (Low/Medium/High)

If the code looks good, please acknowledge what was done well.

Here's the diff to review:

```diff
{diff}
```

Please provide your review in a structured format with clear sections for different types of feedback."""

    return prompt

def review_code_with_gemini(diff):
    """Send code to Gemini for review."""
    if not GEMINI_API_KEY:
        print("GEMINI_API_KEY not found")
        return None
    
    if not diff or len(diff.strip()) == 0:
        print("No diff content to review")
        return None
    
    prompt = create_review_prompt(diff)
    
    payload = {
        "contents": [
            {"parts": [{"text": prompt}]}
        ],
        "generationConfig": {
            "temperature": 0.3,
            "topK": 40,
            "topP": 0.95,
            "maxOutputTokens": 8192
        }
    }
    
    try:
        response = requests.post(
            f"{GEMINI_API_URL}?key={GEMINI_API_KEY}",
            json=payload,
            headers={'Content-Type': 'application/json'},
            timeout=60
        )
        response.raise_for_status()
        
        result = response.json()
        
        if 'candidates' in result and len(result['candidates']) > 0:
            if 'content' in result['candidates'][0]:
                return result['candidates'][0]['content']['parts'][0]['text']
        
        print("Unexpected response format from Gemini API")
        return None
        
    except requests.exceptions.RequestException as e:
        print(f"Error calling Gemini API: {e}")
        return None
    except json.JSONDecodeError as e:
        print(f"Error parsing Gemini response: {e}")
        return None
    except Exception as e:
        print(f"Unexpected error: {e}")
        return None

def format_review_output(review_text, pr_info):
    """Format the review output."""
    if not review_text:
        return "No review generated"
    
    output = f"""# Gemini Code Review

**Pull Request:** #{pr_info['number'] if pr_info else 'Unknown'}
**Repository:** {pr_info['repo_full_name'] if pr_info else 'Unknown'}

---

{review_text}

---

*This review was generated automatically by Gemini AI. Please use your judgment when applying suggestions.*
"""
    return output

def main():
    """Main function to orchestrate the code review process."""
    print("Starting Gemini code review...")
    
    # Get PR information
    pr_info = get_pr_info()
    if not pr_info:
        print("Could not extract PR information")
        sys.exit(1)
    
    print(f"Reviewing PR #{pr_info['number']} in {pr_info['repo_full_name']}")
    
    # Get the diff
    diff = get_pr_diff(pr_info)
    if not diff:
        print("Could not fetch PR diff")
        sys.exit(1)
    
    print(f"Fetched diff with {len(diff)} characters")
    
    # Review with Gemini
    review = review_code_with_gemini(diff)
    if not review:
        print("Could not generate review")
        sys.exit(1)
    
    # Format and output the review
    formatted_review = format_review_output(review, pr_info)
    print("\n" + "="*80)
    print(formatted_review)
    print("="*80)
    
    # Also save to file for potential GitHub commenting
    with open('gemini_review_output.md', 'w') as f:
        f.write(formatted_review)
    
    print("\nReview saved to gemini_review_output.md")

if __name__ == "__main__":
    main()

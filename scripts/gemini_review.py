import os
import json
import requests
import subprocess
import sys

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GITHUB_REPOSITORY = os.getenv("GITHUB_REPOSITORY")
GITHUB_EVENT_PATH = os.getenv("GITHUB_EVENT_PATH")

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent"

def get_github_event():
    """Parse GitHub event data to get PR information"""
    if not GITHUB_EVENT_PATH:
        return None
    
    try:
        with open(GITHUB_EVENT_PATH, 'r') as f:
            event_data = json.load(f)
        return event_data
    except Exception as e:
        print(f"Error reading GitHub event: {e}")
        return None

def get_diff():
    """Get diff using git commands or GitHub API"""
    try:
        # Try to get diff using git command first
        result = subprocess.run(
            ["git", "diff", "HEAD~1", "HEAD"], 
            capture_output=True, 
            text=True, 
            cwd=os.getcwd()
        )
        
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
        
        # If no diff from git, try to get all recent changes
        result = subprocess.run(
            ["git", "diff", "--cached"], 
            capture_output=True, 
            text=True, 
            cwd=os.getcwd()
        )
        
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
            
        # Fallback: get diff of all tracked files that have changed
        result = subprocess.run(
            ["git", "status", "--porcelain"], 
            capture_output=True, 
            text=True, 
            cwd=os.getcwd()
        )
        
        if result.returncode == 0 and result.stdout.strip():
            # Get list of changed files and show their content
            changed_files = []
            for line in result.stdout.strip().split('\n'):
                if line.strip():
                    file_path = line[3:].strip()  # Remove status prefix
                    try:
                        with open(file_path, 'r') as f:
                            content = f.read()
                            changed_files.append(f"=== {file_path} ===\n{content}")
                    except Exception:
                        continue
            
            if changed_files:
                return '\n\n'.join(changed_files)
        
        # Final fallback: return placeholder
        return "def my_func():\n    pass"
        
    except Exception as e:
        print(f"Error getting diff: {e}")
        return "Error retrieving code diff"

def review_code(code):
    """Send code to Gemini for review"""
    if not GEMINI_API_KEY:
        print("Error: GEMINI_API_KEY not set")
        return {"error": "Missing API key"}
    
    prompt = f"""Please review the following code changes and provide constructive feedback. 
Focus on:
- Code quality and best practices
- Potential bugs or security issues
- Performance considerations
- Readability and maintainability
- Suggestions for improvement

Code to review:
{code}

Please provide your feedback in a clear, constructive manner."""

    payload = {
        "contents": [
            {"parts": [{"text": prompt}]}
        ],
        "generationConfig": {
            "temperature": 0.1,
            "topK": 1,
            "topP": 1,
            "maxOutputTokens": 2048,
        }
    }
    
    try:
        response = requests.post(
            f"{GEMINI_API_URL}?key={GEMINI_API_KEY}",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            print(f"Error from Gemini API: {response.status_code}")
            print(f"Response: {response.text}")
            return {"error": f"API request failed with status {response.status_code}"}
            
    except Exception as e:
        print(f"Error calling Gemini API: {e}")
        return {"error": str(e)}

def extract_review_text(gemini_response):
    """Extract the review text from Gemini's response"""
    try:
        if "candidates" in gemini_response and len(gemini_response["candidates"]) > 0:
            candidate = gemini_response["candidates"][0]
            if "content" in candidate and "parts" in candidate["content"]:
                parts = candidate["content"]["parts"]
                if len(parts) > 0 and "text" in parts[0]:
                    return parts[0]["text"]
        
        # Fallback
        return str(gemini_response)
    except Exception as e:
        print(f"Error extracting review text: {e}")
        return f"Error processing review: {e}"

def post_github_comment(review_text):
    """Post review as a comment on the PR"""
    print("=== GEMINI CODE REVIEW ===")
    print(review_text)
    print("=== END REVIEW ===")
    
    # Save to file for artifact upload
    try:
        with open("gemini_review_output.txt", "w") as f:
            f.write(review_text)
        print("Review saved to gemini_review_output.txt")
    except Exception as e:
        print(f"Error saving review: {e}")
    
    # If we have GitHub context, try to post as a comment
    if GITHUB_TOKEN and GITHUB_REPOSITORY:
        try:
            event_data = get_github_event()
            if event_data and "pull_request" in event_data:
                pr_number = event_data["pull_request"]["number"]
                
                comment_payload = {
                    "body": f"## 🤖 Gemini Code Review\n\n{review_text}"
                }
                
                response = requests.post(
                    f"https://api.github.com/repos/{GITHUB_REPOSITORY}/issues/{pr_number}/comments",
                    json=comment_payload,
                    headers={
                        "Authorization": f"token {GITHUB_TOKEN}",
                        "Accept": "application/vnd.github.v3+json"
                    },
                    timeout=30
                )
                
                if response.status_code == 201:
                    print("Successfully posted review comment to PR")
                else:
                    print(f"Failed to post comment: {response.status_code}")
                    print(f"Response: {response.text}")
                    
        except Exception as e:
            print(f"Error posting GitHub comment: {e}")
    else:
        print("GitHub integration not available (missing token or repository info)")

if __name__ == "__main__":
    print("Starting Gemini code review...")
    
    # Get the code diff
    diff = get_diff()
    if not diff or diff.strip() == "":
        print("No code changes found to review")
        sys.exit(0)
    
    print(f"Found code changes ({len(diff)} characters)")
    
    # Get review from Gemini
    review_response = review_code(diff)
    
    if "error" in review_response:
        print(f"Error during review: {review_response['error']}")
        sys.exit(1)
    
    # Extract and post the review
    review_text = extract_review_text(review_response)
    post_github_comment(review_text)
    
    print("Gemini review completed successfully")

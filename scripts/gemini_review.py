import os
import requests

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent"

def get_diff():
    # TODO: Use GitHub API to fetch PR diff
    # For now, just a placeholder
    return "def my_func():\n    pass"

def review_code(code):
    payload = {
        "contents": [
            {"parts": [{"text": f"Review the following code:\n{code}"}]}
        ]
    }
    response = requests.post(
        f"{GEMINI_API_URL}?key={GEMINI_API_KEY}",
        json=payload
    )
    return response.json()

if __name__ == "__main__":
    diff = get_diff()
    review = review_code(diff)
    print("Gemini review response:", review)

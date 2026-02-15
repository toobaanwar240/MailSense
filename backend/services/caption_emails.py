import groq as Groq
import os
from dotenv import load_dotenv
import streamlit as st
from backend.services.email_processor import preprocess_email

# Load variables from .env file
load_dotenv()

# Get API key from environment variable
GROQ_API_KEY = st.secrets["groq"]["api_key"] if "groq" in st.secrets else os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise ValueError("Groq API key not found in .env or Streamlit secrets.")

# Initialize Groq client
client = Groq.Client(api_key=GROQ_API_KEY)

def caption_email(text):
    """
    Generate a short caption/title for the email.
    
    Args:
        text (str): Email content
    
    Returns:
        str: Short caption describing the email
    """
    try:
        # Preprocess for captioning (can use fewer tokens)
        processed_text = preprocess_email(text, max_tokens=3000)
        
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant", 
            messages=[
                {
                    "role": "system", 
                    "content": """You are an expert at creating short, descriptive captions for emails. 
                    Create a 5-10 word caption that captures the essence of the email.
                    Focus on: main topic, urgency, and key action.
                    Examples:
                    - "Meeting request for project discussion"
                    - "Urgent: Client feedback needed by EOD"
                    - "Weekly team update and progress report"
                    - "Invoice payment confirmation and details"
                    Keep it concise and descriptive."""
                },
                {
                    "role": "user", 
                    "content": f"Create a short descriptive caption for this email:\n\n{processed_text}"
                }
            ],
            max_tokens=100,
            temperature=0.3
        )
        return response.choices[0].message.content.strip()
        
    except Exception as e:
        if "413" in str(e) or "too large" in str(e).lower():
            # Try with even shorter text
            very_short_text = preprocess_email(text, max_tokens=1500)
            response = client.chat.completions.create(
                model="llama-3.1-8b-instant", 
                messages=[
                    {
                        "role": "system", 
                        "content": "Create a very short caption (3-7 words) for this email."
                    },
                    {
                        "role": "user", 
                        "content": f"Short caption:\n\n{very_short_text}"
                    }
                ],
                max_tokens=50,
                temperature=0.3
            )
            return f" {response.choices[0].message.content.strip()}"
        else:
            st.error(f"Caption generation error: {e}")
            return "Email caption unavailable"
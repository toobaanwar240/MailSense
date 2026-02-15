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

def summarize_email(text):
    """
    Summarize email with proper preprocessing and error handling.
    
    Args:
        text (str): Email content to summarize
    
    Returns:
        str: Email summary
    """
    try:
        # Preprocess the email (clean + truncate)
        processed_text = preprocess_email(text, max_tokens=5000)
        
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant", 
            messages=[
                {
                    "role": "system", 
                    "content": """You are an expert email summarizer. Create a clear, concise summary with:
                    - Key points as bullet points
                    - Action items if any
                    - Important dates/deadlines
                    - Main purpose of the email
                    Keep it brief but informative."""
                },
                {
                    "role": "user", 
                    "content": f"Please summarize this email clearly:\n\n{processed_text}"
                }
            ],
            max_tokens=500,
            temperature=0.3
        )
        return response.choices[0].message.content
        
    except Exception as e:
        if "413" in str(e) or "too large" in str(e).lower():
            # Fallback for very long emails
            return summarize_long_email_fallback(text)
        else:
            st.error(f"Summarization error: {e}")
            return "Sorry, I couldn't summarize this email due to an error."

def summarize_long_email_fallback(text):
    """
    Fallback summarization for very long emails.
    """
    try:
        # More aggressive preprocessing
        processed_text = preprocess_email(text, max_tokens=3000)
        
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant", 
            messages=[
                {
                    "role": "system", 
                    "content": "Provide a very brief summary of the most important points in this email."
                },
                {
                    "role": "user", 
                    "content": f"Briefly summarize the key points:\n\n{processed_text}"
                }
            ],
            max_tokens=300,
            temperature=0.3
        )
        return f"Brief Summary (email was very long):\n{response.choices[0].message.content}"
    except Exception as e:
        return "This email is too long to summarize effectively. Please try with a shorter email." 
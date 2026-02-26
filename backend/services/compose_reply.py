# backend/services/reply_email.py

import groq as Groq
import os
from dotenv import load_dotenv

load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY2")
client = Groq.Client(api_key=GROQ_API_KEY)

def generate_email_reply(
    sender: str,
    subject: str,
    email_text: str,
    your_name: str = "Assistant",
    tone: str = "professional",
) -> dict:
    """
    Use Claude to read an email, detect its intent, and write a suitable reply.

    Returns:
        {
            "reply_subject": str,
            "reply_body":    str,
            "detected_intent": str   # e.g. 'complaint', 'inquiry', 'follow-up'
        }
    """
    prompt = f"""You are an expert email assistant. Carefully read the email below and do two things:

1. Detect the primary intent of the email. Choose the single best label from:
   complaint | inquiry | meeting_request | follow_up | thank_you | job_application | other

2. Write a {tone} reply that:
   - Directly addresses every point raised
   - Matches the urgency and formality of the original
   - Is signed off as "{your_name}"

---
From:    {sender}
Subject: {subject}

{email_text}
---

Respond in EXACTLY this format (no extra text outside it):

INTENT: <label>
SUBJECT: <reply subject line>
BODY:
<full reply body>
"""

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.choices[0].message.content.strip()
    return _parse_reply(raw)


def _parse_reply(raw: str) -> dict:
    intent = ""
    subject = ""
    body_lines = []
    in_body = False

    for line in raw.splitlines():
        if line.startswith("INTENT:"):
            intent = line.replace("INTENT:", "").strip()
        elif line.startswith("SUBJECT:"):
            subject = line.replace("SUBJECT:", "").strip()
        elif line.startswith("BODY:"):
            in_body = True
        elif in_body:
            body_lines.append(line)

    return {
        "reply_subject": subject,
        "reply_body": "\n".join(body_lines).strip(),
        "detected_intent": intent,
    }

def generate_new_email(to: str, topic: str, tone: str = "professional", additional_context: str = "") -> dict:
    prompt = f"""You are an expert email writer. Write a complete, {tone} email based on the details below.

Recipient: {to}
Topic / Purpose: {topic}
Additional context: {additional_context if additional_context else "None"}

Rules:
- Write a clear, concise subject line
- Write a full email body that covers the topic thoroughly
- Match the requested tone: {tone}
- End with an appropriate sign-off

Respond in EXACTLY this format:
SUBJECT: <subject line>
BODY:
<full email body>
"""

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.choices[0].message.content.strip()
    return _parse(raw)


def _parse(raw: str) -> dict:
    subject = ""
    body_lines = []
    in_body = False

    for line in raw.splitlines():
        if line.startswith("SUBJECT:"):
            subject = line.replace("SUBJECT:", "").strip()
        elif line.startswith("BODY:"):
            in_body = True
        elif in_body:
            body_lines.append(line)

    return {
        "subject": subject,
        "body": "\n".join(body_lines).strip(),
    }
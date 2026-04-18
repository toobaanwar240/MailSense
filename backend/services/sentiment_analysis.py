import os
from dotenv import load_dotenv
import json
from groq import Groq

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

SENTIMENT_COLORS = {
    "positive":  "😊",
    "negative":  "😠",
    "neutral":   "😐",
    "urgent":    "🚨",
    "frustrated":"😤",
    "happy":     "🎉",
    "anxious":   "😰",
    "grateful":  "🙏",
    "unknown":   "❓",
}

_groq_client = None


def _get_groq_client() -> Groq:
    global _groq_client
    if _groq_client is None:
        _groq_client = Groq(api_key=GROQ_API_KEY)
    return _groq_client


def _extract_json_text(text: str) -> str:
    """Handle models that wrap JSON in markdown code fences."""
    raw = (text or "").strip()
    if raw.startswith("```"):
        parts = raw.split("```")
        if len(parts) >= 2:
            raw = parts[1].strip()
            if raw.startswith("json"):
                raw = raw[4:].strip()
    return raw


def analyze_sentiment(subject: str, body: str) -> dict:
    """
    Analyze the sentiment of an email using Groq API.
    Returns sentiment label, confidence, emoji, and explanation.
    """
    if not GROQ_API_KEY:
        return {
            "sentiment": "unknown",
            "confidence": 0.0,
            "emoji": "❓",
            "explanation": "Groq API key not configured.",
            "tone_tags": []
        }

    try:
        client = _get_groq_client()

        prompt = f"""
You are an expert email sentiment analyzer. Analyze the sentiment and tone of the following email.

Subject: {subject}
Body: {body[:1000]}

Respond ONLY with a valid JSON object in this exact format (no markdown, no extra text):
{{
  "sentiment": "<one of: positive, negative, neutral, urgent, frustrated, happy, anxious, grateful>",
  "confidence": <float between 0.0 and 1.0>,
  "explanation": "<one sentence explaining the sentiment>",
  "tone_tags": ["<tag1>", "<tag2>"]
}}

Rules:
- sentiment must be exactly one of: positive, negative, neutral, urgent, frustrated, happy, anxious, grateful
- confidence must be a float like 0.85
- tone_tags should be 2-3 short descriptive words like ["formal", "polite"] or ["demanding", "aggressive"]
- explanation should be one clear sentence
"""

        response = client.chat.completions.create(
            model=GROQ_MODEL,
            temperature=0,
            messages=[
                {
                    "role": "system",
                    "content": "You return strict JSON only.",
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
        )

        content = response.choices[0].message.content if response.choices else ""
        raw = _extract_json_text(content)

        result = json.loads(raw)

        sentiment = result.get("sentiment", "unknown")
        confidence = float(result.get("confidence", 0.0))
        explanation = result.get("explanation", "")
        tone_tags = result.get("tone_tags", [])

        return {
            "sentiment": sentiment,
            "confidence": round(confidence * 100, 1),
            "emoji": SENTIMENT_COLORS.get(sentiment, "❓"),
            "explanation": explanation,
            "tone_tags": tone_tags
        }

    except json.JSONDecodeError as e:
        print(f"❌ JSON parse error: {e} | Raw: {raw}")
        return {
            "sentiment": "unknown",
            "confidence": 0.0,
            "emoji": "❓",
            "explanation": "Failed to parse Groq response.",
            "tone_tags": []
        }
    except Exception as e:
        print(f"❌ Sentiment analysis error: {e}")
        return {
            "sentiment": "unknown",
            "confidence": 0.0,
            "emoji": "❓",
            "explanation": str(e),
            "tone_tags": []
        }
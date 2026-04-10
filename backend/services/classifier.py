import json
import os
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

# Path to your model
MODEL_PATH = os.path.join("models", "MAILSENSE_FINAL_MODEL")

# Category colors for UI — updated to match new labels
CATEGORY_COLORS = {
   "account_alerts":    "🔔",
    "career_personal":   "🎯",
    "finance_legal":     "⚖️",
    "marketing_outreach":"📢",
    "work_operations":   "🖥️",
    "unknown":           "❓",
}

class EmailClassifier:
    def __init__(self):
        print("🤖 Loading email classifier model...")
        try:
            # Load label map
            label_map_path = os.path.join(MODEL_PATH, "label_mapping.json")
            with open(label_map_path, "r") as f:
                data = json.load(f)
                # Support both flat and nested formats
                self.label_map = data.get("id2label", data)

            print(f"✅ Label map loaded: {self.label_map}")

            # Load tokenizer and model
            self.tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
            self.model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
            self.model.eval()

            print("✅ Email classifier ready!")
        except Exception as e:
            print(f"❌ Failed to load classifier: {e}")
            self.model = None
            self.tokenizer = None
            self.label_map = {}

    def classify(self, subject: str, body: str) -> dict:
        """
        Classify an email and return category + confidence.
        """
        if not self.model or not self.tokenizer:
            print("❌ Model not loaded — returning unknown")
            return {
                "category": "unknown",
                "confidence": 0.0,
                "emoji": "⚪",
                "all_scores": {}
            }

        try:
            # Combine subject and body
            text = f"{subject} {body[:500]}"

            print(f"🔍 Classifying: {subject[:50]}")

            # Tokenize
            inputs = self.tokenizer(
                text,
                return_tensors="pt",
                truncation=True,
                max_length=384,
                padding=True
            )

            # Get predictions
            with torch.no_grad():
                outputs = self.model(**inputs)
                logits = outputs.logits
                probs = torch.softmax(logits, dim=1)[0]

            # Get top prediction
            top_idx = torch.argmax(probs).item()
            top_prob = probs[top_idx].item()
            category = self.label_map.get(str(top_idx), "unknown")

            print(f"✅ Result: {category} ({round(top_prob * 100, 1)}%)")

            # Get all scores
            all_scores = {
                self.label_map.get(str(i), f"class_{i}"): round(probs[i].item() * 100, 1)
                for i in range(len(probs))
            }

            return {
                "category": category,
                "confidence": round(top_prob * 100, 1),
                "emoji": CATEGORY_COLORS.get(category, "⚪"),
                "all_scores": all_scores
            }

        except Exception as e:
            print(f"❌ Classification error: {e}")
            return {
                "category": "unknown",
                "confidence": 0.0,
                "emoji": "⚪",
                "all_scores": {}
            }


# Global instance
classifier = EmailClassifier()
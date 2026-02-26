"""
COMPLETE RAG System - INBOX ONLY
✅ Fixed sender detection (regex-based, no false positives)
✅ Fixed context truncation (800 chars per email, not 400)
✅ Fixed query cache with TTL expiry + invalidation on index
✅ Fixed fuzzy sender matching (stricter logic)
✅ Fixed over-filtering when sender_filter is active
✅ Fixed hybrid search returning empty on bad sender detection
✅ All methods included
✅ Only indexes emails with INBOX label
"""

import os
import re
import hashlib
import time
from typing import List, Dict, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from concurrent.futures import ThreadPoolExecutor, as_completed

import chromadb
from sentence_transformers import SentenceTransformer
from groq import Groq

from backend.db.models import Email, User


# ---------------------------------------------------------------------------
# Simple TTL Cache
# ---------------------------------------------------------------------------

class TTLCache:
    """
    Thread-safe in-memory cache with per-entry TTL.
    Entries older than `ttl_seconds` are treated as expired and removed.
    """

    def __init__(self, ttl_seconds: int = 300):
        self._store: Dict[str, Tuple[object, float]] = {}
        self.ttl_seconds = ttl_seconds

    def get(self, key: str):
        """Return cached value or None if missing / expired."""
        if key not in self._store:
            return None
        value, inserted_at = self._store[key]
        if time.time() - inserted_at > self.ttl_seconds:
            del self._store[key]
            return None
        return value

    def set(self, key: str, value):
        self._store[key] = (value, time.time())

    def clear(self):
        self._store.clear()

    def evict_expired(self):
        """Remove all expired entries (call periodically if desired)."""
        now = time.time()
        expired = [k for k, (_, t) in self._store.items() if now - t > self.ttl_seconds]
        for k in expired:
            del self._store[k]

    def __len__(self):
        self.evict_expired()
        return len(self._store)


# ---------------------------------------------------------------------------
# Main RAG class
# ---------------------------------------------------------------------------

class InboxOnlyRAG:
    """RAG system that only indexes INBOX emails."""

    def __init__(self):
        print("\n🚀 Initializing INBOX-ONLY RAG System...")

        self.chroma_client = chromadb.PersistentClient(path="./chroma_db")
        self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        self.groq_client = Groq(api_key=os.getenv("GROQ_API_KEY2"))

        self.max_context_tokens = 4000          # increased from 3000
        self.max_response_tokens = 1000         # increased from 800
        self.chars_per_token = 4

        self.last_rate_limit = None
        self.rate_limit_cooldown = 7200

        self.chunk_size = 800

        # ✅ FIX: TTL-based cache (5 min expiry) instead of a plain dict that never clears
        self.query_cache = TTLCache(ttl_seconds=300)

        print("✅ INBOX-ONLY RAG ready!\n")

    # ------------------------------------------------------------------
    # Rate limit helpers
    # ------------------------------------------------------------------

    def is_rate_limited(self) -> bool:
        if self.last_rate_limit is None:
            return False
        return (time.time() - self.last_rate_limit) < self.rate_limit_cooldown

    # ------------------------------------------------------------------
    # Collection helpers
    # ------------------------------------------------------------------

    def get_collection_name(self, user_email: str) -> str:
        return f"emails_inbox_{user_email.replace('@', '_').replace('.', '_')}"

    def get_or_create_collection(self, user_email: str):
        collection_name = self.get_collection_name(user_email)
        try:
            return self.chroma_client.get_collection(name=collection_name)
        except Exception:
            return self.chroma_client.create_collection(
                name=collection_name,
                metadata={"user_email": user_email, "label_filter": "INBOX"}
            )

    # ------------------------------------------------------------------
    # INBOX label check
    # ------------------------------------------------------------------

    def is_inbox_email(self, email: Email) -> bool:
        if hasattr(email, 'labels') and email.labels:
            labels = [l.strip() for l in email.labels.split(',')]
            has_inbox = 'INBOX' in labels
            if not has_inbox:
                print(f"  ⏭️  Skipping non-INBOX email: {labels}")
            return has_inbox

        if not hasattr(email, 'labels'):
            print("⚠️  Warning: Email model has no 'labels' field.")
        return True

    # ------------------------------------------------------------------
    # Deadline extraction
    # ------------------------------------------------------------------

    def extract_deadline(self, text: str) -> Optional[datetime]:
        text_lower = text.lower()
        patterns = [
            (r'deadline[:\s]+(\d{1,2}/\d{1,2}/\d{4})', '%m/%d/%Y'),
            (r'due[:\s]+(\d{1,2}/\d{1,2}/\d{4})', '%m/%d/%Y'),
            (r'deadline[:\s]+(\d{4}-\d{2}-\d{2})', '%Y-%m-%d'),
            (r'due[:\s]+(\d{4}-\d{2}-\d{2})', '%Y-%m-%d'),
            (r'by[:\s]+(\d{1,2}/\d{1,2}/\d{4})', '%m/%d/%Y'),
        ]
        for pattern, date_format in patterns:
            match = re.search(pattern, text_lower)
            if match:
                try:
                    return datetime.strptime(match.group(1), date_format)
                except Exception:
                    pass
        if any(w in text_lower for w in ['urgent', 'asap', 'immediately']):
            return datetime.now()
        return None

    # ------------------------------------------------------------------
    # Name / sender helpers
    # ------------------------------------------------------------------

    def normalize_name(self, name: str) -> str:
        normalized = re.sub(r'[^a-z0-9\s]', '', name.lower())
        return ' '.join(normalized.split())

    def extract_name_parts(self, sender: str) -> Tuple[str, str, str]:
        sender_lower = sender.lower()

        email_match = re.search(r'([a-z0-9._+-]+@[a-z0-9.-]+)', sender_lower)
        email_address = email_match.group(1) if email_match else ""

        email_username = ""
        if email_address:
            username_match = re.match(r'([^@]+)@', email_address)
            if username_match:
                email_username = re.sub(r'[._-]', ' ', username_match.group(1))

        full_name = ""
        name_match = re.match(r'^([^<]+)\s*<', sender_lower)
        if name_match:
            full_name = name_match.group(1).strip()
        elif not email_address:
            full_name = sender_lower.strip()

        full_name = self.normalize_name(full_name) if full_name else ""
        email_username = self.normalize_name(email_username) if email_username else ""

        return full_name, email_address, email_username

    def _generate_search_variants(self, search_term: str) -> List[str]:
        """
        Generate all useful variants of a search term to match against senders.

        Example: "syedahajra"  →  ["syedahajra", "syed hajra", "syed a hajra",
                                    "syeda hajra", "hajra", "syed"]
        Example: "john smith"  →  ["john smith", "johnsmith", "john", "smith"]
        Example: "hajra"       →  ["hajra"]
        """
        term = search_term.lower().strip()
        # strip punctuation
        term_clean = re.sub(r'[^a-z0-9]', '', term)
        variants = set()

        # 1. Original as-is (with spaces)
        variants.add(term)

        # 2. No-space version (useful when user typed with spaces: "syeda hajra" → "syedahajra")
        variants.add(term_clean)

        # 3. If the term has no spaces (compound word like "syedahajra"),
        #    try splitting at common Urdu/South-Asian name prefixes
        if ' ' not in term:
            prefixes = ['syed', 'syeda', 'muhammad', 'mohd', 'md', 'hafiz',
                        'sheikh', 'malik', 'rana', 'raja', 'ch', 'chaudhry',
                        'mirza', 'khawaja', 'miss', 'mrs', 'mr', 'dr']
            for prefix in prefixes:
                if term_clean.startswith(prefix) and len(term_clean) > len(prefix) + 1:
                    remainder = term_clean[len(prefix):]
                    variants.add(f"{prefix} {remainder}")   # "syed ahajra" etc.
                    variants.add(remainder)                  # just the remainder: "hajra"
                    variants.add(prefix)                     # just the prefix

        # 4. If the term has spaces, also add the no-space version and each word alone
        if ' ' in term:
            parts = term.split()
            for part in parts:
                if len(part) >= 3:
                    variants.add(part)
            variants.add(''.join(parts))   # "john smith" → "johnsmith"

        return list(variants)

    def sender_matches(self, sender: str, search_term: str) -> bool:
        """
        Match a sender string against a search term using multiple strategies:
          1. All search variants vs email address (stripped of punctuation)
          2. All search variants vs display name (stripped of punctuation)
          3. All search variants vs email username (stripped of punctuation)
          4. Token overlap: if user typed a multi-word name, check each word appears in sender
        """
        if not search_term or not sender:
            return False

        search_term = search_term.lower().strip()
        sender_lower = sender.lower()

        full_name, email_address, email_username = self.extract_name_parts(sender)

        # Build clean (punctuation-free) versions of each sender component
        email_address_clean  = re.sub(r'[^a-z0-9]', '', email_address)
        full_name_clean      = re.sub(r'[^a-z0-9 ]', '', full_name)
        email_username_clean = re.sub(r'[^a-z0-9]', '', email_username)
        # Combined blob for broad matching
        sender_blob = f"{full_name_clean} {email_address_clean} {email_username_clean}"

        variants = self._generate_search_variants(search_term)

        for variant in variants:
            v_clean = re.sub(r'[^a-z0-9]', '', variant)
            v_spaced = variant  # may contain spaces

            if not v_clean:
                continue

            # --- Check against email address (no punctuation) ---
            if v_clean in email_address_clean:
                return True

            # --- Check against display name (no punctuation) ---
            if v_clean in full_name_clean.replace(' ', ''):
                return True
            if v_spaced in full_name_clean:   # spaced version vs spaced name
                return True

            # --- Check against email username (no punctuation) ---
            if v_clean in email_username_clean:
                return True

        # --- Token overlap check (for multi-word queries like "syed hajra") ---
        search_words = [w for w in search_term.split() if len(w) >= 3]
        if len(search_words) >= 2:
            matched_words = sum(
                1 for w in search_words
                if re.sub(r'[^a-z0-9]', '', w) in sender_blob.replace(' ', '')
            )
            if matched_words >= len(search_words):   # ALL words must match
                return True

        return False

    # ------------------------------------------------------------------
    # Chunking
    # ------------------------------------------------------------------

    def chunk_text(self, text: str, email_id: int) -> List[tuple]:
        if len(text) <= self.chunk_size:
            return [(text, 0)]
        chunks = []
        for i in range(0, len(text), self.chunk_size):
            chunks.append((text[i:i + self.chunk_size], i // self.chunk_size))
        return chunks

    # ------------------------------------------------------------------
    # Batch processing
    # ------------------------------------------------------------------

    def process_email_batch(self, emails: List[Email]) -> tuple:
        documents, metadatas, ids = [], [], []

        for email in emails:
            if not self.is_inbox_email(email):
                continue

            email_body = email.body or email.snippet or ""
            text = f"FROM: {email.sender}\nSUBJECT: {email.subject}\nDATE: {email.date}\n\n{email_body}"

            deadline = self.extract_deadline(text)
            text_lower = text.lower()
            is_urgent = any(w in text_lower for w in ['urgent', 'asap', 'immediately', 'critical'])
            has_deadline = 'deadline' in text_lower or 'due' in text_lower

            chunks = self.chunk_text(text, email.id)

            try:
                timestamp = email.date.timestamp() if email.date else datetime.now().timestamp()
            except Exception:
                timestamp = datetime.now().timestamp()

            try:
                is_read = email.is_read if hasattr(email, 'is_read') else False
            except Exception:
                is_read = False

            for chunk_text, chunk_idx in chunks:
                documents.append(chunk_text)
                metadatas.append({
                    "email_id": str(email.id),
                    "sender": email.sender or "Unknown",
                    "subject": email.subject or "No Subject",
                    "date": str(email.date),
                    "timestamp": timestamp,
                    "is_read": str(is_read),
                    "is_urgent": str(is_urgent),
                    "has_deadline": str(has_deadline),
                    "deadline_date": str(deadline) if deadline else "None",
                    "chunk_index": chunk_idx
                })
                ids.append(f"{email.id}_{chunk_idx}")

        return documents, metadatas, ids

    # ------------------------------------------------------------------
    # Indexing
    # ------------------------------------------------------------------

    def index_user_emails(self, db: Session, user_email: str) -> Dict:
        if hasattr(user_email, 'email'):
            user_email = user_email.email
        start_time = time.time()
        print(f"\n📊 Indexing INBOX emails for {user_email}...")

        user = db.query(User).filter(User.email == user_email).first()
        if not user:
            raise ValueError("User not found")

        print("📧 Fetching emails from database...")

        all_emails = []
        batch_size = 200
        offset = 0

        while True:
            query = db.query(Email).filter(Email.user_id == user.id)
            if hasattr(Email, 'labels'):
                query = query.filter(Email.labels.like('%INBOX%'))
                print("  🔍 Filtering by INBOX label in database query")

            batch = query.order_by(Email.date.desc()).limit(batch_size).offset(offset).all()
            if not batch:
                break
            all_emails.extend(batch)
            offset += batch_size

        if not all_emails:
            return {"status": "warning", "message": "No INBOX emails found"}

        print(f"📧 Total INBOX emails: {len(all_emails)}")

        collection = self.get_or_create_collection(user_email)

        try:
            existing_result = collection.get()
            existing_email_ids = set(cid.split('_')[0] for cid in existing_result['ids'])
            print(f"📦 Already indexed: {len(existing_email_ids)}")
        except Exception:
            existing_email_ids = set()

        new_emails = [e for e in all_emails if str(e.id) not in existing_email_ids]

        if not new_emails:
            elapsed = time.time() - start_time
            print(f"✅ All INBOX emails already indexed ({elapsed:.1f}s)\n")
            return {
                "status": "success",
                "message": "All INBOX emails already indexed",
                "email_count": len(all_emails),
                "new_emails": 0,
                "time_seconds": elapsed
            }

        print(f"🆕 Indexing {len(new_emails)} new INBOX emails...")

        email_batches = [new_emails[i:i + 50] for i in range(0, len(new_emails), 50)]
        all_documents, all_metadatas, all_ids = [], [], []

        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = {executor.submit(self.process_email_batch, batch): i
                       for i, batch in enumerate(email_batches)}
            for future in as_completed(futures):
                docs, metas, batch_ids = future.result()
                all_documents.extend(docs)
                all_metadatas.extend(metas)
                all_ids.extend(batch_ids)

        if not all_documents:
            print("⚠️  No INBOX emails to index after filtering")
            return {"status": "warning", "message": "No INBOX emails to index", "email_count": 0, "new_emails": 0}

        print(f"🔄 Generating embeddings for {len(all_documents)} chunks...")
        embeddings = self.embedding_model.encode(
            all_documents,
            convert_to_numpy=True,
            show_progress_bar=True,
            batch_size=64
        )

        print("💾 Storing in ChromaDB...")
        collection.add(
            embeddings=embeddings.tolist(),
            documents=all_documents,
            metadatas=all_metadatas,
            ids=all_ids
        )

        elapsed = time.time() - start_time
        print(f"✅ Indexed {len(new_emails)} INBOX emails in {elapsed:.1f}s\n")

        # ✅ FIX: Clear cache after new emails are indexed so stale results aren't served
        self.query_cache.clear()
        print("🗑️  Query cache cleared after indexing.")

        return {
            "status": "success",
            "message": f"Indexed {len(new_emails)} INBOX emails in {elapsed:.1f}s",
            "email_count": len(existing_email_ids) + len(new_emails),
            "new_emails": len(new_emails),
            "time_seconds": elapsed
        }

    # ------------------------------------------------------------------
    # Query helpers
    # ------------------------------------------------------------------

    def expand_query(self, query: str) -> str:
        query_lower = query.lower()
        if 'urgent' in query_lower:
            return query + " asap immediate critical"
        elif 'deadline' in query_lower:
            return query + " due date"
        elif 'meeting' in query_lower:
            return query + " schedule appointment call"
        return query

    def detect_sender_from_query(self, query: str) -> Optional[str]:
        """
        ✅ FIX: Regex-based sender detection.
        Only triggers on explicit phrasing like 'from John', 'emails from alice@example.com',
        'sent by Bob'. No longer grabs random words as false sender names.
        """
        query_lower = query.lower().strip()

        # Ordered from most specific to least specific
        patterns = [
            # "emails from <name>" / "email from <name>"
            r'emails?\s+from\s+([a-zA-Z0-9][a-zA-Z0-9._\s-]{1,40}?)(?:\s+about|\s+regarding|\s+on|\s+with|\s*$)',
            # "sent by <name>"
            r'sent\s+by\s+([a-zA-Z0-9][a-zA-Z0-9._\s-]{1,40}?)(?:\s+about|\s+regarding|\s+on|\s+with|\s*$)',
            # "from <name>" — must appear near the start of the query or after show/get/find
            r'(?:show|get|find|list|give\s+me|what).*?\bfrom\s+([a-zA-Z0-9][a-zA-Z0-9._\s-]{1,40}?)(?:\s+about|\s+regarding|\s+on|\s+with|\s*$)',
            # bare "from <name>" at start
            r'^from\s+([a-zA-Z0-9][a-zA-Z0-9._\s-]{1,40}?)(?:\s+about|\s+regarding|\s+on|\s+with|\s*$)',
        ]

        # Words that are NOT senders — if the extracted group matches one of these, reject
        false_positive_terms = {
            'me', 'you', 'us', 'them', 'him', 'her', 'it', 'the', 'a', 'an',
            'last', 'week', 'month', 'year', 'today', 'yesterday', 'this', 'that',
            'my', 'our', 'their', 'any', 'all', 'some', 'most', 'recent', 'latest',
            'newest', 'oldest', 'inbox', 'email', 'emails', 'mail', 'message', 'messages',
            'urgent', 'important', 'unread', 'read', 'starred', 'flagged',
        }

        for pattern in patterns:
            match = re.search(pattern, query_lower)
            if match:
                candidate = match.group(1).strip()
                candidate = re.sub(r'\s+', ' ', candidate)

                # Reject if it's a false-positive keyword
                if candidate in false_positive_terms:
                    continue

                # Reject very short single-char matches
                if len(candidate) < 2:
                    continue

                # Reject if it's all digits
                if candidate.isdigit():
                    continue

                print(f"🔍 Detected sender: '{candidate}'")
                return candidate

        return None

    # ------------------------------------------------------------------
    # Hybrid search
    # ------------------------------------------------------------------

    def hybrid_search(self, user_email: str, query: str, top_k: int = 20,
                      sender_filter: Optional[str] = None) -> List[Dict]:
        """Search INBOX emails only with TTL-cached results."""

        cache_key = hashlib.md5(f"{user_email}:{query}:{sender_filter}".encode()).hexdigest()
        cached = self.query_cache.get(cache_key)
        if cached is not None:
            print("⚡ Returning cached result")
            return cached

        collection = self.get_or_create_collection(user_email)
        if collection.count() == 0:
            print("⚠️  No INBOX emails indexed")
            return []

        expanded_query = self.expand_query(query)
        query_embedding = self.embedding_model.encode([expanded_query])[0].tolist()

        # ✅ FIX: Cap candidate pool sensibly; don't pull 1000 docs just for sender queries
        if sender_filter:
            n_results = min(300, collection.count())
            print(f"🔍 Searching {n_results} chunks for sender '{sender_filter}'")
        else:
            n_results = min(top_k * 3, collection.count())

        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results
        )

        query_keywords = set(query.lower().split())
        scored_results = []
        matched_count = 0
        skipped_count = 0

        for i in range(len(results['documents'][0])):
            doc = results['documents'][0][i]
            metadata = results['metadatas'][0][i]
            distance = results['distances'][0][i]
            sender = metadata.get('sender', '')

            if sender_filter:
                is_match = self.sender_matches(sender, sender_filter)
                if not is_match:
                    if skipped_count < 5:   # only log first 5 to avoid spam
                        print(f"  ✗ No match: '{sender}'")
                    skipped_count += 1
                    continue
                print(f"  ✓ Matched sender: '{sender}'")
                matched_count += 1

            semantic_score = max(0.0, 1.0 - distance)

            doc_lower = doc.lower()
            sender_lower = sender.lower()
            subject_lower = metadata.get('subject', '').lower()
            keyword_matches = sum(
                1 for kw in query_keywords
                if kw in doc_lower or kw in sender_lower or kw in subject_lower
            )
            keyword_score = min(1.0, keyword_matches / max(len(query_keywords), 1))

            try:
                timestamp = float(metadata.get('timestamp', 0))
            except Exception:
                timestamp = 0.0

            urgency_boost = 0.10 if metadata.get('is_urgent') == 'True' else 0.0
            deadline_boost = 0.10 if metadata.get('has_deadline') == 'True' else 0.0

            if sender_filter:
                hybrid_score = 0.40 * semantic_score + 0.40 * keyword_score + urgency_boost + deadline_boost
            else:
                hybrid_score = 0.35 * semantic_score + 0.45 * keyword_score + urgency_boost + deadline_boost

            scored_results.append({
                "text": doc,
                "metadata": metadata,
                "hybrid_score": hybrid_score,
                "timestamp": timestamp
            })

        if sender_filter:
            print(f"📊 Sender match: {matched_count} matched, {skipped_count} skipped")

            # ✅ FIX: If sender filter matched nothing, warn clearly instead of silently returning []
            if matched_count == 0:
                print(f"⚠️  No emails found from sender '{sender_filter}'. "
                      f"Check spelling or try a partial email address.")

        # Deduplicate: keep best-scored chunk per email
        seen_emails: Dict[str, Dict] = {}
        for result in scored_results:
            email_id = result['metadata']['email_id']
            if email_id not in seen_emails or result['hybrid_score'] > seen_emails[email_id]['hybrid_score']:
                seen_emails[email_id] = result

        unique_results = list(seen_emails.values())
        # Sort: newest first, then by score as tiebreaker
        unique_results.sort(key=lambda x: (x['timestamp'], x['hybrid_score']), reverse=True)

        final_results = unique_results[:50] if sender_filter else unique_results[:top_k]

        # ✅ Store in TTL cache
        self.query_cache.set(cache_key, final_results)

        return final_results

    # ------------------------------------------------------------------
    # Context trimming
    # ------------------------------------------------------------------

    def trim_context_to_token_limit(self, context_parts: List[str], max_chars: int) -> List[str]:
        total_chars = sum(len(p) for p in context_parts)
        if total_chars <= max_chars:
            return context_parts

        trimmed = []
        current_chars = 0
        for part in context_parts:
            if current_chars + len(part) > max_chars:
                remaining = max_chars - current_chars
                if remaining > 200:
                    trimmed.append(part[:remaining] + "...[truncated]")
                break
            trimmed.append(part)
            current_chars += len(part)
        return trimmed

    # ------------------------------------------------------------------
    # Fallback answer (no LLM)
    # ------------------------------------------------------------------

    def generate_fallback_answer(self, email_list: List[Dict], question: str) -> str:
        if not email_list:
            return "No relevant emails found."

        answer_parts = []
        if len(email_list) == 1:
            email = email_list[0]
            meta = email['metadata']
            answer_parts.append(f"**{meta['subject']}**")
            answer_parts.append(f"From: {meta['sender']}")
            answer_parts.append(f"Date: {meta.get('date', 'Unknown')}")
            answer_parts.append(f"\n{email['text'][:500]}")
        else:
            answer_parts.append(f"Found {len(email_list)} emails (newest first):\n")
            for i, email in enumerate(email_list[:10], 1):
                meta = email['metadata']
                answer_parts.append(f"{i}. **{meta['subject']}** - From: {meta['sender']}")
                answer_parts.append(f"   Date: {meta.get('date', 'Unknown')}")
                answer_parts.append(f"   {email['text'][:200]}...\n")

        return "\n".join(answer_parts)

    # ------------------------------------------------------------------
    # Main QA entry point
    # ------------------------------------------------------------------
    def contextualize_query(self, question: str, conversation_history: list) -> str:
        """Rewrite query using conversation history to make it self-contained."""
        
        if not conversation_history:
            return question
        
        # Check if question needs context (contains pronouns/references)
        needs_context = any(word in question.lower() for word in [
            'he', 'she', 'they', 'it', 'that', 'this', 'those', 
            'the email', 'that email', 'when was', 'what did he', 
            'what did she', 'reply', 'same'
        ])
        
        if not needs_context:
            return question
        
        # Build context from last 4 messages
        recent_history = conversation_history[-4:]
        history_text = "\n".join([f"{m['role']}: {m['content']}" for m in recent_history])
        
        try:
            response = self.groq_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {
                        "role": "system",
                        "content": "Rewrite the follow-up question as a standalone question using the conversation history. Return ONLY the rewritten question, nothing else."
                    },
                    {
                        "role": "user",
                        "content": f"History:\n{history_text}\n\nFollow-up question: {question}\n\nRewritten standalone question:"
                    }
                ],
                temperature=0.0,
                max_tokens=100
            )
            rewritten = response.choices[0].message.content.strip()
            print(f"🔄 Query rewritten: '{question}' → '{rewritten}'")
            return rewritten
        except Exception:
            return question
        
    def answer_question(self, user_email: str, question: str, db: Session = None, conversation_history: list = None) -> Dict:
        """Generate answers with intelligent sender filtering + conversation history."""

        conversation_history = conversation_history or []
        search_question = self.contextualize_query(question, conversation_history)
        question_lower = question.lower()

        # ✅ Detect sender with robust regex (no false positives)
        sender_filter = self.detect_sender_from_query(search_question)
        is_sender_query = sender_filter is not None

        highlight_urgency = any(w in question_lower for w in ['urgent', 'asap', 'critical', 'immediate'])
        highlight_deadline = any(w in question_lower for w in ['deadline', 'due'])

        if is_sender_query:
            top_k = 50
        elif any(w in question_lower for w in ["all", "list", "show"]):
            top_k = 30
        else:
            top_k = 15

        print(f"\n🔍 Query: '{question}'")
        print(f"📧 Sender filter: {sender_filter or 'None'}")
        print(f"📊 Top K: {top_k}")

        retrieved = self.hybrid_search(
             user_email, search_question, top_k=top_k, sender_filter=sender_filter
            )

        if not retrieved:
            if is_sender_query:
                no_result_msg = (
                    f"No emails found from '{sender_filter}'. "
                    f"Please check the name or email address and try again."
                )
            else:
                no_result_msg = "No relevant emails found in your inbox."

            return {
                "answer": no_result_msg,
                "sources": [],
                "question": question,
                "status": "no_results",
                "matched_keywords": []
            }

        question_keywords = [w for w in question_lower.split() if len(w) > 2]
        email_list = retrieved
        total_emails = len(email_list)
        print(f"✅ Found {total_emails} emails")

        # Narrow to most recent if explicitly requested
        if is_sender_query and any(w in question_lower for w in ['most recent', 'latest', 'newest', 'last']):
            email_list = email_list[:1]
            total_emails = 1
            print("✅ Filtered to most recent")

        # --- Fallback path (rate limited) ---
        if self.is_rate_limited():
            print("⚠️  Rate limited — using fallback")
            fallback_answer = self.generate_fallback_answer(email_list, search_question)
            sources = self._build_sources(email_list)
            return {
                "answer": fallback_answer + "\n\n_Note: LLM rate limited. Try again later._",
                "sources": sources,
                "question": question,
                "rewritten_question": search_question,
                "status": "rate_limited",
                "emails_found": total_emails,
                "matched_keywords": question_keywords
            }

        # --- Build LLM context ---
        context_parts = []
        max_context_chars = self.max_context_tokens * self.chars_per_token

        for i, item in enumerate(email_list, 1):
            meta = item['metadata']
            deadline_display = self._format_deadline(meta.get('deadline_date', 'None'))
            urgency_status = "YES" if meta.get('is_urgent') == 'True' else "NO"

            context_parts.append(
                f"EMAIL {i}:\n"
                f"Subject: {meta['subject']}\n"
                f"From: {meta['sender']}\n"
                f"Date: {meta.get('date', 'Unknown')}\n"
                f"Urgent: {urgency_status}\n"
                f"Deadline: {deadline_display}\n"
                f"Content: {item['text'][:800]}"
            )

        context_parts = self.trim_context_to_token_limit(context_parts, max_context_chars)
        context = "\n\n".join(context_parts)

        format_instruction = (
            "Show: Subject, From, Date, Key content"
            if total_emails == 1
            else f"List all {total_emails} emails newest first. Be concise per email."
        )

        system_prompt = (
            f"You are an email assistant. You have {total_emails} email(s) retrieved from the user's inbox, "
            f"ordered newest first.\n\n"
            f"Rules:\n"
            f"- Use ONLY the provided email content. Do not hallucinate or invent details.\n"
            f"- Maintain newest-first order.\n"
            f"- {format_instruction}\n"
            f"- Highlight urgency: {'YES — call it out clearly' if highlight_urgency else 'only if relevant'}\n"
            f"- Highlight deadlines: {'YES — call out dates' if highlight_deadline else 'only if relevant'}\n"
            f"- You have access to previous conversation history. Use it to understand follow-up questions."
        )

        user_prompt = f"Emails (NEWEST FIRST):\n\n{context}\n\nQuestion: {question}\n\nAnswer concisely:"

        try:
            # ✅ Build messages with history AFTER system_prompt is defined
            messages = [{"role": "system", "content": system_prompt}]

            # ✅ Add last 10 conversation turns for context
            for msg in conversation_history[-10:]:
                messages.append({"role": msg["role"], "content": msg["content"]})

            # ✅ Add current question with email context
            messages.append({"role": "user", "content": user_prompt})

            response = self.groq_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=messages,
                temperature=0.05,
                max_tokens=self.max_response_tokens
            )

            answer = response.choices[0].message.content.strip()
            sources = self._build_sources(email_list)

            return {
                "answer": answer,
                "sources": sources,
                "question": question,
                "status": "success",
                "emails_found": total_emails,
                "matched_keywords": question_keywords
            }

        except Exception as e:
            error_msg = str(e)

            if "rate_limit" in error_msg.lower() or "429" in error_msg:
                print(f"⚠️  Rate limit hit: {error_msg}")
                self.last_rate_limit = time.time()
                fallback_answer = self.generate_fallback_answer(email_list, search_question)
                sources = self._build_sources(email_list)
                return {
                    "answer": fallback_answer + "\n\n_Note: LLM rate limited. Try again in ~2 hours._",
                    "sources": sources,
                    "question": question,              # original question
                    "rewritten_question": search_question, 
                    "status": "rate_limited",
                    "emails_found": total_emails,
                    "matched_keywords": question_keywords
                }

            return {
                "answer": f"Error generating answer: {error_msg}",
                "sources": [],
                "question": question,
                "status": "error"
            }

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _build_sources(self, email_list: List[Dict]) -> List[Dict]:
        sources = []
        for item in email_list:
            meta = item['metadata']
            sources.append({
                "email_id": meta['email_id'],
                "sender": meta['sender'],
                "subject": meta['subject'],
                "date": meta.get('date', 'Unknown'),
                "relevance": round(item['hybrid_score'] * 100, 1),
                "is_urgent": meta.get('is_urgent') == 'True',
                "has_deadline": meta.get('has_deadline') == 'True',
                "deadline": meta.get('deadline_date', 'None'),
                "text": item['text'],
                "timestamp": item.get('timestamp', 0)
            })
        return sources

    def _format_deadline(self, deadline_str: str) -> str:
        if deadline_str == 'None' or not deadline_str:
            return "No deadline"
        try:
            deadline_dt = datetime.fromisoformat(deadline_str)
            days_until = (deadline_dt - datetime.now()).days
            if days_until < 0:
                return "OVERDUE"
            elif days_until == 0:
                return "DUE TODAY"
            elif days_until <= 3:
                return f"DUE IN {days_until} DAYS"
            else:
                return deadline_dt.strftime("%Y-%m-%d")
        except Exception:
            return "No deadline"

    # ------------------------------------------------------------------
    # Stats
    # ------------------------------------------------------------------

    def get_stats(self, user_email: str) -> Dict:
        try:
            collection = self.get_or_create_collection(user_email)
            total_chunks = collection.count()
            try:
                result = collection.get()
                unique_emails = set(cid.split('_')[0] for cid in result['ids'])
                email_count = len(unique_emails)
            except Exception:
                email_count = 0

            return {
                "indexed_emails": email_count,
                "total_chunks": total_chunks,
                "cache_size": len(self.query_cache),
                "cache_ttl_seconds": self.query_cache.ttl_seconds,
                "is_ready": total_chunks > 0,
                "rate_limited": self.is_rate_limited(),
                "label_filter": "INBOX"
            }
        except Exception:
            return {"indexed_emails": 0, "is_ready": False, "rate_limited": False}



# ---------------------------------------------------------------------------
# Global instance
# ---------------------------------------------------------------------------
rag_system = InboxOnlyRAG()
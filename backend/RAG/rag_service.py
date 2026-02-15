"""
COMPLETE RAG System - INBOX ONLY
✅ All methods included
✅ Only indexes emails with INBOX label
✅ Filters out promotions, social, updates, spam
✅ Uses improved sender matching
"""

import os
import re
import hashlib
from typing import List, Dict, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from concurrent.futures import ThreadPoolExecutor, as_completed
import time

import chromadb
from sentence_transformers import SentenceTransformer
from groq import Groq

from backend.db.models import Email, User


class InboxOnlyRAG:
    """RAG system that only indexes INBOX emails."""

    def __init__(self):
        print("\n🚀 Initializing INBOX-ONLY RAG System...")
        
        self.chroma_client = chromadb.PersistentClient(path="./chroma_db")
        self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        self.groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        
        self.max_context_tokens = 3000
        self.max_response_tokens = 800
        self.chars_per_token = 4
        
        self.last_rate_limit = None
        self.rate_limit_cooldown = 7200
        
        self.chunk_size = 800
        self.query_cache = {}
        print("✅ INBOX-ONLY RAG ready!\n")

    def is_rate_limited(self) -> bool:
        """Check if we're in a rate limit cooldown."""
        if self.last_rate_limit is None:
            return False
        
        elapsed = time.time() - self.last_rate_limit
        return elapsed < self.rate_limit_cooldown

    def get_collection_name(self, user_email: str) -> str:
        return f"emails_inbox_{user_email.replace('@', '_').replace('.', '_')}"

    def get_or_create_collection(self, user_email: str):
        collection_name = self.get_collection_name(user_email)
        try:
            return self.chroma_client.get_collection(name=collection_name)
        except:
            return self.chroma_client.create_collection(
                name=collection_name,
                metadata={"user_email": user_email, "label_filter": "INBOX"}
            )

    def is_inbox_email(self, email: Email) -> bool:
        """Check if email is from INBOX."""
        if hasattr(email, 'labels') and email.labels:
            labels = email.labels.split(',')
            has_inbox = 'INBOX' in labels
            
            if not has_inbox:
                print(f"  ⏭️  Skipping non-INBOX email: {labels}")
            
            return has_inbox
        
        if not hasattr(email, 'labels'):
            print("⚠️  Warning: Email model doesn't have 'labels' field. Add it to filter by INBOX!")
        
        return True

    def extract_deadline(self, text: str) -> Optional[datetime]:
        """Extract deadlines from text."""
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
                except:
                    pass
        
        if any(word in text_lower for word in ['urgent', 'asap', 'immediately']):
            return datetime.now()
        
        return None

    def normalize_name(self, name: str) -> str:
        """Normalize a name for comparison."""
        normalized = re.sub(r'[^a-z0-9\s]', '', name.lower())
        normalized = ' '.join(normalized.split())
        return normalized

    def extract_name_parts(self, sender: str) -> Tuple[str, str, str]:
        """Extract name parts from sender field."""
        sender_lower = sender.lower()
        
        email_match = re.search(r'([a-z0-9._-]+@[a-z0-9.-]+)', sender_lower)
        email_address = email_match.group(1) if email_match else ""
        
        email_username = ""
        if email_address:
            username_match = re.match(r'([^@]+)@', email_address)
            if username_match:
                email_username = username_match.group(1)
                email_username = re.sub(r'[._-]', ' ', email_username)
        
        full_name = ""
        name_match = re.match(r'^([^<]+)\s*<', sender_lower)
        if name_match:
            full_name = name_match.group(1).strip()
        elif not email_address:
            full_name = sender_lower.strip()
        
        full_name = self.normalize_name(full_name) if full_name else ""
        email_username = self.normalize_name(email_username) if email_username else ""
        
        return full_name, email_address, email_username

    def sender_matches(self, sender: str, search_term: str) -> bool:
        """Check if sender matches the search term."""
        search_term = search_term.lower().strip()
        search_normalized = self.normalize_name(search_term)
        
        full_name, email_address, email_username = self.extract_name_parts(sender)
        
        if search_term in email_address:
            return True
        
        if search_normalized in full_name:
            return True
        
        if search_normalized in email_username:
            return True
        
        if full_name:
            name_words = full_name.split()
            if search_normalized in name_words:
                return True
            
            name_concat = ''.join(name_words)
            if search_normalized.replace(' ', '') in name_concat:
                return True
        
        if len(search_normalized) >= 5:
            matches = sum(1 for c in search_normalized if c in sender.lower())
            match_ratio = matches / len(search_normalized)
            if match_ratio >= 0.8:
                return True
        
        return False

    def chunk_text(self, text: str, email_id: int) -> List[tuple]:
        """Smart chunking."""
        if len(text) <= self.chunk_size:
            return [(text, 0)]
        
        chunks = []
        for i in range(0, len(text), self.chunk_size):
            chunk = text[i:i + self.chunk_size]
            chunks.append((chunk, i // self.chunk_size))
        
        return chunks

    def process_email_batch(self, emails: List[Email]) -> tuple:
        """Process batch for parallel indexing - INBOX ONLY."""
        documents, metadatas, ids = [], [], []
        
        for email in emails:
            if not self.is_inbox_email(email):
                continue
            
            email_body = email.body or email.snippet or ""
            text = f"FROM: {email.sender}\nSUBJECT: {email.subject}\nDATE: {email.date}\n\n{email_body}"
            
            deadline = self.extract_deadline(text)
            text_lower = text.lower()
            is_urgent = any(word in text_lower for word in ['urgent', 'asap', 'immediately', 'critical'])
            has_deadline = 'deadline' in text_lower or 'due' in text_lower
            
            chunks = self.chunk_text(text, email.id)
            
            for chunk_text, chunk_idx in chunks:
                try:
                    timestamp = email.date.timestamp() if email.date else datetime.now().timestamp()
                except:
                    timestamp = datetime.now().timestamp()
                
                try:
                    is_read = email.is_read if hasattr(email, 'is_read') else False
                except:
                    is_read = False
                
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

    def index_user_emails(self, db: Session, user_email: str) -> Dict:
        """Index INBOX emails only."""
        start_time = time.time()
        
        print(f"\n📊 Indexing INBOX emails for {user_email}...")
        
        user = db.query(User).filter(User.email == user_email).first()
        if not user:
            raise ValueError("User not found")

        print(f"📧 Fetching emails from database...")
        
        all_emails = []
        batch_size = 200
        offset = 0
        
        while True:
            query = db.query(Email).filter(Email.user_id == user.id)
            
            if hasattr(Email, 'labels'):
                query = query.filter(Email.labels.like('%INBOX%'))
                print(f"  🔍 Filtering by INBOX label in database query")
            
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
            existing_email_ids = set(chunk_id.split('_')[0] for chunk_id in existing_result['ids'])
            print(f"📦 Already indexed: {len(existing_email_ids)}")
        except:
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

        email_batches = [new_emails[i:i+50] for i in range(0, len(new_emails), 50)]
        
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
            return {
                "status": "warning",
                "message": "No INBOX emails to index",
                "email_count": 0,
                "new_emails": 0
            }

        print(f"🔄 Generating embeddings for {len(all_documents)} chunks...")
        
        embeddings = self.embedding_model.encode(
            all_documents,
            convert_to_numpy=True,
            show_progress_bar=True,
            batch_size=64
        )

        print(f"💾 Storing in ChromaDB...")
        collection.add(
            embeddings=embeddings.tolist(),
            documents=all_documents,
            metadatas=all_metadatas,
            ids=all_ids
        )

        elapsed = time.time() - start_time
        print(f"✅ Indexed {len(new_emails)} INBOX emails in {elapsed:.1f}s\n")

        return {
            "status": "success",
            "message": f"Indexed {len(new_emails)} INBOX emails in {elapsed:.1f}s",
            "email_count": len(existing_email_ids) + len(new_emails),
            "new_emails": len(new_emails),
            "time_seconds": elapsed
        }

    def expand_query(self, query: str) -> str:
        """Query expansion."""
        query_lower = query.lower()
        
        if 'urgent' in query_lower:
            return query + " asap immediate critical"
        elif 'deadline' in query_lower:
            return query + " due date"
        elif 'meeting' in query_lower:
            return query + " schedule appointment call"
        
        return query

    def detect_sender_from_query(self, query: str) -> Optional[str]:
        """Detect if query is asking for emails from a specific sender."""
        query_lower = query.lower()
        
        is_sender_query = any(phrase in query_lower for phrase in [
            'from ', 'by ', 'sender ', 'sent by', 'emails from', 'email from'
        ])
        
        if not is_sender_query:
            return None
        
        stop_words = {'from', 'the', 'email', 'emails', 'show', 'give', 'me', 
                     'most', 'recent', 'latest', 'newest', 'all', 'list', 'by',
                     'sender', 'sent', 'what', 'are', 'is', 'was', 'were', 'have',
                     'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
                     'should', 'may', 'might', 'can', 'any', 'there', 'meeting'}
        
        words = query_lower.split()
        sender_keywords = [w for w in words if len(w) > 2 and w not in stop_words]
        
        if sender_keywords:
            print(f"🔍 Detected sender: '{sender_keywords[0]}'")
            return sender_keywords[0]
        
        return None

    def hybrid_search(self, user_email: str, query: str, top_k: int = 20, 
                     sender_filter: str = None) -> List[Dict]:
        """Search INBOX emails only."""
        
        cache_key = hashlib.md5(f"{user_email}:{query}:{sender_filter}".encode()).hexdigest()
        if cache_key in self.query_cache:
            return self.query_cache[cache_key]
        
        collection = self.get_or_create_collection(user_email)
        if collection.count() == 0:
            print("⚠️  No INBOX emails indexed")
            return []

        expanded_query = self.expand_query(query)
        query_embedding = self.embedding_model.encode([expanded_query])[0].tolist()
        
        if sender_filter:
            n_results = min(1000, collection.count())
            print(f"🔍 Searching {n_results} INBOX emails for sender '{sender_filter}'")
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
                if not self.sender_matches(sender, sender_filter):
                    skipped_count += 1
                    continue
                matched_count += 1
            
            semantic_score = max(0, 1 - distance)
            
            doc_lower = doc.lower()
            sender_lower = sender.lower()
            subject_lower = metadata.get('subject', '').lower()
            
            keyword_matches = sum(1 for kw in query_keywords 
                                 if kw in doc_lower or kw in sender_lower or kw in subject_lower)
            keyword_score = min(1.0, keyword_matches / max(len(query_keywords), 1))
            
            try:
                timestamp = float(metadata.get('timestamp', 0))
            except:
                timestamp = 0
            
            urgency_boost = 0.10 if metadata.get('is_urgent') == 'True' else 0
            deadline_boost = 0.10 if metadata.get('has_deadline') == 'True' else 0
            
            if sender_filter:
                hybrid_score = (
                    0.40 * semantic_score +
                    0.40 * keyword_score +
                    urgency_boost +
                    deadline_boost
                )
            else:
                hybrid_score = (
                    0.35 * semantic_score +
                    0.45 * keyword_score +
                    urgency_boost +
                    deadline_boost
                )
            
            scored_results.append({
                "text": doc,
                "metadata": metadata,
                "hybrid_score": hybrid_score,
                "timestamp": timestamp
            })

        if sender_filter:
            print(f"📊 Matched {matched_count}, skipped {skipped_count}")

        seen_emails = {}
        for result in scored_results:
            email_id = result['metadata']['email_id']
            if email_id not in seen_emails:
                seen_emails[email_id] = result
            elif result['hybrid_score'] > seen_emails[email_id]['hybrid_score']:
                seen_emails[email_id] = result
        
        unique_results = list(seen_emails.values())
        unique_results.sort(key=lambda x: (x['timestamp'], x['hybrid_score']), reverse=True)
        
        if sender_filter:
            final_results = unique_results[:50]
        else:
            final_results = unique_results[:top_k]
        
        self.query_cache[cache_key] = final_results
        
        return final_results

    def trim_context_to_token_limit(self, context_parts: List[str], max_chars: int) -> List[str]:
        """Trim context to fit within token budget."""
        total_chars = sum(len(part) for part in context_parts)
        
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

    def generate_fallback_answer(self, email_list: List[Dict], question: str) -> str:
        """Generate answer without LLM when rate limited."""
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

    def answer_question(self, user_email: str, question: str, db: Session = None) -> Dict:
        """Generate answers with intelligent sender filtering."""
        
        question_lower = question.lower()
        
        # Detect sender BEFORE search
        sender_filter = self.detect_sender_from_query(question)
        
        is_sender_query = sender_filter is not None
        
        highlight_urgency = any(word in question_lower for word in ['urgent', 'asap', 'critical', 'immediate'])
        highlight_deadline = any(word in question_lower for word in ['deadline', 'due'])

        # Adjust top_k
        if is_sender_query:
            top_k = 50
        elif any(word in question_lower for word in ["all", "list", "show"]):
            top_k = 30
        else:
            top_k = 15

        print(f"\n🔍 Query: '{question}'")
        print(f"📧 Sender filter: {sender_filter if sender_filter else 'None'}")
        print(f"📊 Top K: {top_k}")

        # Pass sender_filter to hybrid_search
        retrieved = self.hybrid_search(user_email, question, top_k=top_k, 
                                      sender_filter=sender_filter)

        if not retrieved:
            return {
                "answer": "No relevant emails found.",
                "sources": [],
                "question": question,
                "status": "no_results",
                "matched_keywords": []
            }

        question_keywords = [w for w in question_lower.split() if len(w) > 2]
        email_list = retrieved
        total_emails = len(email_list)
        
        print(f"✅ Found {total_emails} emails")
        
        # Return only most recent if requested
        if is_sender_query and any(word in question_lower for word in ['most recent', 'latest', 'newest', 'last']):
            email_list = email_list[:1]
            total_emails = 1
            print(f"✅ Filtered to most recent")
        
        # Check rate limit
        if self.is_rate_limited():
            print("⚠️  Rate limited - using fallback")
            fallback_answer = self.generate_fallback_answer(email_list, question)
            
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
            
            return {
                "answer": fallback_answer + "\n\n_Note: LLM rate limited_",
                "sources": sources,
                "question": question,
                "status": "rate_limited",
                "emails_found": total_emails,
                "matched_keywords": question_keywords
            }
        
        # Build context
        context_parts = []
        max_context_chars = self.max_context_tokens * self.chars_per_token
        
        for i, item in enumerate(email_list, 1):
            meta = item['metadata']
            
            deadline_str = meta.get('deadline_date', 'None')
            if deadline_str != 'None':
                try:
                    deadline_dt = datetime.fromisoformat(deadline_str)
                    days_until = (deadline_dt - datetime.now()).days
                    if days_until < 0:
                        deadline_display = "OVERDUE"
                    elif days_until == 0:
                        deadline_display = "DUE TODAY"
                    elif days_until <= 3:
                        deadline_display = f"DUE IN {days_until} DAYS"
                    else:
                        deadline_display = deadline_dt.strftime("%Y-%m-%d")
                except:
                    deadline_display = "No deadline"
            else:
                deadline_display = "No deadline"
            
            urgency_status = "YES" if meta.get('is_urgent') == 'True' else "NO"
            
            context_parts.append(f"""EMAIL {i}:
Subject: {meta['subject']}
From: {meta['sender']}
Date: {meta.get('date', 'Unknown')}
Urgent: {urgency_status}
Deadline: {deadline_display}
Content: {item['text'][:400]}""")

        context_parts = self.trim_context_to_token_limit(context_parts, max_context_chars)
        context = "\n\n".join(context_parts)

        if total_emails == 1:
            format_instruction = "Show: Subject, From, Date, Key content"
        else:
            format_instruction = f"List all {total_emails} emails newest first"

        system_prompt = f"""Email assistant. You have {total_emails} email(s), newest first.

Rules:
- Use ONLY provided info
- Keep newest-first order
- {format_instruction}
- Highlight urgency: {"YES" if highlight_urgency else "NO"}
- Highlight deadlines: {"YES" if highlight_deadline else "NO"}"""

        user_prompt = f"""Emails (NEWEST FIRST):

{context}

Question: {question}

Answer concisely."""

        try:
            response = self.groq_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.05,
                max_tokens=self.max_response_tokens
            )

            answer = response.choices[0].message.content.strip()

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
                print(f"⚠️  Rate limit: {error_msg}")
                self.last_rate_limit = time.time()
                
                fallback_answer = self.generate_fallback_answer(email_list, question)
                
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
                
                return {
                    "answer": fallback_answer + "\n\n_Note: Rate limited. Try again in ~2 hours._",
                    "sources": sources,
                    "question": question,
                    "status": "rate_limited",
                    "emails_found": total_emails,
                    "matched_keywords": question_keywords
                }
            
            return {
                "answer": f"Error: {error_msg}",
                "sources": [],
                "question": question,
                "status": "error"
            }

    def get_stats(self, user_email: str) -> Dict:
        """Get INBOX email statistics."""
        try:
            collection = self.get_or_create_collection(user_email)
            total_chunks = collection.count()
            
            try:
                result = collection.get()
                unique_emails = set(chunk_id.split('_')[0] for chunk_id in result['ids'])
                email_count = len(unique_emails)
            except:
                email_count = 0

            return {
                "indexed_emails": email_count,
                "total_chunks": total_chunks,
                "cache_size": len(self.query_cache),
                "is_ready": total_chunks > 0,
                "rate_limited": self.is_rate_limited(),
                "label_filter": "INBOX"
            }
        except:
            return {"indexed_emails": 0, "is_ready": False, "rate_limited": False}


# Global instance - INBOX ONLY
rag_system = InboxOnlyRAG()
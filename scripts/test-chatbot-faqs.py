"""Content and retrieval regression check for the public FAQ knowledge base."""
import json
import re
import unicodedata
from pathlib import Path

faqs = json.loads(Path("src/data/geetaJayantiFaqs.json").read_text(encoding="utf-8"))
assert len(faqs) == 80
assert [faq["id"] for faq in faqs] == list(range(1, 81))
required = {"id", "category", "question_en", "answer_en", "question_hi", "answer_hi", "keywords", "related_questions", "updated_at"}
assert all(required <= faq.keys() and faq["answer_en"].strip() and faq["answer_hi"].strip() for faq in faqs)

stop = {"the", "for", "and", "can", "how", "what", "when", "where", "is", "are", "hai", "ka", "ki", "ko", "kya", "kaise", "kab", "hoga", "mera", "meri", "mein"}
def words(value):
    value = "".join(c for c in unicodedata.normalize("NFKD", value.lower()) if not unicodedata.combining(c))
    return [word for word in re.sub(r"[^\w\s]", " ", value).split() if len(word) > 1 and word not in stop]

def edit_one(a, b):
    if abs(len(a) - len(b)) > 1:
        return False
    i = j = edits = 0
    while i < len(a) and j < len(b):
        if a[i] == b[j]:
            i += 1; j += 1; continue
        edits += 1
        if edits > 1: return False
        if len(a) > len(b): i += 1
        elif len(b) > len(a): j += 1
        else: i += 1; j += 1
    return edits + int(i < len(a) or j < len(b)) <= 1

def best(query):
    source = words(query)
    scored = []
    for faq in faqs:
        target = words(" ".join([faq["question_en"], faq["question_hi"], *faq["keywords"]]))
        target_set = set(target)
        hits = sum(1 if token in target_set else .65 if len(token) >= 5 and any(len(item) >= 5 and edit_one(token, item) for item in target) else 0 for token in source)
        exact_en = " ".join(source) == " ".join(words(faq["question_en"]))
        exact_hi = " ".join(source) == " ".join(words(faq["question_hi"]))
        score = hits / max(1, min(len(source), 5)) + (1 if exact_en or exact_hi else 0)
        scored.append((score, faq["id"]))
    return max(scored)

for faq in faqs:
    score, found = best(faq["question_en"])
    assert found == faq["id"] and score >= .34, (faq["id"], found, score)
    score, found = best(faq["question_hi"])
    assert found == faq["id"] and score >= .34, ("Hindi", faq["id"], found, score)

for query in [
    "Mera registration kaise hoga?",
    "quiz mein kitne marks milenge",
    "OTP nahi aa raha, kya karun?",
    "How can I regster for Geeta Jayanti?",
    "When will the Mahotsav take place?",
    "गीता जयंती महोत्सव 2026 कब आयोजित होगा?",
    "क्विज़ में कितने प्रश्न होंगे?",
]:
    score, faq_id = best(query)
    assert score >= .34, (query, score, faq_id)

print("FAQ checks passed: all 80 English and Hindi questions retrieve their FAQ; 7 additional English/Hindi/Hinglish samples retrieve event answers.")

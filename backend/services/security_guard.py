"""
Security Guard — lightweight, zero-latency protections
────────────────────────────────────────────────────────
Covers:  prompt injection, data poisoning, memory manipulation, tool misuse.
Design:  pure regex/string ops — no LLM calls, no network I/O, <1 ms per check.
"""

from __future__ import annotations
import re
import logging
import time
from collections import defaultdict
from typing import Optional

logger = logging.getLogger(__name__)

# ══════════════════════════════════════════════════════════════════════════════
# 1.  PROMPT INJECTION DETECTION
# ══════════════════════════════════════════════════════════════════════════════

# Patterns that attempt to override system instructions
_INJECTION_PATTERNS: list[re.Pattern] = [
    re.compile(p, re.IGNORECASE | re.DOTALL)
    for p in [
        # Direct overrides
        r"ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|rules?|prompts?|context)",
        r"disregard\s+(all\s+)?(previous|prior|above|earlier)",
        r"forget\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|rules?|prompts?)",
        r"override\s+(system|safety|security)\s*(prompt|instructions?|rules?|settings?)",
        # Role hijacking
        r"you\s+are\s+now\s+(in\s+)?(a\s+)?(debug|admin|developer|root|sudo|test|unrestricted|jailbreak)\s*(mode)?",
        r"switch\s+to\s+(debug|admin|developer|root|unrestricted|jailbreak)\s*(mode)?",
        r"enter\s+(debug|admin|developer|root|sudo|maintenance)\s*(mode)?",
        r"act\s+as\s+(a\s+)?(system|admin|root|developer|hacker)",
        # System prompt exfiltration
        r"(output|print|show|reveal|display|repeat|echo)\s+(your|the)\s+(system|internal|hidden)\s*(prompt|instructions?|rules?|config)",
        r"what\s+(are|is)\s+your\s+(system|internal|hidden)\s*(prompt|instructions?|rules?|config)",
        # Delimiter injection
        r"\[/?SYSTEM\s*(OVERRIDE|MODE|PROMPT)?\]",
        r"\[/?INST(RUCTION)?\]",
        r"\[/?END_?(OF_?)?(INSTRUCTIONS?|RULES?|CONTEXT|PROMPT|KB)\]",
        r"<\|?(system|im_start|im_end|endoftext|assistant)\|?>",
        # New instruction injection
        r"new\s+(system\s+)?(instruction|rule|directive|command)\s*:",
        r"(INSTRUCTION|DIRECTIVE|COMMAND)\s*SET\s*:",
    ]
]

# Score threshold — matches are weighted so single casual word won't trigger
_INJECTION_THRESHOLD = 2


def detect_prompt_injection(text: str) -> tuple[bool, list[str]]:
    """
    Fast regex scan for prompt injection patterns.
    Returns (is_injection, list_of_matched_pattern_descriptions).
    Runs in <0.5 ms on typical inputs.
    """
    if not text or len(text) < 10:
        return False, []

    matches: list[str] = []
    score = 0
    for pat in _INJECTION_PATTERNS:
        if pat.search(text):
            matches.append(pat.pattern[:60])
            score += 1

    flagged = score >= _INJECTION_THRESHOLD
    if flagged:
        logger.warning("🛡️ Prompt injection detected (score=%d): %s", score, matches)
    return flagged, matches


def sanitize_user_message(text: str, max_length: int = 2000) -> str:
    """
    Sanitize user input:
    - Enforce max length
    - Strip control characters (keep newlines/tabs)
    - Neutralize delimiter patterns that could break prompt structure
    """
    if not text:
        return ""
    # Enforce max length
    text = text[:max_length]
    # Strip non-printable control chars (preserve \n \t \r)
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
    # Neutralize bracket-based delimiters that mimic system tokens
    text = re.sub(r'\[/?(SYSTEM|INST|END_?INSTRUCTIONS?|END_?CONTEXT|END_?KB|END_?RULES)\]',
                  '[filtered]', text, flags=re.IGNORECASE)
    text = re.sub(r'<\|?(system|im_start|im_end|endoftext|assistant)\|?>',
                  '<filtered>', text, flags=re.IGNORECASE)
    return text.strip()


# ══════════════════════════════════════════════════════════════════════════════
# 2.  DATA POISONING FILTER  (for KB uploads / manual entries)
# ══════════════════════════════════════════════════════════════════════════════

_POISON_PATTERNS: list[re.Pattern] = [
    re.compile(p, re.IGNORECASE | re.DOTALL)
    for p in [
        # Injected "new instructions"
        r"(NEW|OVERRIDE|REPLACE)\s*(INSTRUCTION|RULE|DIRECTIVE|SYSTEM|PROMPT)\s*:",
        r"\[/?(SYSTEM|INST|END_?INSTRUCTIONS?)\]",
        r"<\|?(system|im_start|im_end|assistant)\|?>",
        # Role changes
        r"you\s+are\s+now\s+(in\s+)?(debug|admin|unrestricted|jailbreak)",
        r"ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|rules?|context)",
        # Social engineering prompts
        r"pretend\s+to\s+be\s+(a\s+)?(bank|doctor|lawyer|government|police)",
        r"generate\s+(a\s+)?(backdoor|exploit|malware|phishing|scam)",
        r"ask\s+(for|users?\s+for)\s+(password|ssn|social\s+security|credit\s+card|account\s+number)",
    ]
]


def scan_kb_content(text: str) -> tuple[bool, list[str]]:
    """
    Scan KB content for data poisoning attempts.
    Returns (is_poisoned, list_of_matched_patterns).
    """
    if not text or len(text) < 15:
        return False, []

    matches: list[str] = []
    for pat in _POISON_PATTERNS:
        if pat.search(text):
            matches.append(pat.pattern[:60])

    if matches:
        logger.warning("🧪 KB poisoning attempt detected: %s", matches)
    return bool(matches), matches


def sanitize_kb_content(text: str) -> str:
    """Neutralize injection markers in KB content without destroying data."""
    text = re.sub(r'\[/?(SYSTEM|INST|END_?INSTRUCTIONS?|END_?CONTEXT|END_?KB)\]',
                  '', text, flags=re.IGNORECASE)
    text = re.sub(r'<\|?(system|im_start|im_end|endoftext|assistant)\|?>',
                  '', text, flags=re.IGNORECASE)
    return text


# ══════════════════════════════════════════════════════════════════════════════
# 3.  MEMORY / CONVERSATION HISTORY VALIDATION
# ══════════════════════════════════════════════════════════════════════════════

_VALID_ROLES = {"user", "assistant", "agent"}


def validate_conversation_history(
    history: list,
    max_turns: int = 20,
    max_msg_len: int = 2000,
) -> list[dict]:
    """
    Validate and sanitize client-sent conversation history.
    - Only allow 'user' and 'assistant' roles (block 'system', 'admin', etc.)
    - Enforce max turns and per-message length
    - Strip injection attempts from historic messages
    """
    if not isinstance(history, list):
        return []

    clean: list[dict] = []
    for item in history[-max_turns:]:  # Keep only last N turns
        if not isinstance(item, dict):
            continue

        role = str(item.get("role", "")).lower().strip()
        content = str(item.get("content", "")).strip()

        # Only allow valid roles — block 'system', 'admin', etc.
        if role not in _VALID_ROLES:
            logger.warning("🛡️ Blocked forged history role: %s", role)
            continue

        # Normalize 'agent' to 'assistant'
        if role == "agent":
            role = "assistant"

        # Enforce per-message length
        content = content[:max_msg_len]

        # Sanitize content against injection
        content = sanitize_user_message(content, max_length=max_msg_len)

        if content:
            clean.append({"role": role, "content": content})

    return clean


# ══════════════════════════════════════════════════════════════════════════════
# 4.  RATE LIMITER  (in-memory, per-IP, sliding window)
# ══════════════════════════════════════════════════════════════════════════════

class RateLimiter:
    """
    Lightweight in-memory sliding-window rate limiter.
    No external deps (Redis etc.) — suitable for single-instance deployments.
    """

    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window = window_seconds
        self._hits: dict[str, list[float]] = defaultdict(list)

    def is_allowed(self, key: str) -> bool:
        now = time.monotonic()
        cutoff = now - self.window
        # Prune old entries
        self._hits[key] = [t for t in self._hits[key] if t > cutoff]
        if len(self._hits[key]) >= self.max_requests:
            return False
        self._hits[key].append(now)
        return True


# Pre-configured limiters for different endpoints
login_limiter = RateLimiter(max_requests=10, window_seconds=60)      # 10/min per IP
chat_limiter = RateLimiter(max_requests=30, window_seconds=60)       # 30/min per IP
upload_limiter = RateLimiter(max_requests=10, window_seconds=300)    # 10/5min per IP


# ══════════════════════════════════════════════════════════════════════════════
# 5.  FILE UPLOAD VALIDATION
# ══════════════════════════════════════════════════════════════════════════════

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_EXTENSIONS = {"csv", "pdf", "xlsx", "xls", "txt", "json", "md"}


def validate_upload(filename: str, file_bytes: bytes) -> tuple[bool, str]:
    """
    Validate uploaded file:
    - Check extension whitelist
    - Enforce size limit
    Returns (is_valid, error_message).
    """
    if len(file_bytes) > MAX_UPLOAD_SIZE:
        return False, f"File too large ({len(file_bytes)//1024//1024}MB). Max: {MAX_UPLOAD_SIZE//1024//1024}MB"

    ext = filename.lower().rsplit('.', 1)[-1] if '.' in filename else ''
    if ext not in ALLOWED_EXTENSIONS:
        return False, f"File type '.{ext}' not allowed. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"

    return True, ""


# ══════════════════════════════════════════════════════════════════════════════
# 6.  PROMPT ARMORING  (wrap user input so LLM treats it as data, not instructions)
# ══════════════════════════════════════════════════════════════════════════════

def armor_user_input(text: str) -> str:
    """Wrap user input in delimiters that tell the LLM to treat it as data."""
    return f"<user_message>\n{text}\n</user_message>"


def armor_kb_context(text: str) -> str:
    """Wrap KB context in delimiters to isolate it from instructions."""
    return f"<knowledge_base_context>\n{text}\n</knowledge_base_context>"


def armor_history(text: str) -> str:
    """Wrap conversation history in delimiters."""
    return f"<conversation_history>\n{text}\n</conversation_history>"

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

STAGE1_MODEL_DIR = Path(os.getenv("STAGE1_MODEL_DIR", str(BASE_DIR / "models" / "dark_pattern_stage1_binary")))
STAGE2_MODEL_DIR = Path(os.getenv("STAGE2_MODEL_DIR", str(BASE_DIR / "models" / "dark_pattern_stage2_category")))
BINARY_THRESHOLD = float(os.getenv("BINARY_THRESHOLD", "0.5"))
CATEGORY_THRESHOLD = float(os.getenv("CATEGORY_THRESHOLD", "0.0"))
MAX_SEQ_LENGTH = int(os.getenv("MAX_SEQ_LENGTH", "128"))
ALLOWED_ORIGINS = [origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "*").split(",") if origin.strip()]
DEVICE = os.getenv("DEVICE", "cpu").strip().lower()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
GROQ_TIMEOUT_SECONDS = float(os.getenv("GROQ_TIMEOUT_SECONDS", "8"))
ENABLE_LLM_VERIFICATION = bool(GROQ_API_KEY)
REJECTED_LOG_VALUE = os.getenv("REJECTED_LOG_PATH", "").strip()
REJECTED_LOG_PATH = Path(REJECTED_LOG_VALUE) if REJECTED_LOG_VALUE else None

if not 0.0 <= BINARY_THRESHOLD <= 1.0:
    raise ValueError("BINARY_THRESHOLD must be between 0 and 1")
if not 0.0 <= CATEGORY_THRESHOLD <= 1.0:
    raise ValueError("CATEGORY_THRESHOLD must be between 0 and 1")
if MAX_SEQ_LENGTH < 1:
    raise ValueError("MAX_SEQ_LENGTH must be positive")
if GROQ_TIMEOUT_SECONDS <= 0:
    raise ValueError("GROQ_TIMEOUT_SECONDS must be positive")
if DEVICE not in {"cpu", "cuda"}:
    raise ValueError("DEVICE must be 'cpu' or 'cuda'")


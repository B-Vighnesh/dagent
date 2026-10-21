# Dark Pattern Detector API

FastAPI service wrapping the two-stage DistilBERT pipeline (binary dark-pattern
filter -> category classifier) trained in `dark_pattern_training.ipynb`.

## 1. Add your trained models

Unzip `dark_pattern_models.zip` (downloaded from the Colab notebook) so the
folder looks like:

```
dark_pattern_api/
├── models/
│   ├── dark_pattern_stage1_binary/
│   │   ├── config.json
│   │   ├── model.safetensors
│   │   ├── tokenizer.json
│   │   └── ...
│   └── dark_pattern_stage2_category/
│       ├── config.json
│       ├── model.safetensors
│       ├── label_map.json
│       └── ...
```

## 2. Run locally (no Docker)

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm

uvicorn app.main:app --reload --port 8000
```

Visit `http://localhost:8000/docs` for interactive Swagger UI.

## 3. Run with Docker

```bash
docker build -t dark-pattern-api .
docker run -p 8000:8000 dark-pattern-api
```

## 4. Example request

```bash
curl -X POST http://localhost:8000/detect \
  -H "Content-Type: application/json" \
  -d '{
    "page_url": "https://example.com/product/123",
    "viewport_width": 1440,
    "viewport_height": 900,
    "blocks": [
      {"block_id": "h1_0", "tag": "h1", "text": "Premium Wireless Headphones"},
      {"block_id": "p_3", "tag": "p", "text": "Only 2 left in stock! 14 people are viewing this item right now."}
    ]
  }'
```

Response:

```json
{
  "results": [
    {"block_id": "h1_0", "source_text": "Premium Wireless Headphones", "detections": []},
    {
      "block_id": "p_3",
      "source_text": "Only 2 left in stock! 14 people are viewing this item right now.",
      "detections": [
        {"sentence": "Only 2 left in stock!", "category": "Scarcity", "confidence": 0.94, "binary_confidence": 0.97, "start_offset": 0, "end_offset": 22},
        {"sentence": "14 people are viewing this item right now.", "category": "Social Proof", "confidence": 0.88, "binary_confidence": 0.91, "start_offset": 23, "end_offset": 67}
      ]
    }
  ],
  "total_detections": 2
}
```

## 5. Config

Set via environment variables (see `app/config.py`):

| Variable | Default | Purpose |
|---|---|---|
| `STAGE1_MODEL_DIR` | `./models/dark_pattern_stage1_binary` | binary model path |
| `STAGE2_MODEL_DIR` | `./models/dark_pattern_stage2_category` | category model path |
| `BINARY_THRESHOLD` | `0.5` | min probability to flag a sentence as dark pattern |
| `CATEGORY_THRESHOLD` | `0.0` | min confidence to report a category |
| `ALLOWED_ORIGINS` | `*` | comma-separated CORS origins; set to your extension id in prod |
| `DEVICE` | `cpu` | set to `cuda` if deploying on GPU |
| `GROQ_API_KEY` | *(unset)* | enables Stage 3 LLM verification; get a free key at https://console.groq.com |
| `GROQ_MODEL` | `llama-3.1-8b-instant` | Groq free-tier fast model |
| `GROQ_TIMEOUT_SECONDS` | `8` | per-request timeout before failing open |
| `REJECTED_LOG_PATH` | `./data/rejected_detections.jsonl` | where LLM-rejected detections get logged for future retraining |

## 6. Stage 3 — Groq verification (optional, cascade's third layer)

If `GROQ_API_KEY` is set, every request that has ML-flagged detections (Stage 1 + 2)
gets a single batched call to Groq before the response goes out — not one
call per sentence. Each detection comes back with one of three verdicts:

| Verdict | Shown to user? | Color | Notes |
|---|---|---|---|
| `confirmed` | Yes | Red | Groq agrees it's a genuine dark pattern |
| `partial` | Yes | Orange | Ambiguous/borderline — includes a short `llm_reasoning` string |
| `rejected` | **No** | — | Groq disagrees entirely; dropped from the response and appended to `REJECTED_LOG_PATH` as a JSONL record for future retraining |

**Fail-open by design**: if `GROQ_API_KEY` is unset, or Groq times out /
errors / returns something unparseable, every detection in that batch is
marked `unverified` and still shown as red — the ML result is never hidden
just because the verification layer had a bad moment.

**No caching at this layer yet** — every ML-flagged detection gets a fresh
Groq call even if the exact same sentence was verified moments ago in a
different request. This is intentional for now (kept simple), planned to be
addressed once the rest of the pipeline is stable.

## 7. Notes / next steps

- **CORS**: `*` is fine for local dev; in production set `ALLOWED_ORIGINS` to
  your actual extension origin (`chrome-extension://<your-extension-id>`), not `*`.
- **Batching**: the `/detect` endpoint already batches all blocks scraped from
  one page into a single request; the extension should collect its scraped
  `<p>/<h1>/<h2>/<h3>` text into one call per page/scroll-event rather than
  firing one request per tag.
- **Scaling**: models are loaded once into memory at process startup (see the
  `lifespan` handler in `main.py`). If you deploy multiple uvicorn workers or
  containers, each one loads its own copy — size memory accordingly.
- **Groq cache** (planned): dedupe identical sentences across requests before
  calling Groq, same idea as the extension's client-side cache.
# Dagent API

FastAPI prototype for Dagent's two-stage text classifier. It splits each submitted block into sentences, flags possible dark patterns, and predicts a category. The optional Groq review runs only on candidates flagged by the classifiers.

The API needs trained model files, which are not stored in Git because of their size. Download them from [the model folder on Google Drive](https://drive.google.com/drive/folders/1RJFFZU4_VKOmU0d6JxKUz0t0DvrIS4ou?usp=sharing) and place the folders here:

```text
 dagent_api/
 └── models/
     ├── dark_pattern_stage1_binary/
     └── dark_pattern_stage2_category/
```

The stage 2 folder should include `label_map.json` produced by the training notebook. The API loads the models and spaCy English sentence segmenter at startup; without the weights or `en_core_web_sm`, startup will fail.

## Run locally

From `dagent_api/` in PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m spacy download en_core_web_sm
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8000
```

Add a valid Groq key to `.env` only if you want the optional review layer. Leave it empty to skip review. Never commit `.env`; it is ignored by Git. If a real key was previously committed or shared, revoke it and create a new one.

When the service starts, check `http://localhost:8000/health` or open `http://localhost:8000/docs` for the interactive API reference.

## Endpoint

`POST /detect` accepts up to 200 blocks and 50,000 combined text characters per request. Each block can contain up to 5,000 characters. The response returns detections per block with category, confidence, sentence text, and character offsets.

Example:

```json
{
  "page_url": "https://example.com/product/123",
  "viewport_width": 1440,
  "viewport_height": 900,
  "blocks": [
    {"block_id": "p_1", "tag": "p", "text": "Only 2 left in stock!"}
  ]
}
```

## Configuration

Settings are read from environment variables and `dagent_api/.env`. Defaults are listed in `.env.example`. The most useful options are:

- `STAGE1_MODEL_DIR` and `STAGE2_MODEL_DIR`: model folder paths.
- `BINARY_THRESHOLD` and `CATEGORY_THRESHOLD`: confidence cutoffs from 0 to 1.
- `DEVICE`: `cpu` or `cuda`. Selecting CUDA without an available GPU stops startup with a clear error.
- `ALLOWED_ORIGINS`: comma-separated browser origins. `*` is for local development; use explicit origins when hosted.
- `GROQ_API_KEY`, `GROQ_MODEL`, and `GROQ_TIMEOUT_SECONDS`: optional second opinion settings.
- `REJECTED_LOG_PATH`: optional path to save rejected candidate sentences. It is disabled by default because the data comes from visited pages. Enable it only when you intend to retain that text.

The extension prototype currently sends requests to `http://localhost:8000`; update its endpoint if you run the API elsewhere.

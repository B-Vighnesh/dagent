import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app import config
from app.inference import detector
from app.llm_verifier import verify_detections
from app.schemas import BlockResult, DetectRequest, DetectResponse, HealthResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("dark_pattern_api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Loading detector resources...")
    detector.load()
    logger.info("Detector ready")
    yield


app = FastAPI(title="Dagent Dark Pattern Detector API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_credentials="*" not in config.ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.get("/health", response_model=HealthResponse)
def health():
    stage1_loaded = detector.stage1_model is not None
    stage2_loaded = detector.stage2_model is not None
    return HealthResponse(
        status="ok" if detector.is_ready() else "not_ready",
        stage1_loaded=stage1_loaded,
        stage2_loaded=stage2_loaded,
        device=str(detector.device),
    )


@app.post("/detect", response_model=DetectResponse)
def detect(payload: DetectRequest):
    if not detector.is_ready():
        raise HTTPException(status_code=503, detail="Detector is not ready")

    started = time.perf_counter()
    per_block = []
    for block in payload.blocks:
        result = detector.detect(block.text)
        per_block.append((block, result["source_text"], result["detections"]))
    ml_elapsed_ms = round((time.perf_counter() - started) * 1000, 1)

    candidates = []
    for block_index, (_, _, detections) in enumerate(per_block):
        for detection in detections:
            candidates.append({
                "index": len(candidates),
                "block_idx": block_index,
                "sentence": detection["sentence"],
                "category": detection["category"],
                "confidence": detection["confidence"],
                "_original": detection,
            })

    verified = verify_detections(candidates)
    llm_elapsed_ms = round((time.perf_counter() - started) * 1000 - ml_elapsed_ms, 1)
    kept_by_block = {index: [] for index in range(len(per_block))}
    for candidate in verified:
        detection = dict(candidate["_original"])
        detection.update({
            "llm_verdict": candidate["llm_verdict"],
            "llm_reasoning": candidate["llm_reasoning"],
            "display_color": candidate["display_color"],
        })
        kept_by_block[candidate["block_idx"]].append(detection)

    results = [
        BlockResult(block_id=block.block_id, source_text=source_text, detections=kept_by_block[index])
        for index, (block, source_text, _) in enumerate(per_block)
    ]
    total = sum(len(result.detections) for result in results)
    elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
    # Avoid logging page URLs or scraped text; these may contain personal data.
    logger.info(
        "detect: blocks=%d candidates=%d returned=%d ml=%sms review=%sms total=%sms",
        len(payload.blocks), len(candidates), total, ml_elapsed_ms, llm_elapsed_ms, elapsed_ms,
    )
    return DetectResponse(results=results, total_detections=total)

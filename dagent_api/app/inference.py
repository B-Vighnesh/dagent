import json
import logging
from pathlib import Path
from typing import Any

import numpy as np
import spacy
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from app import config

logger = logging.getLogger("dagent_api")


def _softmax(logits: np.ndarray) -> np.ndarray:
    shifted = logits - np.max(logits)
    exp = np.exp(shifted)
    return exp / exp.sum()


class DarkPatternDetector:
    """Loads the sentence segmenter and both classifiers once at startup."""

    def __init__(self) -> None:
        self.device = torch.device("cpu")
        self.nlp = None
        self.tokenizer = None
        self.stage1_model = None
        self.stage2_model = None
        self.id2label: dict[int, str] = {}

    def load(self) -> None:
        if config.DEVICE == "cuda" and not torch.cuda.is_available():
            raise RuntimeError("DEVICE is set to cuda, but CUDA is not available")
        self.device = torch.device(config.DEVICE)

        stage1_dir = Path(config.STAGE1_MODEL_DIR)
        stage2_dir = Path(config.STAGE2_MODEL_DIR)
        for label, model_dir in (("Stage 1", stage1_dir), ("Stage 2", stage2_dir)):
            if not model_dir.is_dir():
                raise FileNotFoundError(f"{label} model directory not found: {model_dir}")

        self.nlp = spacy.load("en_core_web_sm")
        self.tokenizer = AutoTokenizer.from_pretrained(str(stage1_dir), local_files_only=True)
        self.stage1_model = AutoModelForSequenceClassification.from_pretrained(
            str(stage1_dir), local_files_only=True
        ).to(self.device).eval()
        self.stage2_model = AutoModelForSequenceClassification.from_pretrained(
            str(stage2_dir), local_files_only=True
        ).to(self.device).eval()

        if self.stage1_model.config.num_labels != 2:
            raise ValueError("Stage 1 model must have exactly two labels")

        label_map_path = stage2_dir / "label_map.json"
        if label_map_path.is_file():
            with label_map_path.open(encoding="utf-8") as file:
                raw_map = json.load(file)
            raw_labels = raw_map.get("id2label", raw_map)
        else:
            raw_labels = self.stage2_model.config.id2label
        self.id2label = {int(key): str(value) for key, value in raw_labels.items()}
        if not self.id2label:
            raise ValueError("Stage 2 model has no category labels")
        if max(self.id2label) >= self.stage2_model.config.num_labels or min(self.id2label) < 0:
            raise ValueError("Stage 2 label map does not match the model output labels")

        logger.info("Models loaded on %s with %d categories", self.device, len(self.id2label))

    def is_ready(self) -> bool:
        return all((self.nlp, self.tokenizer, self.stage1_model, self.stage2_model))

    def _classify(self, model: Any, sentences: list[str]) -> np.ndarray:
        encoded = self.tokenizer(
            sentences,
            truncation=True,
            max_length=config.MAX_SEQ_LENGTH,
            padding=True,
            return_tensors="pt",
            return_token_type_ids=False,
        )
        encoded = {key: value.to(self.device) for key, value in encoded.items() if key != "token_type_ids"}
        logits = model(**encoded).logits.detach().cpu().numpy()
        return np.asarray([_softmax(row) for row in logits])

    @torch.inference_mode()
    def detect(self, source_text: str) -> dict[str, Any]:
        if not self.is_ready():
            raise RuntimeError("Detector is not ready")
        doc = self.nlp(source_text)
        spans = [span for span in doc.sents if span.text.strip()]
        if not spans:
            return {"source_text": source_text, "detections": []}

        sentences = [span.text.strip() for span in spans]
        binary_probs = self._classify(self.stage1_model, sentences)
        positive_label = int(getattr(self.stage1_model.config, "dark_pattern_label_id", 1))
        if positive_label not in (0, 1):
            raise ValueError("Stage 1 dark_pattern_label_id must be 0 or 1")
        flagged = [idx for idx, probs in enumerate(binary_probs) if probs[positive_label] >= config.BINARY_THRESHOLD]

        detections = []
        if flagged:
            category_probs = self._classify(self.stage2_model, [sentences[idx] for idx in flagged])
            for local_idx, sentence_idx in enumerate(flagged):
                probs = category_probs[local_idx]
                category_id = int(np.argmax(probs))
                category_confidence = float(probs[category_id])
                if category_confidence < config.CATEGORY_THRESHOLD:
                    continue
                span = spans[sentence_idx]
                leading_space = len(span.text) - len(span.text.lstrip())
                start_offset = span.start_char + leading_space
                detections.append({
                    "sentence": sentences[sentence_idx],
                    "category": self.id2label.get(category_id, f"Category {category_id}"),
                    "confidence": round(category_confidence, 4),
                    "binary_confidence": round(float(binary_probs[sentence_idx][positive_label]), 4),
                    "start_offset": start_offset,
                    "end_offset": start_offset + len(sentences[sentence_idx]),
                })
        return {"source_text": source_text, "detections": detections}


detector = DarkPatternDetector()

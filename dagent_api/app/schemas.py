from typing import Annotated

from pydantic import BaseModel, Field, HttpUrl, model_validator


class TextBlock(BaseModel):
    block_id: Annotated[str, Field(min_length=1, max_length=128)]
    text: Annotated[str, Field(min_length=1, max_length=5000)]
    tag: Annotated[str | None, Field(max_length=16)] = None


class DetectRequest(BaseModel):
    page_url: Annotated[HttpUrl | None, Field()] = None
    viewport_width: Annotated[int | None, Field(gt=0, le=20000)] = None
    viewport_height: Annotated[int | None, Field(gt=0, le=20000)] = None
    blocks: Annotated[list[TextBlock], Field(min_length=1, max_length=200)]

    @model_validator(mode="after")
    def limit_total_text(self):
        if sum(len(block.text) for block in self.blocks) > 50000:
            raise ValueError("Combined block text must not exceed 50000 characters")
        return self


class Detection(BaseModel):
    sentence: str
    category: str
    confidence: Annotated[float, Field(ge=0, le=1)]
    binary_confidence: Annotated[float, Field(ge=0, le=1)]
    start_offset: Annotated[int, Field(ge=0)]
    end_offset: Annotated[int, Field(ge=0)]
    llm_verdict: str | None = None
    llm_reasoning: str | None = None
    display_color: str = "red"


class BlockResult(BaseModel):
    block_id: str
    source_text: str
    detections: list[Detection]


class DetectResponse(BaseModel):
    results: list[BlockResult]
    total_detections: int


class HealthResponse(BaseModel):
    status: str
    stage1_loaded: bool
    stage2_loaded: bool
    device: str

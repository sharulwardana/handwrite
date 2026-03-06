# Pydantic models for request validation

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List


class GenerateRequest(BaseModel):
    """Validation model for /api/generate/stream"""
    text: str = Field(..., min_length=1, max_length=50000)
    fontId: str = Field(default="indie_flower")
    folioId: str = Field(default="")
    folioEvenId: Optional[str] = ""
    seed: Optional[int] = None
    config: Optional[dict] = None

    @field_validator("text")
    @classmethod
    def text_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Teks tidak boleh kosong")
        return v


class PreviewRequest(BaseModel):
    """Validation model for /api/preview"""
    fontId: str = Field(default="indie_flower")
    folioId: str = Field(default="")
    text: str = Field(default="Halo Dunia, ini contoh tulisan.", max_length=60)
    fontSize: int = Field(default=60, ge=8, le=200)
    color: str = Field(default="#1a1a1a")
    wordSpacing: int = Field(default=8, ge=-20, le=100)
    leftHanded: bool = False
    writeSpeed: float = Field(default=0.5, ge=0, le=1)
    slantAngle: float = Field(default=0, ge=-45, le=45)


class AIWriterRequest(BaseModel):
    """Validation model for /api/ai-writer"""
    prompt: str = Field(..., min_length=1, max_length=5000)

    @field_validator("prompt")
    @classmethod
    def prompt_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Prompt tidak boleh kosong")
        return v


class AIExpandRequest(BaseModel):
    """Validation model for /api/ai-expand"""
    text: str = Field(..., min_length=1, max_length=20000)

    @field_validator("text")
    @classmethod
    def text_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Teks tidak boleh kosong")
        return v


class DownloadPageRequest(BaseModel):
    """Validation model for /api/download/<int:page_num>"""
    imageData: str = Field(...)


class DownloadBulkRequest(BaseModel):
    """Validation model for /api/download/zip and /api/download-pdf"""
    pages: List[dict] = Field(..., min_length=1, max_length=100)


class CacheSaveRequest(BaseModel):
    """Validation model for /api/cache/save"""
    sessionId: str = Field(..., pattern=r"^[a-zA-Z0-9_-]{8,64}$")
    pages: List[dict] = Field(..., min_length=1)

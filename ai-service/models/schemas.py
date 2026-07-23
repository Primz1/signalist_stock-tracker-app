from pydantic import BaseModel, Field
from typing import Literal


class ResearchRequest(BaseModel):
    symbol: str
    query: str = Field(default="Should I watch this stock?")
    user_id: str | None = None


class Signal(BaseModel):
    label: str
    type: Literal["bullish", "bearish", "neutral", "warning"]


class Source(BaseModel):
    title: str
    url: str | None = None
    type: Literal["news", "filing", "market", "indicator"] = "market"


class ResearchResponse(BaseModel):
    symbol: str
    summary: str
    confidence: float
    signals: list[Signal]
    sources: list[Source]

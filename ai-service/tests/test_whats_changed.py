import pytest
from models.schemas import SignalInput


SIGNALS = [
    SignalInput(kind="rsi_cross", direction="up", label="RSI above 70", detail="RSI rose from 65.2 to 72.1"),
    SignalInput(kind="volume_spike", direction="up", label="Volume spike", detail="Volume is 2.4x the average"),
]


def _fake_genai(monkeypatch, text):
    import quant.narrator.gemini as gemini

    class Model:
        def __init__(self, _name):
            pass

        def generate_content(self, _prompt):
            return type("Response", (), {"text": text})()

    monkeypatch.setenv("GEMINI_API_KEY", "test")
    monkeypatch.setattr(gemini, "genai", type("Genai", (), {"GenerativeModel": Model}))


@pytest.mark.asyncio
async def test_falls_back_to_signals_without_gemini(monkeypatch):
    from quant.narrator.gemini import narrate_changes

    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    summary, confidence = await narrate_changes("AAPL", SIGNALS)
    assert "RSI rose from 65.2 to 72.1" in summary
    assert confidence == 0.5


@pytest.mark.asyncio
async def test_keeps_summary_citing_given_numbers(monkeypatch):
    from quant.narrator.gemini import narrate_changes

    _fake_genai(monkeypatch, "RSI climbed to 72.1 while volume ran at 2.4x normal.")
    summary, confidence = await narrate_changes("AAPL", SIGNALS)
    assert summary.startswith("RSI climbed")
    assert confidence == 0.8


@pytest.mark.asyncio
async def test_rejects_summary_with_invented_numbers(monkeypatch):
    from quant.narrator.gemini import narrate_changes

    _fake_genai(monkeypatch, "AAPL is headed to 310.55 next week.")
    summary, _ = await narrate_changes("AAPL", SIGNALS)
    assert "310.55" not in summary

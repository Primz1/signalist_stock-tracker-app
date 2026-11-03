import pytest

EVIDENCE = {
    "symbol": "NVDA",
    "signal": {"title": "Bullish momentum breakout", "strength": 84, "confidence": 88, "context": "asset-specific"},
    "price": {"start": 207.18, "current": 215.88, "changePct": 4.2},
    "volume": {"relative": 2.3},
    "indicators": {"rsiBefore": 54, "rsiNow": 71},
    "levels": {"keyLevel": 214.2, "kind": "resistance"},
    "market": {"benchmark": "SPY", "benchmarkChangePct": 0.4},
    "news": [{"headline": "NVIDIA partnership", "publisher": "Reuters", "minutesBeforeStart": 7}],
}


def _fake(monkeypatch, text):
    import quant.narrator.gemini as gemini

    class Model:
        def __init__(self, _name):
            pass

        def generate_content(self, _prompt, **_kwargs):
            return type("Response", (), {"text": text})()

    monkeypatch.setenv("GEMINI_API_KEY", "test")
    monkeypatch.setattr(gemini, "genai", type("Genai", (), {"GenerativeModel": Model}))


@pytest.mark.asyncio
async def test_returns_validated_sections(monkeypatch):
    from quant.narrator.gemini import narrate_signal

    _fake(monkeypatch, '{"what_changed": "NVDA rose 4.2% on 2.3x volume, crossing 214.2.", "context": "SPY gained only 0.4%, so the move is asset-specific. News came 7 minutes before.", "watch_next": "Whether price holds above 214.2."}')
    result = await narrate_signal(EVIDENCE)
    assert result["validated"] is True
    assert result["what_changed"].startswith("NVDA rose 4.2%")


@pytest.mark.asyncio
async def test_rejects_invented_numbers(monkeypatch):
    from quant.narrator.gemini import narrate_signal

    _fake(monkeypatch, '{"what_changed": "NVDA could reach 240 next.", "context": "", "watch_next": ""}')
    assert (await narrate_signal(EVIDENCE))["validated"] is False


@pytest.mark.asyncio
async def test_rejects_advice(monkeypatch):
    from quant.narrator.gemini import narrate_signal

    _fake(monkeypatch, '{"what_changed": "NVDA rose 4.2%. Investors should buy now.", "context": "", "watch_next": ""}')
    result = await narrate_signal(EVIDENCE)
    assert result["validated"] is False
    assert result["what_changed"] == ""


@pytest.mark.asyncio
async def test_unvalidated_without_gemini(monkeypatch):
    from quant.narrator.gemini import narrate_signal

    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert (await narrate_signal(EVIDENCE))["validated"] is False

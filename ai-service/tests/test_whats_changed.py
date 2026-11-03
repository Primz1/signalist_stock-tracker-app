import asyncio
import time

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

        def generate_content(self, _prompt, **_kwargs):
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


def _fake_models(monkeypatch, replies):
    """replies maps a model name to its text, or to an Exception it raises."""
    import quant.narrator.gemini as gemini

    calls = []

    class Model:
        def __init__(self, name):
            self.name = name

        def generate_content(self, _prompt, **kwargs):
            calls.append((self.name, kwargs))
            reply = replies[self.name]
            if isinstance(reply, Exception):
                raise reply
            return type("Response", (), {"text": reply})()

    monkeypatch.setenv("GEMINI_API_KEY", "test")
    monkeypatch.setattr(gemini, "genai", type("Genai", (), {"GenerativeModel": Model}))
    monkeypatch.setattr(gemini, "GEMINI_MODEL", "primary")
    monkeypatch.setattr(gemini, "GEMINI_FALLBACK_MODEL", "backup")
    return calls


@pytest.mark.asyncio
async def test_uses_fallback_model_when_primary_fails(monkeypatch):
    from quant.narrator.gemini import narrate_changes

    calls = _fake_models(monkeypatch, {"primary": RuntimeError("503"), "backup": "RSI climbed to 72.1."})
    summary, confidence = await narrate_changes("AAPL", SIGNALS)
    assert summary == "RSI climbed to 72.1."
    assert confidence == 0.8
    assert [name for name, _ in calls] == ["primary", "backup"]


@pytest.mark.asyncio
async def test_falls_back_to_signals_when_both_models_fail(monkeypatch):
    from quant.narrator.gemini import narrate_changes

    _fake_models(monkeypatch, {"primary": RuntimeError("503"), "backup": RuntimeError("503")})
    summary, confidence = await narrate_changes("AAPL", SIGNALS)
    assert "RSI rose from 65.2 to 72.1" in summary
    assert confidence == 0.5


@pytest.mark.asyncio
async def test_disables_sdk_retries_and_sets_a_timeout(monkeypatch):
    from quant.narrator.gemini import SUMMARY_TIMEOUT_SECONDS, narrate_changes

    calls = _fake_models(monkeypatch, {"primary": "RSI climbed to 72.1.", "backup": "unused"})
    await narrate_changes("AAPL", SIGNALS)
    assert calls[0][1]["request_options"] == {"timeout": SUMMARY_TIMEOUT_SECONDS, "retry": None}


@pytest.mark.asyncio
async def test_slow_gemini_does_not_block_the_event_loop(monkeypatch):
    import quant.narrator.gemini as gemini

    class SlowModel:
        def __init__(self, _name):
            pass

        def generate_content(self, _prompt, **_kwargs):
            time.sleep(0.3)
            return type("Response", (), {"text": "done"})()

    monkeypatch.setattr(gemini, "genai", type("Genai", (), {"GenerativeModel": SlowModel}))

    ticks = 0

    async def heartbeat():
        nonlocal ticks
        while True:
            await asyncio.sleep(0.01)
            ticks += 1

    beat = asyncio.create_task(heartbeat())
    assert await gemini.generate_text("hi", timeout=5) == "done"
    beat.cancel()
    assert ticks > 5


@pytest.mark.asyncio
async def test_timed_out_model_moves_to_the_next_one(monkeypatch):
    import quant.narrator.gemini as gemini

    class Model:
        def __init__(self, name):
            self.name = name

        def generate_content(self, _prompt, **_kwargs):
            if self.name == "primary":
                time.sleep(0.4)
            return type("Response", (), {"text": self.name})()

    monkeypatch.setattr(gemini, "genai", type("Genai", (), {"GenerativeModel": Model}))
    monkeypatch.setattr(gemini, "GEMINI_MODEL", "primary")
    monkeypatch.setattr(gemini, "GEMINI_FALLBACK_MODEL", "backup")
    monkeypatch.setattr(gemini, "TIMEOUT_GRACE_SECONDS", 0)

    assert await gemini.generate_text("hi", timeout=0.05) == "backup"

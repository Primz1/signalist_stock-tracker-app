import pytest
from models.schemas import ResearchRequest


@pytest.mark.asyncio
async def test_research_fallback():
    from agents.research_agent import run_research_agent

    result = await run_research_agent(ResearchRequest(symbol="AAPL", query="Should I watch AAPL?"))
    assert result.symbol == "AAPL"
    assert len(result.summary) > 10
    assert result.confidence > 0

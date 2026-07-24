from __future__ import annotations

from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field


class DataQuality(str, Enum):
    OK = "ok"
    PARTIAL = "partial"
    MISSING = "missing"


class Quality(BaseModel):
    returns: DataQuality = DataQuality.OK
    trend: DataQuality = DataQuality.OK
    momentum: DataQuality = DataQuality.OK
    volatility: DataQuality = DataQuality.OK
    volume: DataQuality = DataQuality.OK
    levels: DataQuality = DataQuality.OK
    relative: DataQuality = DataQuality.OK
    quality: DataQuality = DataQuality.MISSING
    event: DataQuality = DataQuality.OK


class SymbolReturns(BaseModel):
    r_1d: Optional[float] = None
    r_1w: Optional[float] = None
    r_1m: Optional[float] = None
    r_3m: Optional[float] = None
    r_ytd: Optional[float] = None
    log_return_mean_20d: Optional[float] = None


class SymbolTrend(BaseModel):
    price: float
    sma_20: Optional[float] = None
    sma_50: Optional[float] = None
    sma_200: Optional[float] = None
    above_sma_20: Optional[bool] = None
    above_sma_50: Optional[bool] = None
    above_sma_200: Optional[bool] = None
    golden_cross_recent: bool = False
    death_cross_recent: bool = False
    higher_highs: bool = False
    lower_lows: bool = False


class SymbolMomentum(BaseModel):
    rsi_14: Optional[float] = None
    macd_hist: Optional[float] = None
    macd_hist_slope_5: Optional[float] = None
    roc_20: Optional[float] = None
    distance_from_52w_high_pct: Optional[float] = None
    distance_from_52w_low_pct: Optional[float] = None


class SymbolVolatility(BaseModel):
    realized_vol_20d_annualized: Optional[float] = None
    atr_14: Optional[float] = None
    bollinger_pct_b: Optional[float] = None
    bollinger_bandwidth: Optional[float] = None
    parkinson_vol: Optional[float] = None


class SymbolVolume(BaseModel):
    volume_ratio_20d: Optional[float] = None
    obv_slope_20: Optional[float] = None


class SymbolLevels(BaseModel):
    recent_swing_highs: list[float] = []
    recent_swing_lows: list[float] = []
    nearest_support: Optional[float] = None
    nearest_resistance: Optional[float] = None
    distance_upper_band_pct: Optional[float] = None
    distance_lower_band_pct: Optional[float] = None


class SymbolRelative(BaseModel):
    beta_vs_primary_60d: Optional[float] = None
    excess_return_1m: Optional[float] = None
    excess_return_3m: Optional[float] = None
    correlation_vs_primary: Optional[float] = None


class SymbolQuality(BaseModel):
    pe: Optional[float] = None
    gross_margin: Optional[float] = None
    operating_margin: Optional[float] = None
    debt_to_equity: Optional[float] = None
    revenue_growth_yoy: Optional[float] = None


class SymbolEvent(BaseModel):
    days_to_next_earnings: Optional[int] = None
    last_4_earnings_surprise_pct: list[float] = []


class SymbolScore(BaseModel):
    total: int = Field(ge=0, le=100)
    components: dict[str, float]


class SymbolExtras(BaseModel):
    """Extra `ta` library indicators (latest scalars)."""

    adx: Optional[float] = None
    adx_pos: Optional[float] = None
    adx_neg: Optional[float] = None
    stoch_k: Optional[float] = None
    stoch_d: Optional[float] = None
    cci: Optional[float] = None
    willr: Optional[float] = None
    mfi: Optional[float] = None
    atr: Optional[float] = None


class SymbolQuantSnapshot(BaseModel):
    symbol: str
    computed_at: str
    returns: SymbolReturns
    trend: SymbolTrend
    momentum: SymbolMomentum
    volatility: SymbolVolatility
    volume: SymbolVolume
    levels: SymbolLevels
    relative: SymbolRelative
    quality: SymbolQuality
    event: SymbolEvent
    score: SymbolScore
    data_quality: Quality
    extras: SymbolExtras = Field(default_factory=SymbolExtras)


class Holding(BaseModel):
    symbol: str
    qty: float
    avg_cost: float
    current_price: float
    market_value: float
    weight: float
    unrealized_pl: float
    unrealized_pl_pct: float
    sector: Optional[str] = None
    vol_20d_annualized: Optional[float] = None


class Concentration(BaseModel):
    hhi: float
    effective_n: float
    top_1_symbol: Optional[str] = None
    top_1_weight: float
    top_3_weight: float


class PLContribution(BaseModel):
    symbol: str
    contribution_usd: float


class PLAttribution(BaseModel):
    winners: list[PLContribution] = []
    losers: list[PLContribution] = []
    winners_total_pct: float = 0.0
    losers_total_pct: float = 0.0


class SectorAllocation(BaseModel):
    buckets: dict[str, float] = {}
    largest_sector: Optional[str] = None
    largest_sector_weight: float = 0.0


class PortfolioRisk(BaseModel):
    weighted_vol_20d: Optional[float] = None
    portfolio_vol_covariance: Optional[float] = None
    weighted_beta: Optional[float] = None
    avg_pairwise_correlation: Optional[float] = None


class Drawdown(BaseModel):
    max_dd: Optional[float] = None
    current_dd: Optional[float] = None
    days_in_current_dd: Optional[int] = None
    longest_dd_days: Optional[int] = None


class Efficiency(BaseModel):
    cost_basis_vs_nav_pct: float = 0.0
    cash_drag_pct: Optional[float] = None


class FiredRule(BaseModel):
    id: str
    tag: Literal["trim", "add", "exit", "watch"]
    message: str
    data: dict = {}


class PortfolioQuantSnapshot(BaseModel):
    computed_at: str
    nav: float
    cash: float
    cash_pct: float
    holdings: list[Holding]
    concentration: Concentration
    pl_attribution: PLAttribution
    sector_allocation: SectorAllocation
    risk: PortfolioRisk
    drawdown: Drawdown
    efficiency: Efficiency
    rules_fired: list[FiredRule] = []


class ResearchNarrative(BaseModel):
    summary: str
    trend_read: str = ""
    momentum_read: str = ""
    volatility_read: str = ""
    levels_read: str = ""
    relative_read: str = ""
    quality_read: str = "insufficient data"
    event_read: str = ""
    confidence: float = Field(ge=0, le=100)
    signals: list[str] = []
    caveats: str = ""
    bull_case: list[str] = Field(default_factory=list)
    bear_case: list[str] = Field(default_factory=list)
    catalysts: list[dict[str, str]] = Field(default_factory=list)
    # catalysts items: { "when": "Mar 28", "label": "Earnings call" }


class ReviewNarrative(BaseModel):
    summary: str
    concentration_read: str = ""
    risk_read: str = ""
    attribution_read: str = ""
    drawdown_read: str = ""
    actions_read: str = ""
    confidence: float = Field(ge=0, le=100)
    caveats: str = ""

import numpy as np
import pandas as pd

from quant.factors.core import herfindahl, max_drawdown, rsi


def test_herfindahl_known():
    assert abs(herfindahl([0.4, 0.3, 0.2, 0.1]) - 0.30) < 1e-9


def test_herfindahl_empty():
    assert herfindahl([]) == 0.0


def test_max_drawdown_manual():
    equity = pd.Series([100, 110, 90, 95, 80], dtype=float)
    max_dd, current_dd, days = max_drawdown(equity)
    assert max_dd is not None and abs(max_dd - (80 / 110 - 1)) < 1e-9
    assert current_dd is not None and abs(current_dd - (80 / 110 - 1)) < 1e-9
    assert days == 3


def test_rsi_bounds():
    # Strictly rising series → RSI near 100
    closes = pd.Series(np.linspace(100, 130, 40))
    val = rsi(closes, 14)
    assert val is not None
    assert 50 < val <= 100

    # Flat-ish random-ish declining → lower RSI
    down = pd.Series(np.linspace(130, 100, 40))
    val2 = rsi(down, 14)
    assert val2 is not None
    assert 0 <= val2 < 50

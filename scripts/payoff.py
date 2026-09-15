"""Today's option quote repriced across historical terminal-return scenarios.

This is a scenario analysis, not a historical option strategy backtest.
"""
import math
import numpy as np
from signals import block_mean_interval


def payoff_scenarios(closes, horizon, strike, bid, fee=2., slippage=.01):
    a = np.asarray(closes, dtype=float)
    if a.ndim != 1 or not np.isfinite(a).all() or (a <= 0).any():
        raise ValueError("Invalid close history")
    if not isinstance(horizon, int) or horizon < 1:
        raise ValueError("Horizon must be a positive session count")
    if not all(math.isfinite(v) for v in [strike, bid, fee, slippage]):
        raise ValueError("Nonfinite contract inputs")
    if strike <= 0 or bid < 0 or fee < 0 or slippage < 0 or slippage > bid:
        raise ValueError("Invalid contract inputs")
    if len(a) < max(252, 30*horizon+1):
        return {"status": "INSUFFICIENT SCENARIOS"}
    # Anchor to the oldest observation, not chosen to optimize the result.
    origins = np.arange(0, len(a)-horizon, horizon)
    returns = a[origins+horizon]/a[origins]-1
    terminal = a[-1]*(1+returns)
    intrinsic = np.maximum(strike-terminal, 0)*100
    credit = (bid-slippage)*100-fee
    pnl = credit-intrinsic
    interval = block_mean_interval(pnl)
    mean = float(pnl.mean())
    stress = [{"underlying_return_pct": drop*100,
               "net_pnl": round(float(credit-max(strike-a[-1]*(1+drop), 0)*100), 2)}
              for drop in [-.1, -.2, -.4, -.6, -1.]]
    # These labels characterize the scenarios, never authorize entry.
    status = "UNFAVORABLE HISTORICAL SCENARIOS" if mean <= 0 else (
        "UNCERTAIN HISTORICAL SCENARIOS" if interval[0] <= 0 else "POSITIVE HISTORICAL SCENARIOS")
    return {"status": status, "horizon_sessions": horizon, "windows": len(pnl),
            "reference_price": float(a[-1]), "strike": strike, "bid": bid,
            "fee_per_contract": fee, "slippage_per_share": slippage,
            "net_credit": round(credit, 2), "mean_net_pnl": round(mean, 2),
            "mean_interval": [round(v, 2) for v in interval],
            "median_net_pnl": round(float(np.median(pnl)), 2),
            "loss_rate_pct": round(float(np.mean(pnl < 0))*100, 1),
            "worst_net_pnl": round(float(pnl.min()), 2),
            "worst_5pct_mean": round(float(np.sort(pnl)[:max(1, math.ceil(.05*len(pnl)))].mean()), 2),
            "mean_loss_breakeven_bid": round(float(intrinsic.mean()/100+fee/100+slippage), 4),
            "stress": stress}

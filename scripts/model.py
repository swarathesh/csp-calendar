"""Historical downside screen, not an assignment-probability model."""
from datetime import date, timedelta
import math
import numpy as np
import pandas_market_calendars as mcal

def sessions(start, end):
    return [x.date() for x in mcal.get_calendar("NYSE").valid_days(start_date=start, end_date=end)]

def last_completed_session(now):
    schedule=mcal.get_calendar("NYSE").schedule(
        start_date=now.date()-timedelta(days=12), end_date=now.date())
    closed=schedule[schedule["market_close"] <= now]
    if closed.empty: raise ValueError("No completed trading session")
    return closed.index[-1].date()

def next_session(day):
    return sessions(day + timedelta(days=1), day + timedelta(days=12))[0]

def downside(closes, horizon, quantile=.05):
    a = np.asarray(closes, dtype=float)
    if horizon < 1 or len(a) < max(252, horizon + 100):
        raise ValueError("Insufficient history for a downside screen")
    lows = np.array([min(a[i+1:i+horizon+1]) / a[i] - 1
                     for i in range(len(a)-horizon)])
    return {"tail": float(min(0, np.quantile(lows, quantile))),
            "worst": float(min(0, lows.min())), "samples": len(lows)}

def relevant(events, symbol, proxies):
    peers = proxies.get(symbol, [])
    return [e for e in events if e["kind"] != "Earnings" or e.get("symbol") in [symbol]+peers]

def timing(events, today):
    near = [e for e in events if today.isoformat() <= e["date"] <= (today+timedelta(days=3)).isoformat()]
    if near:
        last = max(date.fromisoformat(e["date"]) for e in near)
        return next_session(last), "WAIT / REASSESS", near
    market_days = sessions(today, today+timedelta(days=10))
    return market_days[0], "REVIEW QUOTES", []

def choose_put(rows, spot, ceiling):
    valid = [r for r in rows if all(math.isfinite(float(r.get(k, float("nan"))))
             for k in ["strike", "bid", "ask"])
             and 0 < r["strike"] <= min(ceiling, spot*.99)
             and r.get("contractSize") == "REGULAR"
             and r["bid"] > 0 and r["ask"] >= r["bid"]
             and (r["ask"]-r["bid"])/((r["ask"]+r["bid"])/2) <= .5
             and r.get("openInterest", 0) >= 25]
    return max(valid, key=lambda r:r["strike"]) if valid else None

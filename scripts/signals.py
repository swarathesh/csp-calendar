"""Experimental price-risk classifier. No options-P&L or assignment claims.

Fixed specification: L2 logistic regression, 63-session warmup, 504 training
examples, 10-session non-overlapping evaluation windows, 5% closing drawdown.
Every historical prediction uses only labels ending strictly before its origin.
"""
import numpy as np

HORIZON = 10
DROP = .05
WARMUP = 63
MIN_TRAIN = 504
FEATURES = ["5-session return", "20-session return", "60-session return",
            "20-session volatility", "Distance from 60-session average",
            "Drawdown from 60-session high"]


def features(closes):
    a = np.asarray(closes, dtype=float)
    if a.ndim != 1 or not np.isfinite(a).all() or (a <= 0).any():
        raise ValueError("Prices must be finite and positive")
    x = np.full((len(a), len(FEATURES)), np.nan)
    for i in range(WARMUP, len(a)):
        recent = a[i-59:i+1]
        returns = np.diff(np.log(a[i-20:i+1]))
        x[i] = [a[i]/a[i-5]-1, a[i]/a[i-20]-1, a[i]/a[i-60]-1,
                returns.std(), a[i]/recent.mean()-1, a[i]/recent.max()-1]
    return x


def labels(closes):
    a = np.asarray(closes, dtype=float)
    return np.array([float(a[i+1:i+HORIZON+1].min()/a[i]-1 <= -DROP)
                     for i in range(len(a)-HORIZON)])


def train_indices(origin):
    # A training label's last price must precede the prediction date.
    return np.arange(WARMUP, origin-HORIZON)


def fit_predict(x, y, current):
    mean, scale = x.mean(axis=0), x.std(axis=0)
    scale = np.where(scale < 1e-8, 1., scale)
    z = np.clip((x-mean)/scale, -10, 10)
    current_z = np.clip((current-mean)/scale, -10, 10)
    prevalence = float(y.mean())
    if prevalence in (0., 1.):
        return prevalence
    weights = np.zeros(x.shape[1])
    intercept = float(np.log(prevalence/(1-prevalence)))
    for _ in range(300):
        p = 1/(1+np.exp(-np.clip(z@weights+intercept, -30, 30)))
        error = p-y
        weights -= .1*(z.T@error/len(y)+.1*weights)
        intercept -= .1*error.mean()
    return float(1/(1+np.exp(-np.clip(current_z@weights+intercept, -30, 30))))


def group_stats(rows):
    n = len(rows)
    hits = sum(r["outcome"] for r in rows)
    # Wilson interval describes observed frequency, not calibrated model certainty.
    if not n:
        return {"windows": 0, "events": 0, "rate_pct": None, "interval_pct": None}
    rate = hits/n
    z = 1.96
    center = (rate+z*z/(2*n))/(1+z*z/n)
    half = z*np.sqrt(rate*(1-rate)/n+z*z/(4*n*n))/(1+z*z/n)
    return {"windows": n, "events": int(hits), "rate_pct": round(100*rate, 1),
            "interval_pct": [round(100*(center-half), 1), round(100*(center+half), 1)]}


def risk_signal(closes, dates):
    a = np.asarray(closes, dtype=float)
    if len(a) != len(dates):
        raise ValueError("Price and date lengths differ")
    date_strings = [str(d)[:10] for d in dates]
    if any(a >= b for a, b in zip(date_strings, date_strings[1:])):
        raise ValueError("Price dates must be strictly increasing")
    x = features(a)
    base = {"version": "logistic-v1", "horizon_sessions": HORIZON, "drop_pct": DROP*100,
            "features": FEATURES, "status": "INSUFFICIENT HISTORY", "usable": False}
    first = WARMUP+MIN_TRAIN+HORIZON
    if len(a) <= first+HORIZON:
        return base
    y = labels(a)
    rows = []
    for origin in range(first, len(y), HORIZON):
        train = train_indices(origin)
        probability = fit_predict(x[train], y[train], x[origin])
        baseline = float(y[train].mean())
        rows.append({"date": date_strings[origin], "through": date_strings[origin+HORIZON],
                     "probability": probability, "baseline": baseline,
                     "outcome": int(y[origin]), "lower_risk": probability < baseline})
    brier = float(np.mean([(r["probability"]-r["outcome"])**2 for r in rows]))
    baseline_brier = float(np.mean([(r["baseline"]-r["outcome"])**2 for r in rows]))
    all_stats = group_stats(rows)
    lower = group_stats([r for r in rows if r["lower_risk"]])
    higher = group_stats([r for r in rows if not r["lower_risk"]])
    # This is a descriptive evidence gate, not a statistical significance claim.
    enough = len(rows) >= 40 and min(all_stats["events"], len(rows)-all_stats["events"]) >= 5
    usable = bool(enough and brier < baseline_brier and lower["windows"] >= 10
                  and higher["windows"] >= 10 and lower["rate_pct"] < higher["rate_pct"])
    train = train_indices(len(a)-1)
    probability = fit_predict(x[train], y[train], x[-1])
    baseline = float(y[train].mean())
    status = ("ELEVATED DOWNSIDE RISK" if probability >= baseline else "LOWER RELATIVE DOWNSIDE RISK") if usable else "NO VALIDATED EDGE"
    return {**base, "status": status, "usable": usable, "price_date": date_strings[-1],
            "probability_pct": round(probability*100, 1), "baseline_pct": round(baseline*100, 1),
            "brier": round(brier, 4), "baseline_brier": round(baseline_brier, 4),
            "brier_skill_pct": round(100*(1-brier/baseline_brier), 1) if baseline_brier else None,
            "evaluation_from": rows[0]["date"], "evaluation_through": rows[-1]["through"],
            "all": all_stats, "lower": lower, "higher": higher, "evaluation": rows}

"""Experimental price-risk classifier. No options-P&L or assignment claims.

Fixed specification: four model candidates, 63-session warmup, 504 training
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


MODEL_NAMES = {"baseline": "Historical event rate", "logistic": "Regularized logistic",
               "volatility": "Volatility-only logistic", "neighbors": "Similar historical conditions"}
SELECTION_MIN = 20


def predictions(x, y, current):
    baseline = float(y.mean())
    scale = x.std(axis=0)
    scale = np.where(scale < 1e-8, 1., scale)
    distances = np.sum(((x-current)/scale)**2, axis=1)
    nearest = np.argsort(distances, kind="stable")[:100]
    # 100 nearest observations plus a 50-observation baseline prior.
    neighbors = float((y[nearest].sum()+50*baseline)/(len(nearest)+50))
    return {"baseline": baseline, "logistic": fit_predict(x, y, current),
            "volatility": fit_predict(x[:, 3:4], y, current[3:4]), "neighbors": neighbors}


def select_model(history, origin):
    # Outcomes ending at/after the prediction origin are not yet eligible.
    past = [r for r in history if r["end_index"] < origin][-40:]
    if len(past) < SELECTION_MIN:
        return "baseline", len(past)
    errors = {name: np.mean([(r["predictions"][name]-r["outcome"])**2 for r in past])
              for name in MODEL_NAMES}
    # Stable insertion order breaks exact ties in favor of the baseline.
    return min(errors, key=errors.get), len(past)


def block_mean_interval(values, block=5):
    """Deterministic moving-block bootstrap; approximate, not regime protection."""
    values = np.asarray(values, dtype=float)
    if not len(values):
        return None
    size = min(block, len(values))
    rng = np.random.default_rng(20260915)
    starts = rng.integers(0, len(values)-size+1, size=(2000, int(np.ceil(len(values)/size))))
    indices = (starts[:, :, None]+np.arange(size)).reshape(2000, -1)[:, :len(values)]
    means = values[indices].mean(axis=1)
    return [float(v) for v in np.quantile(means, [.025, .975])]


def risk_signal(closes, dates):
    a = np.asarray(closes, dtype=float)
    if len(a) != len(dates):
        raise ValueError("Price and date lengths differ")
    date_strings = [str(d)[:10] for d in dates]
    if any(a >= b for a, b in zip(date_strings, date_strings[1:])):
        raise ValueError("Price dates must be strictly increasing")
    x = features(a)
    base = {"version": "prequential-v2", "horizon_sessions": HORIZON, "drop_pct": DROP*100,
            "features": FEATURES, "status": "INSUFFICIENT HISTORY", "usable": False}
    first = WARMUP+MIN_TRAIN+HORIZON
    if len(a) <= first+(SELECTION_MIN+2)*HORIZON:
        return base
    y = labels(a)
    history, rows = [], []
    for origin in range(first, len(y), HORIZON):
        train = train_indices(origin)
        estimates = predictions(x[train], y[train], x[origin])
        selected, count = select_model(history, origin)
        probability, baseline = estimates[selected], estimates["baseline"]
        record = {"date": date_strings[origin], "through": date_strings[origin+HORIZON],
                  "origin_index": origin, "end_index": origin+HORIZON,
                  "predictions": estimates, "selected_model": selected, "selection_windows": count,
                  "probability": probability, "baseline": baseline,
                  "outcome": int(y[origin]), "lower_risk": probability < baseline}
        if count >= SELECTION_MIN:
            rows.append(record)
        history.append(record)
    brier = float(np.mean([(r["probability"]-r["outcome"])**2 for r in rows]))
    baseline_brier = float(np.mean([(r["baseline"]-r["outcome"])**2 for r in rows]))
    difference_interval = block_mean_interval([(r["probability"]-r["outcome"])**2-
                                               (r["baseline"]-r["outcome"])**2 for r in rows])
    comparison = [{"model": name, "label": label,
                   "brier": round(float(np.mean([(r["predictions"][name]-r["outcome"])**2 for r in rows])), 4),
                   "selected_windows": sum(r["selected_model"] == name for r in rows)}
                  for name, label in MODEL_NAMES.items()]
    all_stats = group_stats(rows)
    lower = group_stats([r for r in rows if r["lower_risk"]])
    higher = group_stats([r for r in rows if not r["lower_risk"]])
    reasons = []
    if len(rows) < 40: reasons.append("Fewer than 40 outer test windows")
    if min(all_stats["events"], len(rows)-all_stats["events"]) < 5:
        reasons.append("Fewer than five outcomes in one class")
    if brier >= baseline_brier: reasons.append("Selected models did not beat the event-rate baseline")
    if difference_interval[1] >= 0: reasons.append("Error improvement is uncertain in block resampling")
    if min(lower["windows"], higher["windows"]) < 10:
        reasons.append("Fewer than ten test windows in one risk group")
    elif lower["rate_pct"] >= higher["rate_pct"]:
        reasons.append("Lower-risk group did not have fewer declines")
    train = train_indices(len(a)-1)
    selected, count = select_model(history, len(a)-1)
    if selected == "baseline":
        reasons.append("Current selection is the baseline; no relative risk signal")
    usable = not reasons
    estimates = predictions(x[train], y[train], x[-1])
    probability, baseline = estimates[selected], estimates["baseline"]
    status = ("ELEVATED DOWNSIDE RISK" if probability >= baseline else "LOWER RELATIVE DOWNSIDE RISK") if usable else "NO VALIDATED EDGE"
    return {**base, "status": status, "usable": usable, "price_date": date_strings[-1],
            "selected_model": selected, "selected_model_label": MODEL_NAMES[selected], "gate_reasons": reasons,
            "model_comparison": comparison, "error_difference_interval": difference_interval,
            "probability_pct": round(probability*100, 1), "baseline_pct": round(baseline*100, 1),
            "brier": round(brier, 4), "baseline_brier": round(baseline_brier, 4),
            "brier_skill_pct": round(100*(1-brier/baseline_brier), 1) if baseline_brier else None,
            "evaluation_from": rows[0]["date"], "evaluation_through": rows[-1]["through"],
            "all": all_stats, "lower": lower, "higher": higher, "evaluation": rows,
            "selection_warmup": [r for r in history if r["selection_windows"] < SELECTION_MIN]}

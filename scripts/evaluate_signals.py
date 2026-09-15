"""Reproduce the fixed signal experiment: python scripts/evaluate_signals.py."""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
import yfinance as yf
from model import last_completed_session, sessions
from signals import risk_signal

ROOT = Path(__file__).resolve().parents[1]


def main():
    config = json.loads((ROOT/'config.json').read_text())
    now = datetime.now(timezone.utc)
    expected = last_completed_session(now)
    report = {"collected_at": now.isoformat(), "source": "Yahoo Finance via yfinance; adjusted completed daily closes",
              "history_years": config['history_years'], "symbols": {}}
    for symbol in config['watchlist']:
        hist = yf.Ticker(symbol).history(period=str(config['history_years'])+'y', auto_adjust=True, timeout=20)
        closes = hist[[d <= expected for d in hist.index.date]]['Close'].dropna()
        if closes.empty or closes.index[-1].date() != expected:
            raise ValueError(symbol+': missing or stale price history')
        if list(closes.index.date) != sessions(closes.index[0].date(), expected):
            raise ValueError(symbol+': missing market sessions')
        observations = [[str(d), float(v)] for d, v in zip(closes.index.date, closes)]
        report['symbols'][symbol] = {
            "observations": len(closes), "history_from": observations[0][0],
            "history_through": observations[-1][0],
            "input_sha256": hashlib.sha256(json.dumps(observations).encode()).hexdigest(),
            "result": risk_signal(closes.to_numpy(), closes.index.date)}
        print(symbol, report['symbols'][symbol]['result']['status'], flush=True)
    destination = ROOT/'reports/ml-evaluation.json'
    destination.parent.mkdir(exist_ok=True)
    destination.write_text(json.dumps(report, indent=2, allow_nan=False)+'\n')
    print(destination)


if __name__ == '__main__':
    main()

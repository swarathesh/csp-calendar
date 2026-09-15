# Initial ML evaluation

Collected: 2026-09-15T21:08:32.842252+00:00

Fixed experiment: predict a 5% adjusted closing decline within the next 10 trading sessions. These results measure price-event prediction, not CSP profit.

| Symbol | Test windows | Model Brier | Baseline Brier | Relative improvement | Evidence gate |
|---|---:|---:|---:|---:|---|
| SOXL | 67 | 0.2363 | 0.2326 | -1.6% | Failed |
| SMH | 67 | 0.188 | 0.2005 | 6.2% | Passed (experimental) |
| IWM | 67 | 0.1123 | 0.1084 | -3.6% | Failed |
| SPY | 67 | 0.0457 | 0.0472 | 3.1% | Failed |

All four instruments were evaluated from January 3, 2024 through September 4, 2026. The last completed input close was September 15, 2026.

SMH showed a preliminary improvement: declines occurred in 8/43 lower-risk windows and 10/24 higher-risk windows. Their approximate 95% frequency intervals overlap (9.7–32.6% and 24.5–61.2%). This is not statistically established alpha. SOXL and IWM did not beat the baseline; SPY had only three positive outcomes, below the minimum five.

No parameters were changed after inspecting these results. The evidence gate is a descriptive check on the same evaluation period, not a separate independent validation set. Do not interpret passing it as a demonstrated profitable strategy.

See `ml-evaluation.json` for every prediction, outcome, training baseline and input provenance. Run `python scripts/evaluate_signals.py` to repeat with the latest rolling data. Future paper-trading results should be evaluated before using this to allocate capital.

# Expanded empirical evaluation

Collected: 2026-09-15T21:15:17.482846+00:00

Version 2 uses ten years of adjusted completed closes, four fixed methods, and chronological model selection. Version 1 used five years and one classifier; its 6.2% SMH error improvement did not establish profitability and is superseded by this broader check.

| Symbol | Outer test windows | Selected-model error | Baseline error | Improvement | Evidence gate |
|---|---:|---:|---:|---:|---|
| SOXL | 172 | 0.2376 | 0.2434 | 2.4% | Failed |
| SMH | 172 | 0.1934 | 0.1923 | -0.6% | Failed |
| IWM | 172 | 0.1388 | 0.1399 | 0.8% | Failed |
| SPY | 172 | 0.0878 | 0.0851 | -3.2% | Failed |

Outer outcomes span 2019-11-01 through 2026-09-09; last input close 2026-09-15.

No instrument passed the stricter evidence gate. SOXL and IWM had small positive average error improvements, but their block-bootstrap intervals included zero. SMH and SPY did not improve the selection-process error. IWM also failed the risk-group ordering check. No model or parameter was changed to chase a passing result.

The method selected at any historical date uses only earlier completed prediction outcomes. Individual-method scores are shown for diagnosis; choosing the best one after seeing these scores would introduce selection bias. This retrospective research revisits some previously examined data and requires future validation.

The accompanying payoff report applies actual collected bids and strikes to historical terminal-return scenarios, with $2 assumed fees per contract and a $0.01/share bid haircut. Positive scenario averages are not a historical record of profitable option trades. Review uncertainty, crash losses, data freshness and catalyst checks.

See the JSON reports for full values, provenance, and reasons for each failed evidence gate. Reproduce with the commands in README.md.

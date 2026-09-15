# Catalyst — CSP Calendar

A mobile-friendly GitHub Pages dashboard for upcoming earnings, US economic releases, and catalyst-aware cash-secured put research.

## Website

Expected address after Pages is enabled: https://swarathesh.github.io/csp-calendar/

If deployment reports "Get Pages site failed", open **Settings → Pages → Build and deployment → Source → GitHub Actions**, then rerun the failed deployment job. GitHub's normal workflow token cannot enable Pages for the first time.

## Scheduled refresh

The workflow runs on pushes to main, manual dispatch, and at **01:17, 07:17, 13:17, and 19:17 UTC every day**. These are 21:17 (previous day), 03:17, 09:17, and 15:17 in Toronto during daylight saving time; one hour earlier during standard time. GitHub scheduled jobs may be delayed or dropped during heavy load. Public repository schedules can be disabled after 60 days of inactivity.

Each run tests the calculation code, collects fresh data, builds site/data/latest.json, saves a downloadable dashboard-preview artifact, and deploys the site. Generated JSON is in the deployment artifact, not committed back to main. Refresh failure is visible in Actions; the website flags old snapshots after 12 hours.

## Data

- BLS official iCalendar: CPI, PPI, employment, JOLTS, labor costs, productivity and trade-price releases.
- BEA official release schedule: GDP, Personal Income and Outlays (including PCE), international trade.
- Federal Reserve official meeting calendar: scheduled FOMC decision days.
- Nasdaq public earnings calendar: all returned rows for the coming 35 days. Best-effort public endpoint; access may be restricted.
- Optional Finnhub earnings provider: add an Actions secret named **FINNHUB_API_KEY**. It replaces Nasdaq earnings requests. Coverage depends on the provider account. Never commit the key or put it in frontend code.
- Yahoo Finance via yfinance: adjusted completed daily closes, available expirations, and indicative option chains.

"No earnings listed" is not proof of no earnings risk. Future dates may be unannounced, and provider dates may be estimates. No source is represented as a comprehensive list of every market-moving event. Failed or unrecognized sources are labeled unavailable, not replaced with fictional data.

## Target methodology

Defaults: SOXL, SMH, IWM, SPY; 7–28 days from the reassessment date; approximately 14-day expirations. Edit config.json to adjust the watchlist, earnings proxies, history or horizon.

1. Check macro catalysts and selected company earnings proxies. A relevant event within three calendar days leads to a reassessment on the next NYSE session after the event cluster. This is a review date, not an instruction to enter automatically.
2. Take five years of adjusted daily closes, excluding unfinished session bars. Use the last completed close as the reference price, with its date displayed.
3. Count trading sessions from that reference close through each selected listed expiration.
4. For each historical window of that length, calculate the lowest subsequent close relative to the starting close. Use the fifth percentile as a model strike ceiling; also display the worst observed closing decline and overlapping sample count.
5. Screen actual regular-size puts below the ceiling and at least 1% below the reference close, with positive bids, open interest ≥25 and a bid/ask spread ≤50% of midpoint. Select the highest qualifying strike. Missing/illiquid chains yield no candidate.
6. Show bid-based indicative credit, gross collateral, breakeven and return before fees/tax. No annualized-return promise and no estimated assignment probability.

Historical downside is not a floor, forecast, or guaranteed protection. Windows overlap and are not independent. Intraday losses, gaps, fat tails and future regimes can be worse. After waiting for a catalyst, spot and volatility change: rerun the screen. Post-event premiums can shrink. SOXL is daily 3x leveraged and can suffer severe drawdowns; a covered call after assignment does not guarantee a profitable exit.

The app never places orders. Options bids are delayed and have no reliable quote timestamp in this source; last trade time is displayed separately. Verify prices, contract terms and release timing in your broker and original sources.

## Local development

Requires Python 3.12 and Node.js (for the syntax check).

    pip install -r requirements.txt
    python -m unittest discover -s tests -v
    node --test tests/test_calendar.cjs
    python scripts/refresh.py
    python -m http.server 8000 --directory site

Open http://localhost:8000. Serve over HTTP so the browser can fetch JSON.

## References

- https://www.bls.gov/help/hlpical.htm
- https://www.bea.gov/news/schedule
- https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm
- https://finnhub.io/docs/api/earnings-calendar
- https://ranaroussi.github.io/yfinance/reference/api/yfinance.Ticker.html
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule

## BLS access fallback

The GitHub runner could not retrieve BLS during initial validation. When live BLS collection fails, data/bls-verified.json supplies selected dates verified against the official September/October 2026 schedules on 2026-09-14. These rows show their verification date and remain marked cached, with an incomplete-calendar status on CSP cards. They are not automatically reverified, are not comprehensive, and are removed from display once past. Review/update this file against original schedules if the live source remains unavailable. Earnings, BEA, FOMC and market/options data fetched successfully in the initial run.


## Chains & forecasts
The fourth dashboard tab exposes full call/put chains for the three expirations screened per instrument: bid, ask, last, implied volatility, volume, open interest, contract size and last trade time. Quotes are snapshots refreshed on the existing schedule, not real-time or streaming. No quote timestamp is inferred from last-trade time.

The Fed forecast section discovers the latest accessible Summary of Economic Projections linked from the official FOMC calendar and displays the first four (median) federal funds rate projections and publication date. These are annual/longer-run participant projections, not next-meeting probabilities. CME FedWatch is linked for market-implied meeting probabilities; automated CME data ingestion is not implemented.

Analyst targets are retrieved through yfinance for watchlist instruments and selected earnings proxies. Instruments without target coverage are marked unavailable. Constituent targets are not ETF forecasts. These long-horizon forecasts do not alter CSP strike calculations; target-specific publication dates and horizons are not supplied by the endpoint. All additions work without new API keys and fail independently of the calendar/historical screen.

## Calendar filters and export

The event calendar starts at today in Eastern time. Combine the inclusive From/Through dates with ticker/event search and event type; clear From to include older rows still present in the snapshot. Reset filters returns to upcoming events. The result count reflects all active filters. Export CSV downloads exactly those rows, including source URLs and cached verification dates. Export is disabled for empty results or an inverted date range. Upcoming totals and the next macro catalyst exclude past dates even when the snapshot is stale; same-day events remain visible because release times may be unconfirmed.

## Experimental model comparison and expiry payoffs

Each CSP card estimates whether any adjusted close in the next **10 trading sessions** will be at least **5%** below the reference close. The signal uses ten years (`signal_history_years`) to include the 2020 selloff. The strike ceiling still uses the separate five-year `history_years` setting. Models are instrument-wide; they do not predict assignment or a particular option’s return.

Four fixed methods compete: historical event rate, L2 logistic regression on six trailing price features, volatility-only L2 logistic regression, and a smoothed nearest-neighbor estimate (100 neighbors with a 50-observation event-rate prior). Six-feature inputs are 5/20/60-session returns, 20-session volatility, distance from the 60-session average, and drawdown from its high. Methods and parameters are fixed before running the expanded experiment.

### Chronological selection and testing

Training expands from at least 504 examples; all training outcomes must end strictly before each prediction. Scaling uses training data only. Ten-session evaluation outcome windows do not overlap. At each historical prediction, choose the method with the lowest Brier error on up to 40 earlier completed prediction windows; at least 20 are required. The selected method is then scored on the next outcome. The outer score evaluates this selection process, not whichever method looks best afterward. Ties favor the baseline. Training windows overlap; market regimes may remain dependent.

The evidence gate requires 40 outer windows, five examples in each outcome class, ten windows in each risk group, lower selected-model error than baseline, fewer declines in the lower-risk group, and an approximate 95% moving-block-bootstrap interval for model-minus-baseline error entirely below zero (2,000 resamples; blocks of five outcome windows). Wilson group-frequency intervals describe sample rates, not model calibration. Both interval methods can be optimistic under persistent dependence or structural change.

**These are retrospective tests.** The recent portion of this history was already examined in version 1, so the expanded experiment is not a fresh untouched holdout. No extra model/parameter search was performed after inspecting the expanded results. A passed gate would still require prospective validation. Failed gates display **NO VALIDATED EDGE**, with explicit reasons. Stale snapshots, unresolved calendars and missing qualifying quotes override model guidance with **WAIT**. There is no automatic entry clearance.

### Does the bid cover expiry losses?

For each qualifying option, the payoff panel applies non-overlapping historical terminal returns of its actual expiry horizon to today’s reference price, strike and bid. For one regular 100-share put:

    net credit = (bid - slippage per share) × 100 - total fees
    terminal price = current reference price × (1 + historical terminal return)
    net expiry P/L = net credit - max(strike - terminal price, 0) × 100

The panel shows mean/median P/L, loss frequency, a block-bootstrap interval for the mean, average loss in the worst 5% of scenarios, worst observed P/L, and the bid needed to cover the mean historical intrinsic loss plus costs. At least 30 non-overlapping windows and 252 observations are required. Stress tests include underlying declines of 10%, 20%, 40%, 60% and 100%; the zero-price case shows the contract’s maximum loss under the stated costs. Negative mean scenarios trigger a caution; a mean interval spanning a loss is labeled uncertain.

**This is not an options backtest or an expected-profit estimate.** It holds today’s quote and strike fixed across adjusted historical return scenarios. Historical option premiums were unavailable. It marks assignment losses at expiration, rather than assuming eventual recovery. Early assignment, changing option prices before expiry, taxes, collateral interest and intraday liquidation are excluded. The strike screen also uses this history, so the payoff panel is descriptive, not independent validation of that screen. Scenarios cannot establish profitability or cover every future crash.

Cost assumptions are explicit and editable in `config.json`: `scenario_costs.fee_per_contract` (default $2 total) and `scenario_costs.slippage_per_share` (default $0.01 below bid). These are scenario assumptions, not broker fee claims. Cost errors, missing sessions or unavailable prices make the panel unavailable. Signal horizon and option expiry horizon are displayed separately.

### Reproducing the evidence

    python scripts/evaluate_signals.py
    python scripts/refresh.py

The first command writes `reports/ml-evaluation.json` with timestamps, history ranges/input hashes, selection warmup records, and every outer prediction/outcome. The second recomputes current option scenarios in `site/data/latest.json`. Provider revisions and rolling windows change reruns; current option bids are delayed and may change. `reports/ML-EVALUATION.md` summarizes the expanded run; `reports/payoff-evaluation.json` preserves the reviewed option-scenario snapshot, including collection time and quote assumptions. Normal scheduled refreshes recompute signals and scenarios without rewriting committed reports.

References: [chronological splits and gaps](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html), [model-selection bias](https://scikit-learn.org/stable/auto_examples/model_selection/plot_nested_cross_validation_iris.html), [CSP payoff and risks](https://www.optionseducation.org/strategies/all-strategies/cash-secured-put).

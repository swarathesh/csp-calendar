import sys, unittest
from pathlib import Path
from datetime import datetime, timezone
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from extras import number, chain_rows, fed_projections, analyst_targets

class Response:
    def __init__(self,text): self.text=text

class ExtrasTests(unittest.TestCase):
    def test_nonfinite_values_are_missing(self):
        self.assertIsNone(number(float("nan")))
        self.assertIsNone(number(float("inf")))
        self.assertIsNone(number(None))
        self.assertEqual(number("1.25"),1.25)
    def test_fed_median_mapping_and_future_link(self):
        index='<a href="/monetarypolicy/fomcprojtabl20260617.htm">June</a><a href="/monetarypolicy/fomcprojtabl20260916.htm">future</a>'
        table='<table><tr><th>Variable</th><th>Median</th></tr><tr>'+''.join('<th>'+s+'</th>' for s in ["2026","2027","2028","Longer run"]*3)+'</tr><tr><th>Federal funds rate</th><td>3.8</td><td>3.6</td><td>3.4</td><td>3.1</td></tr></table>'
        def fetch(url): return Response(index if "fomccalendars" in url else table)
        d=fed_projections(fetch,datetime(2026,9,15,tzinfo=timezone.utc))
        self.assertEqual(d["status"],"ok")
        self.assertEqual(d["published_at"],"2026-06-17")
        self.assertEqual(d["rows"][-1],{"period":"Longer run","median_rate":3.1})
    def test_missing_forecast_is_not_fabricated(self):
        d=fed_projections(lambda url:Response("unavailable"),datetime.now(timezone.utc))
        self.assertEqual(d["status"],"unavailable")
        self.assertEqual(d["rows"],[])
    @patch("extras.yf.Ticker")
    def test_etf_without_targets_is_unavailable(self,ticker):
        ticker.return_value.get_analyst_price_targets.return_value={}
        d=analyst_targets({"watchlist":["SOXL"],"earnings_proxies":{}},datetime.now(timezone.utc))
        self.assertEqual(d[0]["status"],"unavailable")
        self.assertNotIn("mean",d[0])

if __name__=="__main__": unittest.main()

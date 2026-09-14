import sys, unittest
from pathlib import Path
from datetime import date
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from model import downside, timing, choose_put, relevant

class ModelTests(unittest.TestCase):
    def test_next_session_skips_holiday(self):
        entry,status,_=timing([{"date":"2026-07-02","title":"Jobs"}],date(2026,7,2))
        self.assertEqual(entry,date(2026,7,6))
        self.assertEqual(status,"WAIT / REASSESS")
    def test_future_minimum_is_not_terminal_return(self):
        prices=[100.0]*300
        prices[101]=50
        r=downside(prices,5)
        self.assertEqual(r["worst"],-.5)
        self.assertEqual(r["samples"],295)
    def test_no_positive_downside_for_rising_series(self):
        self.assertEqual(downside(list(range(1,301)),5)["tail"],0)
    def test_insufficient_history_is_rejected(self):
        with self.assertRaises(ValueError): downside([100]*50,10)
    def test_option_filter(self):
        def row(k,bid=1,ask=1.1,oi=100,size="REGULAR"):
            return dict(strike=k,bid=bid,ask=ask,openInterest=oi,contractSize=size)
        rows=[row(80),row(85,ask=9),row(84,bid=0),row(83,oi=1),row(82,size="MINI"),row(95)]
        self.assertEqual(choose_put(rows,100,90)["strike"],80)
        self.assertIsNone(choose_put([row(95)],100,90))
    def test_proxy_scope(self):
        events=[{"kind":"Macro"},{"kind":"Earnings","symbol":"NVDA"},{"kind":"Earnings","symbol":"OTHER"}]
        self.assertEqual(len(relevant(events,"SOXL",{"SOXL":["NVDA"]})),2)
if __name__=="__main__":unittest.main()

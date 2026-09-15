"""Fetch independent public sources; missing data is never a trading clearance."""
import json, os, re, math
from pathlib import Path
from datetime import datetime, date, timedelta, timezone
from zoneinfo import ZoneInfo
from concurrent.futures import ThreadPoolExecutor
import requests
import yfinance as yf
import pandas as pd
from bs4 import BeautifulSoup
from icalendar import Calendar
from extras import chain_rows, fed_projections, analyst_targets
from signals import risk_signal
from payoff import payoff_scenarios
from model import downside, relevant, timing, sessions, choose_put, last_completed_session

ROOT = Path(__file__).resolve().parents[1]
NOW = datetime.now(timezone.utc)
TODAY = NOW.astimezone(ZoneInfo("America/New_York")).date()
END = TODAY + timedelta(days=35)
HEADERS = {"User-Agent":"Mozilla/5.0 (compatible; CSPCalendar/1.0)", "Accept":"application/json,text/html,*/*"}
BLS = "https://www.bls.gov/schedule/news_release/bls.ics"
BEA = "https://www.bea.gov/news/schedule"
FED = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"

def get(url, **kw):
    response = requests.get(url, headers=HEADERS, timeout=18, **kw)
    response.raise_for_status()
    return response

def event(day, title, kind, source, clock="Time not supplied", symbol=""):
    return dict(date=day.isoformat(),title=title,kind=kind,source=source,time=clock,symbol=symbol)

def bls_ical():
    cal = Calendar.from_ical(get(BLS).content)
    out=[]
    for c in cal.walk("VEVENT"):
        dt=c.decoded("DTSTART")
        day=dt.date() if isinstance(dt,datetime) else dt
        title=str(c.get("SUMMARY","BLS release"))
        if any(w in title.lower() for w in ["consumer price","producer price","employment situation","job openings","employment cost","productivity","import","export"]):
            out.append(event(day,title,"Macro",BLS,dt.strftime("%H:%M ET") if isinstance(dt,datetime) else "Time not supplied"))
    if not out: raise ValueError("BLS calendar contained no recognized releases")
    return out


def bls():
    try:
        rows=bls_ical()
        if any(str(TODAY)<=e["date"]<=str(END) for e in rows):
            return rows
    except Exception:
        pass
    url="https://www.bls.gov/schedule/news_release/current_year.asp"
    soup=BeautifulSoup(get(url).text,"html.parser")
    out=[]
    for row in soup.select("tr"):
        cells=row.find_all(["td","th"])
        if len(cells)<3: continue
        raw=cells[0].get_text(" ",strip=True)
        match=re.search(r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})",raw)
        if not match: continue
        day=datetime.strptime(f"{match[1]} {match[2]} {match[3]}","%B %d %Y").date()
        title=cells[-1].get_text(" ",strip=True)
        if any(w in title.lower() for w in ["consumer price","producer price","employment situation","job openings","employment cost","productivity","import","export"]):
            out.append(event(day,title,"Macro",url,cells[1].get_text(" ",strip=True)+" ET"))
    if not any(str(TODAY)<=e["date"]<=str(END) for e in out):
        raise ValueError("No upcoming BLS releases found in official calendar or schedule")
    return out

def bea():
    soup=BeautifulSoup(get(BEA).text,"html.parser")
    out=[]
    for row in soup.select("tr"):
        text=row.get_text(" ",strip=True)
        match=re.search(r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:,?\s+(20\d{2}))?\s+(\d{1,2}:\d{2}\s*[AP]M)",text)
        if not match: continue
        year=int(match[3] or TODAY.year)
        day=datetime.strptime(f"{match[1]} {match[2]} {year}","%B %d %Y").date()
        title=text[match.end():].strip()
        if any(w in title for w in ["GDP","Personal Income and Outlays","International Trade"]):
            out.append(event(day,title,"Macro",BEA,match[4]+" ET"))
    if not out: raise ValueError("BEA release schedule format changed")
    return out

def fed():
    soup=BeautifulSoup(get(FED).text,"html.parser")
    out=[]
    for heading in soup.find_all(re.compile("^h[2-5]$")):
        m=re.search(r"(20\d{2}) FOMC Meetings",heading.get_text(" ",strip=True))
        if not m: continue
        year=int(m[1])
        lines=[]
        for node in heading.next_siblings:
            if getattr(node,"name",None) in ["h2","h3","h4","h5"]: break
            if hasattr(node,"get_text"): lines.append(node.get_text(" ",strip=True))
        container=heading.find_parent("div",class_="panel")
        text=container.get_text(" ",strip=True) if container else " ".join(lines)
        months="January|February|March|April|May|June|July|August|September|October|November|December"
        for match in re.finditer(r"("+months+r")\s+(\d{1,2})\s*[-–]\s*(\d{1,2})(\*?)",text):
            day=datetime.strptime(f"{match[1]} {match[3]} {year}","%B %d %Y").date()
            out.append(event(day,"FOMC decision"+(" + projections" if match[4] else ""),"Macro",FED,"Decision day; verify release time"))
    if not out: raise ValueError("FOMC meeting parser found no dates")
    return out

def earnings():
    key=os.getenv("FINNHUB_API_KEY")
    if key:
        payload=get("https://finnhub.io/api/v1/calendar/earnings",
                    params={"from":str(TODAY),"to":str(END),"token":key}).json()
        if "earningsCalendar" not in payload: raise ValueError("Earnings provider returned an error")
        return [event(date.fromisoformat(r["date"]),r["symbol"]+" earnings","Earnings",
                "https://finnhub.io/docs/api/earnings-calendar",r.get("hour") or "Time not supplied",r["symbol"])
                for r in payload["earningsCalendar"]]
    # Public Nasdaq calendar is a best-effort fallback; no API credentials go into the website.
    def daily(day):
        payload=get("https://api.nasdaq.com/api/calendar/earnings",params={"date":str(day)}).json()
        data=payload.get("data")
        if not isinstance(data,dict) or "rows" not in data:
            raise ValueError("Nasdaq earnings feed unavailable; configure FINNHUB_API_KEY")
        return [event(day,r.get("name",r["symbol"])+" earnings","Earnings",
                "https://www.nasdaq.com/market-activity/earnings",r.get("time") or "Time not supplied",r["symbol"])
                for r in (data["rows"] or [])]
    # Test access before sending the rest of the calendar requests.
    days=[TODAY+timedelta(days=i) for i in range(36)]
    out=daily(days[0])
    with ThreadPoolExecutor(max_workers=3) as pool:
        for rows in pool.map(daily,days[1:]): out.extend(rows)
    return out

def collect(fn):
    try:
        rows=fn()
        return rows,{"name":fn.__name__,"status":"ok","fetched_at":NOW.isoformat(),"records":len(rows)}
    except Exception as exc:
        if fn.__name__=="bls":
            cache=json.loads((ROOT/"data/bls-verified.json").read_text())
            rows=[e for e in cache["events"] if str(TODAY)<=e["date"]<=str(END)]
            if rows:
                return rows,{"name":"bls","status":"cached","fetched_at":None,
                    "records":len(rows),"verified_at":cache["verified_at"],
                    "message":"Live BLS unavailable. Selected scheduled dates last verified "+cache["verified_at"]+
                    "; not automatically reverified. Check original source for revisions."}
        # Do not log request URLs; they can contain provider credentials.
        return [],{"name":fn.__name__,"status":"unavailable","fetched_at":NOW.isoformat(),"message":(str(exc) if isinstance(exc,ValueError) else type(exc).__name__+": source unavailable")}

def analyse(symbol, events, sources, config):
    item={"symbol":symbol,"status":"DATA UNAVAILABLE","source":"https://finance.yahoo.com/quote/"+symbol+"/options/","candidates":[],"option_chains":[]}
    try:
        ticker=yf.Ticker(symbol)
        history_years=max(config["history_years"], config.get("signal_history_years", config["history_years"]))
        hist=ticker.history(period=str(history_years)+"y",auto_adjust=True)
        # Use completed sessions only; a partial daily bar must not distort historical tails.
        expected=last_completed_session(NOW)
        complete=hist[[d<=expected for d in hist.index.date]]["Close"].dropna()
        if len(complete)<252: raise ValueError("Not enough price history")
        spot=float(complete.iloc[-1])
        asof=complete.index[-1].date()
        if asof<expected: raise ValueError("Price history is stale")
        ev=relevant(events,symbol,config["earnings_proxies"])
        entry,status,near=timing(ev,TODAY)
        if entry==TODAY and expected==TODAY:
            from model import next_session
            entry=next_session(TODAY)
        missing=[s["name"] for s in sources if s["status"]!="ok"]
        item.update(price=round(spot,2),price_date=str(asof),reassess_date=str(entry),
                    status="INCOMPLETE CALENDAR" if missing else status,
                    blockers=[e["title"] for e in near],missing_sources=missing,
                    chart=[round(float(x),2) for x in complete.tail(60)])
        try:
            if list(complete.index.date) != sessions(complete.index[0].date(), asof):
                raise ValueError("Price history has missing market sessions")
            item["ml_signal"] = risk_signal(complete.to_numpy(), complete.index.date)
        except Exception:
            item["ml_signal"] = {"status": "SIGNAL UNAVAILABLE", "usable": False}
        expiries=[date.fromisoformat(x) for x in ticker.options]
        expiries=[x for x in expiries if config["min_dte"]<=(x-entry).days<=config["max_dte"]]
        expiries=sorted(expiries,key=lambda d:abs((d-entry).days-config["target_dte"]))[:3]
        screen_start=(pd.Timestamp(TODAY)-pd.DateOffset(years=config["history_years"])).date()
        screen=complete[[d >= screen_start for d in complete.index.date]]
        for expiry in sorted(expiries):
            horizon=len(sessions(asof+timedelta(days=1),expiry))
            risk=downside(screen.to_numpy(),horizon,config["tail_quantile"])
            ceiling=spot*(1+risk["tail"])
            bundle=ticker.option_chain(str(expiry))
            chain=bundle.puts
            item["option_chains"].append({"expiry":str(expiry),"fetched_at":NOW.isoformat(),
                "calls":chain_rows(bundle.calls),"puts":chain_rows(bundle.puts)})
            put=choose_put(chain.to_dict("records"),spot,ceiling)
            row={"expiry":str(expiry),"dte":(expiry-TODAY).days,"model_ceiling":round(ceiling,2),
                 "tail_pct":round(risk["tail"]*100,2),"worst_pct":round(risk["worst"]*100,2),
                 "samples":risk["samples"],"events":[e for e in ev if e["date"]<=str(expiry)],
                 "strike":None,"quote_note":"No qualifying regular put with usable bid/ask and open interest"}
            if put is not None:
                strike,bid,ask=map(float,[put["strike"],put["bid"],put["ask"]])
                row.update(strike=strike,bid=bid,ask=ask,collateral=round(strike*100,2),
                           premium=round(bid*100,2),breakeven=round(strike-bid,2),
                           cushion_pct=round((1-strike/spot)*100,2),
                           return_pct=round(bid/strike*100,2),
                           quote_note="Delayed indicative bid; confirm in broker. Bid timestamp not supplied.",
                           last_trade=str(put.get("lastTradeDate","Unknown")))
                try:
                    costs = config.get("scenario_costs", {})
                    if list(complete.index.date) != sessions(complete.index[0].date(), asof):
                        raise ValueError("Price history has missing market sessions")
                    row["payoff_scenarios"] = payoff_scenarios(complete.to_numpy(), horizon, strike, bid,
                        fee=costs.get("fee_per_contract", 2.), slippage=costs.get("slippage_per_share", .01))
                except Exception:
                    row["payoff_scenarios"] = {"status": "SCENARIOS UNAVAILABLE"}
            item["candidates"].append(row)
        if not expiries: item["detail"]="No listed expirations in the configured window."
    except Exception as exc:
        item["detail"]=type(exc).__name__+": price history or options unavailable; no executable target."
        if item["candidates"]: item["status"]="PARTIAL DATA"
    return item

def main():
    config=json.loads((ROOT/"config.json").read_text())
    results=[]
    with ThreadPoolExecutor(max_workers=4) as pool:
        results=list(pool.map(collect,[bls,bea,fed,earnings]))
    events=sorted([e for rows,_ in results for e in rows if str(TODAY)<=e["date"]<=str(END)],key=lambda e:(e["date"],e["kind"],e["title"]))
    events=list({(e["date"],e["title"],e["symbol"]):e for e in events}.values())
    sources=[s for _,s in results]
    for source in sources:
        source["upcoming_records"]=sum(1 for e in events if (source["name"]=="earnings")== (e["kind"]=="Earnings")) if source["name"]=="earnings" else len([e for rows,s in results if s["name"]==source["name"] for e in rows if str(TODAY)<=e["date"]<=str(END)])
        if source["name"]!="earnings" and source["upcoming_records"]==0:
            source["status"]="unavailable"
            source.setdefault("message","No upcoming events found; coverage requires review.")
    cards=[analyse(s,events,sources,config) for s in config["watchlist"]]
    output={"generated_at":NOW.isoformat(),"through":str(END),"events":events,"sources":sources,"watchlist":cards,
            "fed_projections":fed_projections(get,NOW),"analyst_targets":analyst_targets(config,NOW)}
    dest=ROOT/"site/data"; dest.mkdir(parents=True,exist_ok=True)
    (dest/"latest.json").write_text(json.dumps(output,indent=2,allow_nan=False)+"\n")
    print(json.dumps({"generated_at":output["generated_at"],"events":len(events),"sources":sources,
                      "symbols":[{"symbol":c["symbol"],"status":c["status"],"candidates":len(c["candidates"])} for c in cards]},indent=2))

if __name__=="__main__": main()

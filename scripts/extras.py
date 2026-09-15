"""Additional source data, deliberately separate from the historical strike model."""
import math, re
from datetime import datetime
from urllib.parse import urljoin
import yfinance as yf
from bs4 import BeautifulSoup

FED="https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"

def number(value):
    try:
        v=float(value)
        return v if math.isfinite(v) else None
    except (TypeError,ValueError): return None

def chain_rows(frame):
    rows=[]
    for r in frame.to_dict("records"):
        row={k:number(r.get(k)) for k in ["strike","bid","ask","lastPrice","volume","openInterest","impliedVolatility"]}
        row.update(contract=r.get("contractSymbol",""),size=r.get("contractSize",""),
                   last_trade=str(r.get("lastTradeDate","Unknown")))
        rows.append(row)
    return rows

def fed_projections(fetch,now):
    out={"status":"unavailable","source":FED,"rows":[],"fetched_at":now.isoformat()}
    try:
        soup=BeautifulSoup(fetch(FED).text,"html.parser")
        links={}
        for a in soup.select("a[href]"):
            m=re.search(r"fomcprojtabl(\d{8})\.htm",a["href"])
            if m and m[1]<=now.strftime("%Y%m%d"):
                links[m[1]]=urljoin(FED,a["href"])
        if not links: raise ValueError("No published projection table link found")
        stamp=max(links)
        out.update(source=links[stamp],published_at=datetime.strptime(stamp,"%Y%m%d").date().isoformat())
        page=BeautifulSoup(fetch(out["source"]).text,"html.parser")
        table=next(t for t in page.find_all("table") if "Federal funds rate" in t.get_text() and "Median" in t.get_text())
        rows=[[c.get_text(" ",strip=True) for c in tr.find_all(["th","td"])] for tr in table.find_all("tr")]
        years=next([c for c in row if re.fullmatch(r"20\d{2}|Longer run",c)][:4] for row in rows if sum(bool(re.fullmatch(r"20\d{2}|Longer run",c)) for c in row)>=4)
        rate=next(row for row in rows if row and row[0].startswith("Federal funds rate"))
        if len(years)!=4 or len(rate)<5: raise ValueError("Projection schema changed")
        values=[number(c) for c in rate[1:5]]
        if any(v is None for v in values): raise ValueError("Missing rate projection")
        out.update(status="ok",rows=[{"period":p,"median_rate":v} for p,v in zip(years,values)])
    except Exception:
        out["message"]="Latest Fed projection table could not be retrieved or parsed."
    return out

def analyst_targets(config,now):
    symbols=sorted(set(config["watchlist"]+[x for group in config["earnings_proxies"].values() for x in group]))
    result=[]
    for symbol in symbols:
        row={"symbol":symbol,"scope":"Watchlist instrument" if symbol in config["watchlist"] else "Selected constituent proxy",
             "source":"https://finance.yahoo.com/quote/"+symbol+"/analysis/","fetched_at":now.isoformat(),"status":"unavailable"}
        try:
            data=yf.Ticker(symbol).get_analyst_price_targets() or {}
            values={k:number(data.get(k)) for k in ["current","low","mean","median","high"]}
            if values["mean"] is not None and values["mean"]>0:
                row.update(values,status="ok")
        except Exception: pass
        result.append(row)
    return result

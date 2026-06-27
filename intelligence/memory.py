#!/usr/bin/env python3
"""Market Memory + Calibration (Pillar 4) and the Hypothesis Lab (Pillar 6).

Institutional memory: log every prediction the engine makes, score it against the
realised outcome when its horizon elapses, and measure how well-calibrated the
engine is — hit-rate, Brier score, a calibration curve, and per-causal-driver
accuracy. That feedback is what makes the graph trustworthy and "smarter every
year": confident edges that keep being wrong get marked down.

The Hypothesis Lab answers "what historically happens after <event>?" by
aggregating analog episodes in memory into conditional outcome stats with
evidence (n) and confidence.

SQLite, stdlib only. The historical analog data seeded here is ILLUSTRATIVE (this
environment has no real price history) — the framework and math are real; swap the
seed for a real backtest feed in production.

Run:
    python memory.py            # logs a prediction set, scores it, prints calibration + a hypothesis
"""
from __future__ import annotations

import sqlite3
from datetime import date, timedelta
from pathlib import Path

import engine

DB = Path(__file__).resolve().parent / "memory.db"

# company -> its sector (from the seed graph's membership edges) for per-sector scoring
SECTOR = {}
for (_s, _d, *_r) in engine.EDGES:
    if engine.NODES.get(_s, ("", ""))[1] == "sector" and engine.NODES.get(_d, ("", ""))[1] == "company":
        SECTOR.setdefault(_d, _s)


def connect():
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    return c


SCHEMA = """
CREATE TABLE IF NOT EXISTS predictions(
  id INTEGER PRIMARY KEY, created TEXT, scenario TEXT, entity TEXT, name TEXT,
  direction INTEGER, impact REAL, confidence REAL, horizon INTEGER, due TEXT,
  status TEXT DEFAULT 'open', realized REAL, correct INTEGER, brier REAL);
CREATE TABLE IF NOT EXISTS analogs(
  id INTEGER PRIMARY KEY, event_type TEXT, dt TEXT, sector TEXT, ret REAL);
"""


def init():
    with connect() as c:
        c.executescript(SCHEMA)


# --------------------------------------------------------------------------- #
# MARKET MEMORY — log predictions, score outcomes
# --------------------------------------------------------------------------- #
def log_analysis(analysis: dict, asof: date | None = None) -> int:
    """Persist every winner/loser of an analysis as a dated, falsifiable prediction."""
    asof = asof or date.today()
    rows = analysis["winners"] + analysis["losers"]
    with connect() as c:
        for r in rows:
            due = (asof + timedelta(days=r["horizon_days"])).isoformat()
            c.execute("INSERT INTO predictions(created,scenario,entity,name,direction,impact,"
                      "confidence,horizon,due) VALUES(?,?,?,?,?,?,?,?,?)",
                      (asof.isoformat(), analysis["id"], r["id"], r["name"],
                       1 if r["impact"] > 0 else -1, r["impact"], r["confidence"],
                       r["horizon_days"], due))
    return len(rows)


def score(realized: dict[str, float]):
    """Resolve open predictions against realised returns (entity_id -> % move)."""
    with connect() as c:
        for p in c.execute("SELECT * FROM predictions WHERE status='open'").fetchall():
            if p["entity"] not in realized:
                continue
            ret = realized[p["entity"]]
            outcome = 1 if (ret > 0) == (p["direction"] > 0) else 0
            brier = (p["confidence"] - outcome) ** 2
            c.execute("UPDATE predictions SET status='scored', realized=?, correct=?, brier=? "
                      "WHERE id=?", (ret, outcome, brier, p["id"]))


def calibration() -> dict:
    with connect() as c:
        ps = c.execute("SELECT * FROM predictions WHERE status='scored'").fetchall()
    n = len(ps)
    if not n:
        return {"n": 0}
    hit = sum(p["correct"] for p in ps) / n
    brier = sum(p["brier"] for p in ps) / n
    # calibration curve: are 70%-confidence calls right ~70% of the time?
    buckets = [(0.0, 0.5), (0.5, 0.65), (0.65, 0.8), (0.8, 1.01)]
    curve = []
    for lo, hi in buckets:
        b = [p for p in ps if lo <= p["confidence"] < hi]
        if b:
            curve.append({"band": f"{int(lo*100)}-{int(hi*100 if hi<=1 else 100)}%", "n": len(b),
                          "avg_conf": round(sum(p["confidence"] for p in b) / len(b), 2),
                          "actual_hit": round(sum(p["correct"] for p in b) / len(b), 2)})
    by_sector = {}
    for p in ps:
        sec = engine.NODES.get(SECTOR.get(p["entity"], ""), (None,))[0] or "other"
        by_sector.setdefault(sec, []).append(p["correct"])
    sectors = sorted(({"sector": s, "n": len(v), "hit": round(sum(v) / len(v), 2)}
                      for s, v in by_sector.items()), key=lambda d: -d["n"])
    by_scn = {}
    for p in ps:
        by_scn.setdefault(p["scenario"], []).append(p["correct"])
    scn = [{"scenario": s, "n": len(v), "hit": round(sum(v) / len(v), 2)} for s, v in by_scn.items()]
    return {"n": n, "hit_rate": round(hit, 3), "brier": round(brier, 3),
            "curve": curve, "by_sector": sectors, "by_scenario": scn}


# --------------------------------------------------------------------------- #
# HYPOTHESIS LAB — conditional outcome stats from analog episodes
# --------------------------------------------------------------------------- #
def hypothesis(event_type: str) -> dict:
    with connect() as c:
        rows = c.execute("SELECT * FROM analogs WHERE event_type=?", (event_type,)).fetchall()
    if not rows:
        return {"event_type": event_type, "episodes": 0, "sectors": []}
    episodes = len({r["dt"] for r in rows})
    by_sector = {}
    for r in rows:
        by_sector.setdefault(r["sector"], []).append(r["ret"])
    out = []
    for sec, rets in by_sector.items():
        avg = sum(rets) / len(rets)
        consistency = sum(1 for x in rets if (x > 0) == (avg > 0)) / len(rets)
        out.append({"sector": engine.NODES.get(sec, (sec,))[0], "avg_return": round(avg, 1),
                    "consistency": round(consistency, 2), "n": len(rets),
                    "confidence": round(min(0.95, consistency * (1 - 1 / (len(rets) + 1))), 2)})
    out.sort(key=lambda d: -abs(d["avg_return"]))
    return {"event_type": event_type, "episodes": episodes, "sectors": out}


def seed_analogs():
    """Illustrative historical episodes for the Hypothesis Lab (swap for a real feed)."""
    data = [
        # event_type, date, sector, realised % over the horizon
        ("rbi_cut", "2019-08", "BANKS", 5.1), ("rbi_cut", "2019-08", "REALTY", 7.8),
        ("rbi_cut", "2019-08", "AUTO", 4.2), ("rbi_cut", "2020-03", "BANKS", 3.4),
        ("rbi_cut", "2020-03", "REALTY", 6.0), ("rbi_cut", "2020-03", "AUTO", 2.1),
        ("rbi_cut", "2015-01", "BANKS", 4.0), ("rbi_cut", "2015-01", "REALTY", 5.2),
        ("rbi_cut", "2015-01", "AUTO", -0.5),
        ("crude_spike", "2018-05", "UPSTREAM", 9.0), ("crude_spike", "2018-05", "AVIATION", -11.0),
        ("crude_spike", "2018-05", "OMC", -7.5), ("crude_spike", "2018-05", "IT", 4.5),
        ("crude_spike", "2021-10", "UPSTREAM", 7.2), ("crude_spike", "2021-10", "AVIATION", -8.0),
        ("crude_spike", "2021-10", "IT", 3.1),
        ("budget_capex", "2023-02", "CAPGOODS", 8.5), ("budget_capex", "2023-02", "CEMENT", 6.0),
        ("budget_capex", "2023-02", "INFRA", 9.1), ("budget_capex", "2024-02", "CAPGOODS", 6.8),
        ("budget_capex", "2024-02", "INFRA", 7.4),
    ]
    with connect() as c:
        if c.execute("SELECT count(*) FROM analogs").fetchone()[0] == 0:
            c.executemany("INSERT INTO analogs(event_type,dt,sector,ret) VALUES(?,?,?,?)", data)


def main():
    init()
    seed_analogs()

    # 1. log a prediction set from a fresh analysis (as if made some weeks ago)
    asof = date.today() - timedelta(days=30)
    a = engine.analyze("crude")
    n = log_analysis(a, asof=asof)
    print(f"logged {n} predictions from scenario '{a['id']}' as of {asof}\n")

    # 2. score them against (illustrative) realised returns now that the horizon elapsed
    realized = {"ONGC": 6.2, "OIL": 4.1, "TCS": 2.0, "INFY": 1.6, "HCLTECH": 1.2,
                "RELIANCE": -1.4, "INDIGO": -5.5, "BPCL": -3.2, "IOC": -2.8, "HPCL": -2.6,
                "ASIANPAINT": 1.1, "BERGEPAINT": 0.7}  # paints rose despite the call → a miss
    score(realized)
    cal = calibration()
    print("CALIBRATION  (how trustworthy is the engine?)")
    print(f"  scored predictions : {cal['n']}")
    print(f"  hit-rate           : {cal['hit_rate']:.0%}   (direction correct)")
    print(f"  Brier score        : {cal['brier']:.3f}   (0 = perfect, lower is better)")
    print("  calibration curve  : is a 70% call right ~70% of the time?")
    for b in cal["curve"]:
        flag = "well-calibrated" if abs(b["avg_conf"] - b["actual_hit"]) <= 0.12 else \
               ("over-confident" if b["avg_conf"] > b["actual_hit"] else "under-confident")
        print(f"      conf {b['band']:<8} n={b['n']}  said {b['avg_conf']:.0%}  was {b['actual_hit']:.0%}  → {flag}")
    print("  by sector          :")
    for s in cal["by_sector"]:
        print(f"      {s['sector']:<20} hit {s['hit']:.0%}  (n={s['n']})")

    # 3. Hypothesis Lab
    print("\nHYPOTHESIS LAB — what historically happens after an RBI rate cut?")
    h = hypothesis("rbi_cut")
    print(f"  {h['episodes']} analog episodes")
    for s in h["sectors"]:
        print(f"      {s['sector']:<10} avg {s['avg_return']:+.1f}%  "
              f"consistency {s['consistency']:.0%}  (n={s['n']}, confidence {s['confidence']:.0%})")
    print("\n  → these are evidence-weighted priors the engine and copilot can cite, not vibes.")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""India Financial Reasoning Engine — canonical core (Phase 2).

The single source of truth for the knowledge graph + causal propagation. The CLI
(propagate.py) and the API (service.py) both import `analyze()` from here so there
is no logic drift. See ARCHITECTURE.md.

Phase 2 expands the seed graph beyond the crude/rates slice to cover EV/battery/
copper/grid, government capex/infra, metals, defence and themes — so the engine
can reason about the structural-shift examples (e.g. an EV subsidy surfacing
transformer makers and copper as hidden 2nd/3rd-order beneficiaries).
"""
from __future__ import annotations

# --------------------------------------------------------------------------- #
# KNOWLEDGE GRAPH   id -> (name, type, coverage 0-1 = analyst/news attention)
# --------------------------------------------------------------------------- #
NODES = {
    # macro / commodity / policy drivers
    "CRUDE": ("Brent crude", "commodity", 0.95), "COPPER": ("Copper", "commodity", 0.55),
    "STEEL": ("Steel", "commodity", 0.6), "LITHIUM": ("Lithium", "commodity", 0.45),
    "INR": ("USD/INR (rupee strength)", "macro", 0.85), "CPI": ("CPI inflation", "macro", 0.9),
    "REPO": ("RBI repo rate", "macro", 0.9), "TRANSPORT": ("Freight / logistics cost", "macro", 0.4),
    "GOVT_CAPEX": ("Government capex", "policy", 0.6), "EV_SUBSIDY": ("EV subsidy (FAME)", "policy", 0.55),
    "DEFENCE_BUDGET": ("Defence budget", "policy", 0.5), "RBI": ("Reserve Bank of India", "institution", 0.9),
    # sectors
    "OMC": ("Oil marketing", "sector", 0.6), "UPSTREAM": ("Upstream oil & gas", "sector", 0.5),
    "AUTO": ("Automobiles", "sector", 0.85), "PAINTS": ("Paints", "sector", 0.55),
    "TYRE": ("Tyres", "sector", 0.4), "AVIATION": ("Aviation", "sector", 0.6),
    "BANKS": ("Banks", "sector", 0.9), "IT": ("IT services", "sector", 0.85),
    "PHARMA": ("Pharma", "sector", 0.6), "FMCG": ("FMCG", "sector", 0.75),
    "REALTY": ("Realty", "sector", 0.55), "METALS": ("Metals & mining", "sector", 0.7),
    "CAPGOODS": ("Capital goods", "sector", 0.6), "CEMENT": ("Cement", "sector", 0.6),
    "POWER": ("Power & utilities", "sector", 0.6), "GRID": ("Grid / transformers (T&D)", "sector", 0.4),
    "DEFENCE": ("Defence", "sector", 0.55), "EV": ("EV & ancillaries", "sector", 0.55),
    "BATTERY": ("Batteries", "sector", 0.45), "INFRA": ("Infra / construction", "sector", 0.55),
    # companies
    "RELIANCE": ("Reliance Industries", "company", 0.95), "ONGC": ("ONGC", "company", 0.6),
    "OIL": ("Oil India", "company", 0.35), "BPCL": ("BPCL", "company", 0.6),
    "IOC": ("IOC", "company", 0.5), "HPCL": ("HPCL", "company", 0.5),
    "ASIANPAINT": ("Asian Paints", "company", 0.85), "BERGEPAINT": ("Berger Paints", "company", 0.55),
    "MRF": ("MRF", "company", 0.5), "APOLLOTYRE": ("Apollo Tyres", "company", 0.4),
    "INDIGO": ("IndiGo", "company", 0.75), "MARUTI": ("Maruti Suzuki", "company", 0.85),
    "TATAMOTORS": ("Tata Motors", "company", 0.85), "MM": ("M&M", "company", 0.7),
    "HEROMOTOCO": ("Hero MotoCorp", "company", 0.6), "HDFCBANK": ("HDFC Bank", "company", 0.95),
    "ICICIBANK": ("ICICI Bank", "company", 0.9), "SBIN": ("State Bank of India", "company", 0.85),
    "TCS": ("TCS", "company", 0.9), "INFY": ("Infosys", "company", 0.9), "HCLTECH": ("HCLTech", "company", 0.7),
    "SUNPHARMA": ("Sun Pharma", "company", 0.7), "HINDUNILVR": ("Hindustan Unilever", "company", 0.85),
    "ITC": ("ITC", "company", 0.8), "NESTLEIND": ("Nestle India", "company", 0.75),
    "DLF": ("DLF", "company", 0.6),
    # metals
    "TATASTEEL": ("Tata Steel", "company", 0.8), "JSWSTEEL": ("JSW Steel", "company", 0.75),
    "HINDALCO": ("Hindalco", "company", 0.7), "VEDL": ("Vedanta", "company", 0.6),
    "HINDCOPPER": ("Hindustan Copper", "company", 0.3),
    # capital goods / infra / cement / power / grid
    "LT": ("Larsen & Toubro", "company", 0.85), "SIEMENS": ("Siemens India", "company", 0.6),
    "ABB": ("ABB India", "company", 0.55), "BHEL": ("BHEL", "company", 0.5),
    "CGPOWER": ("CG Power (transformers)", "company", 0.45), "ULTRACEMCO": ("UltraTech Cement", "company", 0.8),
    "SHREECEM": ("Shree Cement", "company", 0.6), "ACC": ("ACC", "company", 0.55),
    "POWERGRID": ("Power Grid Corp", "company", 0.7), "NTPC": ("NTPC", "company", 0.75),
    "TATAPOWER": ("Tata Power", "company", 0.65),
    # defence
    "HAL": ("Hindustan Aeronautics", "company", 0.65), "BEL": ("Bharat Electronics", "company", 0.65),
    "BDL": ("Bharat Dynamics", "company", 0.45), "MAZDOCK": ("Mazagon Dock", "company", 0.45),
    # ev / battery
    "EXIDEIND": ("Exide Industries", "company", 0.55), "AMARAJA": ("Amara Raja", "company", 0.45),
}

# --------------------------------------------------------------------------- #
# CAUSAL EDGES   (src, dst, sign, strength, confidence, lag_days, rationale)
# sign = d(dst)/d(src). INR node value = rupee STRENGTH (up = stronger).
# --------------------------------------------------------------------------- #
EDGES = [
    # crude transmission
    ("CRUDE", "TRANSPORT", +1, 0.70, 0.85, 15, "fuel is a major freight input"),
    ("CRUDE", "CPI", +1, 0.45, 0.80, 30, "fuel + freight feed inflation"),
    ("TRANSPORT", "CPI", +1, 0.40, 0.75, 30, "higher freight lifts goods prices"),
    ("CRUDE", "INR", -1, 0.50, 0.70, 20, "import bill widens CAD, weakens rupee"),
    ("CPI", "REPO", +1, 0.60, 0.70, 45, "RBI hikes repo to fight inflation"),
    ("REPO", "INR", +1, 0.30, 0.55, 30, "higher rates support the rupee"),
    ("REPO", "AUTO", -1, 0.50, 0.65, 60, "costlier financing cools demand"),
    ("REPO", "REALTY", -1, 0.60, 0.70, 60, "home-loan rates hit affordability"),
    ("REPO", "BANKS", +1, 0.40, 0.55, 30, "NIM expands as rates rise"),
    ("CRUDE", "UPSTREAM", +1, 0.80, 0.85, 5, "realisations rise for explorers"),
    ("CRUDE", "OMC", -1, 0.65, 0.70, 10, "marketing margins squeezed"),
    ("CRUDE", "PAINTS", -1, 0.60, 0.70, 20, "crude derivatives ~35% of cost"),
    ("CRUDE", "TYRE", -1, 0.45, 0.60, 20, "rubber + carbon black are crude-linked"),
    ("CRUDE", "AVIATION", -1, 0.80, 0.80, 10, "ATF ~40% of airline cost"),
    ("CRUDE", "AUTO", -1, 0.25, 0.55, 25, "input cost + weaker demand"),
    ("CRUDE", "FMCG", -1, 0.20, 0.50, 30, "crude-linked packaging + transport"),
    ("CRUDE", "RELIANCE", +1, 0.25, 0.45, 10, "refining GRMs can improve"),
    ("CPI", "FMCG", -1, 0.30, 0.55, 30, "inflation crimps rural volumes"),
    ("INR", "IT", -1, 0.60, 0.70, 15, "weaker rupee lifts USD exporters"),
    ("INR", "PHARMA", -1, 0.40, 0.60, 20, "weaker rupee aids exports"),
    ("INR", "FMCG", +1, 0.15, 0.50, 20, "weaker rupee raises input cost"),
    # EV / battery / copper / grid chain (structural shift)
    ("EV_SUBSIDY", "EV", +1, 0.80, 0.75, 60, "subsidy lifts EV demand"),
    ("EV", "BATTERY", +1, 0.70, 0.70, 90, "more EVs drive battery demand"),
    ("EV", "COPPER", +1, 0.55, 0.65, 90, "EVs use ~4x the copper of an ICE car"),
    ("BATTERY", "LITHIUM", +1, 0.60, 0.60, 90, "cells need lithium"),
    ("EV", "GRID", +1, 0.45, 0.55, 150, "charging build-out needs T&D + transformers"),
    ("GOVT_CAPEX", "GRID", +1, 0.40, 0.60, 120, "grid modernisation capex"),
    ("COPPER", "METALS", +1, 0.50, 0.65, 30, "copper miners' realisations"),
    ("GRID", "CGPOWER", +1, 0.80, 0.75, 30, "transformer & T&D maker"),
    ("GRID", "SIEMENS", +1, 0.55, 0.65, 30, "grid automation + transformers"),
    ("GRID", "ABB", +1, 0.55, 0.65, 30, "grid equipment"),
    ("GRID", "POWERGRID", +1, 0.50, 0.70, 60, "transmission utility"),
    ("COPPER", "HINDCOPPER", +1, 0.85, 0.70, 20, "pure-play copper miner"),
    ("METALS", "HINDALCO", +1, 0.70, 0.75, 20, "aluminium + copper"),
    ("METALS", "VEDL", +1, 0.70, 0.70, 20, "diversified metals incl copper"),
    ("BATTERY", "EXIDEIND", +1, 0.80, 0.70, 30, "lead-acid + Li-ion battery maker"),
    ("BATTERY", "AMARAJA", +1, 0.75, 0.65, 30, "battery maker, EV bets"),
    ("EV", "TATAMOTORS", +1, 0.55, 0.60, 60, "EV market leader (PV)"),
    ("EV", "MM", +1, 0.45, 0.55, 60, "EV SUV push"),
    # government capex / infra / cement / steel / power
    ("GOVT_CAPEX", "INFRA", +1, 0.75, 0.70, 90, "roads, rail, ports order flow"),
    ("GOVT_CAPEX", "CAPGOODS", +1, 0.65, 0.65, 90, "equipment & EPC orders"),
    ("GOVT_CAPEX", "CEMENT", +1, 0.55, 0.65, 90, "construction demand"),
    ("GOVT_CAPEX", "POWER", +1, 0.50, 0.60, 120, "generation + grid spend"),
    ("GOVT_CAPEX", "STEEL", +1, 0.55, 0.65, 60, "construction steel demand"),
    ("INFRA", "LT", +1, 0.85, 0.80, 30, "largest EPC / infra"),
    ("CAPGOODS", "SIEMENS", +1, 0.65, 0.65, 30, "capital equipment"),
    ("CAPGOODS", "ABB", +1, 0.60, 0.65, 30, "automation & equipment"),
    ("CAPGOODS", "BHEL", +1, 0.60, 0.55, 45, "power equipment PSU"),
    ("CEMENT", "ULTRACEMCO", +1, 0.85, 0.80, 20, "cement leader"),
    ("CEMENT", "SHREECEM", +1, 0.80, 0.75, 20, "cement major"),
    ("CEMENT", "ACC", +1, 0.75, 0.70, 20, "cement major"),
    ("POWER", "NTPC", +1, 0.80, 0.80, 30, "largest generator"),
    ("POWER", "POWERGRID", +1, 0.55, 0.75, 30, "transmission"),
    ("POWER", "TATAPOWER", +1, 0.70, 0.70, 30, "integrated power + EV charging"),
    ("STEEL", "TATASTEEL", +1, 0.85, 0.80, 20, "steel major"),
    ("STEEL", "JSWSTEEL", +1, 0.85, 0.80, 20, "steel major"),
    # defence
    ("DEFENCE_BUDGET", "DEFENCE", +1, 0.85, 0.75, 90, "order inflow to defence PSUs"),
    ("DEFENCE", "HAL", +1, 0.85, 0.80, 30, "aircraft / engines"),
    ("DEFENCE", "BEL", +1, 0.85, 0.80, 30, "defence electronics"),
    ("DEFENCE", "BDL", +1, 0.80, 0.70, 30, "missiles"),
    ("DEFENCE", "MAZDOCK", +1, 0.80, 0.70, 30, "warship building"),
    # crude/steel input cost on autos (negative)
    ("STEEL", "AUTO", -1, 0.25, 0.55, 40, "steel is a key auto input cost"),
    # sector -> company membership (original slice)
    ("UPSTREAM", "ONGC", +1, 0.90, 0.90, 5, "upstream"),
    ("UPSTREAM", "OIL", +1, 0.85, 0.85, 5, "upstream"),
    ("OMC", "BPCL", +1, 0.90, 0.90, 5, "OMC"), ("OMC", "IOC", +1, 0.85, 0.85, 5, "OMC"),
    ("OMC", "HPCL", +1, 0.85, 0.85, 5, "OMC"),
    ("PAINTS", "ASIANPAINT", +1, 0.90, 0.90, 5, "paints"),
    ("PAINTS", "BERGEPAINT", +1, 0.85, 0.85, 5, "paints"),
    ("TYRE", "MRF", +1, 0.85, 0.85, 5, "tyre"), ("TYRE", "APOLLOTYRE", +1, 0.85, 0.85, 5, "tyre"),
    ("AVIATION", "INDIGO", +1, 0.95, 0.90, 5, "carrier"),
    ("AUTO", "MARUTI", +1, 0.90, 0.85, 5, "cars"), ("AUTO", "TATAMOTORS", +1, 0.80, 0.80, 5, "auto"),
    ("AUTO", "MM", +1, 0.80, 0.80, 5, "SUV + tractor"), ("AUTO", "HEROMOTOCO", +1, 0.70, 0.80, 5, "2W"),
    ("BANKS", "HDFCBANK", +1, 0.90, 0.90, 5, "bank"), ("BANKS", "ICICIBANK", +1, 0.90, 0.90, 5, "bank"),
    ("BANKS", "SBIN", +1, 0.85, 0.85, 5, "bank"),
    ("IT", "TCS", +1, 0.90, 0.90, 5, "IT"), ("IT", "INFY", +1, 0.90, 0.90, 5, "IT"),
    ("IT", "HCLTECH", +1, 0.85, 0.85, 5, "IT"),
    ("PHARMA", "SUNPHARMA", +1, 0.85, 0.85, 5, "pharma"),
    ("FMCG", "HINDUNILVR", +1, 0.85, 0.85, 5, "FMCG"), ("FMCG", "ITC", +1, 0.55, 0.75, 5, "FMCG"),
    ("FMCG", "NESTLEIND", +1, 0.80, 0.85, 5, "FMCG"), ("REALTY", "DLF", +1, 0.85, 0.85, 5, "realty"),
]

SCENARIOS = {
    "crude": ("Brent crude spikes +20%", {"CRUDE": +1.0}),
    "repo": ("RBI hikes repo +50bps", {"REPO": +1.0}),
    "inr": ("Rupee weakens ~5%", {"INR": -1.0}),
    "crudedrop": ("Counterfactual: crude falls to $40", {"CRUDE": -1.0}),
    "repocut": ("Counterfactual: RBI cuts 25bps", {"REPO": -1.0}),
    # Phase 2 compound "world simulator" scenarios
    "ev_push": ("Government deepens the EV subsidy", {"EV_SUBSIDY": +1.0}),
    "infra_boom": ("Big government capex / infra push", {"GOVT_CAPEX": +1.0}),
    "defence_push": ("Defence budget step-up", {"DEFENCE_BUDGET": +1.0}),
    "stagflation": ("Stagflation: crude +20% & rupee weak", {"CRUDE": +1.0, "INR": -0.5}),
}

ADJ: dict[str, list[tuple]] = {}
for _e in EDGES:
    ADJ.setdefault(_e[0], []).append(_e)

DECAY, EPS, MAX_HOPS = 0.9, 0.02, 6


def nm(n: str) -> str:
    return NODES.get(n, (n,))[0]


def propagate(seeds: dict[str, float], event_conf: float = 0.9) -> dict[str, dict]:
    acc: dict[str, dict] = {}

    def visit(node, mag, conf, lag, chain):
        for (_s, dst, sign, strength, econf, elag, why) in ADJ.get(node, []):
            if any(step["node"] == dst for step in chain):
                continue
            m2 = mag * sign * strength * DECAY
            if abs(m2) < EPS:
                continue
            c2, l2 = conf * econf, lag + elag
            step = {"node": dst, "name": nm(dst), "sign": sign, "why": why, "contribution": round(m2, 3)}
            new_chain = chain + [step]
            rec = acc.setdefault(dst, {"impact": 0.0, "best": 0.0, "conf": 0.0, "horizon": 0, "chain": []})
            rec["impact"] += m2
            if abs(m2) > abs(rec["best"]):
                rec["best"], rec["conf"], rec["horizon"], rec["chain"] = m2, c2, l2, new_chain
            if len(new_chain) < MAX_HOPS:
                visit(dst, m2, c2, l2, new_chain)

    for seed, impulse in seeds.items():
        visit(seed, impulse, event_conf, 0, [{"node": seed, "name": nm(seed), "why": "event", "contribution": impulse}])
    return acc


def _row(n, r):
    return {"id": n, "name": nm(n), "impact": round(r["impact"], 3), "confidence": round(r["conf"], 3),
            "horizon_days": r["horizon"], "chain": r["chain"]}


def analyze(scenario_id: str) -> dict:
    """Structured 8-question answer for a scenario. Used by CLI + API."""
    label, seeds = SCENARIOS[scenario_id]
    acc = propagate(seeds)
    comp = {n: r for n, r in acc.items() if NODES.get(n, ("", ""))[1] == "company"}
    ranked = sorted(comp.items(), key=lambda kv: kv[1]["impact"], reverse=True)
    winners = [_row(n, r) for n, r in ranked if r["impact"] > 0]
    losers = [_row(n, r) for n, r in sorted(comp.items(), key=lambda kv: kv[1]["impact"]) if r["impact"] < 0]
    nxt = [_row(n, r) for n, r in sorted(comp.items(), key=lambda kv: kv[1]["horizon"]) if r["horizon"] >= 60]
    blind = sorted(comp.items(), key=lambda kv: abs(kv[1]["impact"]) * (1 - NODES[kv[0]][2]), reverse=True)
    opps = [{"id": n, "name": nm(n), "impact": round(r["impact"], 3), "coverage": NODES[n][2],
             "tag": "under-covered beneficiary" if r["impact"] > 0 else "under-priced risk"}
            for n, r in blind[:6]]
    macro = [_row(n, acc[n]) for n in ("TRANSPORT", "CPI", "REPO", "INR", "COPPER", "STEEL") if n in acc]
    sectors = sorted(([{"id": n, "name": nm(n), "impact": round(r["impact"], 3)}
                       for n, r in acc.items() if NODES.get(n, ("", ""))[1] in ("sector",)]),
                     key=lambda d: d["impact"], reverse=True)
    assum = sorted([e for e in EDGES if e[0] in seeds or e[0] in ("CPI", "REPO", "INR", "EV", "GRID", "GOVT_CAPEX")],
                   key=lambda e: e[3] * e[4], reverse=True)[:5]
    assumptions = [{"src": nm(e[0]), "dst": nm(e[1]), "sign": e[2], "strength": e[3],
                    "confidence": e[4], "why": e[6]} for e in assum]
    return {"id": scenario_id, "label": label, "seeds": seeds, "affected": len(acc),
            "macro_transmission": macro, "winners": winners, "losers": losers, "whats_next": nxt[:6],
            "assumptions": assumptions, "opportunities": opps, "sector_impacts": sectors}


def graph_json() -> dict:
    return {"nodes": [{"id": k, "name": v[0], "type": v[1], "coverage": v[2]} for k, v in NODES.items()],
            "edges": [{"src": e[0], "dst": e[1], "sign": e[2], "strength": e[3],
                       "confidence": e[4], "lag": e[5], "why": e[6]} for e in EDGES]}

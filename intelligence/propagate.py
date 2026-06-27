#!/usr/bin/env python3
"""CLI for the India Financial Reasoning Engine.

Thin wrapper over engine.analyze() so the CLI and the API (service.py) share one
brain. Prints an explainable 8-question report for a scenario.

Run:
    python propagate.py crude        # also: repo inr crudedrop repocut
    python propagate.py ev_push      # EV subsidy -> battery -> copper -> grid
    python propagate.py infra_boom   # government capex
    python propagate.py stagflation  # crude up + rupee weak
    python propagate.py              # lists scenarios
"""
from __future__ import annotations

import sys

from engine import SCENARIOS, analyze, nm


def chain_str(chain):
    out = []
    for step in chain:
        if step["why"] == "event":
            out.append(step["name"])
        else:
            arrow = "  --(+)-->  " if step["sign"] > 0 else "  --(-)-->  "
            out.append(f"{arrow}{step['name']}  [{step['why']}]")
    return "".join(out)


def report(sid: str):
    r = analyze(sid)
    P = print
    P("=" * 76)
    P(f"  EVENT:  {r['label']}   ({r['affected']} entities affected)")
    P("=" * 76)

    P("\nWHAT HAPPENED\n  " + r["label"] + ".")

    P("\nWHY IT MATTERS (causal transmission)")
    for m in r["macro_transmission"]:
        P(f"  • {m['name']}: {'+' if m['impact']>0 else ''}{m['impact']:.2f} "
          f"(~{m['horizon_days']}d){chain_str(m['chain'])}")

    P("\nWHO BENEFITS")
    for w in r["winners"][:7]:
        P(f"  ▲ {w['name']:<24} +{w['impact']:.2f}  conf {w['confidence']:.0%}  ~{w['horizon_days']}d")
        P(f"      {chain_str(w['chain'])}")

    P("\nWHO GETS HURT")
    for l in r["losers"][:6]:
        P(f"  ▼ {l['name']:<24} {l['impact']:.2f}  conf {l['confidence']:.0%}  ~{l['horizon_days']}d")
        P(f"      {chain_str(l['chain'])}")

    P("\nWHAT HAPPENS NEXT (second / third-order, by horizon)")
    for n in r["whats_next"]:
        P(f"  → ~{n['horizon_days']}d  {n['name']:<22} {'+' if n['impact']>0 else ''}{n['impact']:.2f}")

    P("\nSYSTEM-WIDE (sector impacts — the world simulator view)")
    for s in r["sector_impacts"][:6]:
        P(f"  {'+' if s['impact']>0 else ''}{s['impact']:>5.2f}  {s['name']}")

    P("\nWHICH ASSUMPTIONS THIS DEPENDS ON")
    for a in r["assumptions"]:
        P(f"  ? {a['src']} → {a['dst']}  ({'+' if a['sign']>0 else '-'}, strength "
          f"{a['strength']:.0%}, confidence {a['confidence']:.0%}): {a['why']}")

    P("\nOPPORTUNITIES / WHAT THE MARKET IS MISSING")
    for o in r["opportunities"][:5]:
        P(f"  ★ {o['name']:<24} {'+' if o['impact']>0 else ''}{o['impact']:.2f}  "
          f"coverage {o['coverage']:.0%}  → {o['tag']}")
    P("")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("scenarios:")
        for k, (lbl, _) in SCENARIOS.items():
            print(f"  {k:<13} {lbl}")
        sys.exit(0)
    sid = sys.argv[1]
    if sid not in SCENARIOS:
        print(f"unknown scenario '{sid}'. options: {', '.join(SCENARIOS)}")
        sys.exit(1)
    report(sid)

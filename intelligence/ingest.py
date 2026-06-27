#!/usr/bin/env python3
"""Ingestion pipeline — grow the knowledge graph from text (Phase 3).

Document (news / corporate announcement) -> extract entities, events, relationships
-> entity-link to canonical ids -> merge into the graph store with provenance.

Extraction has two paths:
  • LLM (Claude)  — used when ANTHROPIC_API_KEY is set: a JSON-schema prompt returns
    structured {entities, events, relationships}. This is the real, scalable path.
  • Rule-based    — deterministic gazetteer + trigger phrases, runs with no key so
    the whole loop is demonstrable offline. Lower recall, but real.

Every node/edge written carries Provenance(source, method, confidence, time) so the
fact is traceable and later calibratable.

Run:
    python ingest.py            # seed the store, ingest the bundled samples, show growth
"""
from __future__ import annotations

import json
import os
import re

import engine
from graph_store import GraphStore, Provenance, get_store

# --------------------------------------------------------------------------- #
# entity linking — gazetteer of canonical ids (seed graph + a few known extras)
# --------------------------------------------------------------------------- #
GAZ: dict[str, tuple[str, str]] = {}
for _id, (_name, _type, _) in engine.NODES.items():
    GAZ[_name.lower()] = (_id, _type)
GAZ.update({  # aliases + entities not yet in the seed graph (these create new nodes)
    "tata motors": ("TATAMOTORS", "company"), "exide": ("EXIDEIND", "company"),
    "bharat electronics": ("BEL", "company"), "bel": ("BEL", "company"),
    "adani green": ("ADANIGREEN", "company"), "waaree": ("WAAREE", "company"),
    "ministry of defence": ("MOD", "institution"), "nhai": ("NHAI", "institution"),
})
THEMES = {"solar": ("SOLAR", "theme"), "semiconductor": ("SEMICON", "theme"),
          "renewable": ("RENEWABLE", "theme"), "defence": ("DEFENCE", "sector"),
          "ev": ("EV", "sector"), "5g": ("FIVEG", "theme")}

POS = re.compile(r"\b(supply|supplies|supplier|sources|pact|partner|partnership|tie-up|jv|"
                 r"order|contract|awarded|wins|bags|acquire|stake|subsidy|incentive|pli|scheme|"
                 r"approval|expansion|launch)\b", re.I)
NEG = re.compile(r"\b(ban|penalty|probe|fine|recall|downgrade|default|fraud|halt|strike)\b", re.I)


def _slug(name: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", name.upper())[:14] or "ENT"


def detect_entities(text: str):
    found = {}
    low = text.lower()
    for alias, (eid, etype) in sorted(GAZ.items(), key=lambda kv: -len(kv[0])):
        if re.search(r"\b" + re.escape(alias) + r"\b", low):
            found.setdefault(eid, {"id": eid, "name": engine.NODES.get(eid, (alias.title(),))[0],
                                   "type": etype, "new": eid not in engine.NODES})
    for kw, (tid, ttype) in THEMES.items():
        if re.search(r"\b" + re.escape(kw) + r"\b", low):
            found.setdefault(tid, {"id": tid, "name": kw.title(), "type": ttype,
                                   "new": tid not in engine.NODES})
    return list(found.values())


def rule_extract(text: str) -> dict:
    ents = detect_entities(text)
    sign = -1 if NEG.search(text) else 1
    rels, events = [], []
    companies = [e for e in ents if e["type"] == "company"]
    drivers = [e for e in ents if e["type"] in ("theme", "sector", "institution", "policy")]

    m = POS.search(text)
    trigger = (m.group(0).lower() if m else "")
    if trigger in ("supply", "supplies", "supplier", "sources", "pact") and len(companies) >= 2:
        a, b = companies[0]["id"], companies[1]["id"]
        rels.append({"src": b, "dst": a, "type": "supplies_to", "sign": 1, "strength": 0.6,
                     "confidence": 0.6, "rationale": text.strip()})
    elif trigger in ("partner", "partnership", "tie-up", "jv") and len(companies) >= 2:
        rels.append({"src": companies[0]["id"], "dst": companies[1]["id"], "type": "partners_with",
                     "sign": 1, "strength": 0.5, "confidence": 0.55, "rationale": text.strip()})

    if trigger in ("order", "contract", "awarded", "wins", "bags", "subsidy", "incentive",
                   "pli", "scheme", "approval", "expansion", "launch") or NEG.search(text):
        eid = "EVT_" + _slug(text)[:10]
        affected = [c["id"] for c in companies]
        events.append({"id": eid, "type": ("policy" if trigger in ("subsidy", "incentive", "pli", "scheme")
                                            else "negative" if sign < 0 else "order"),
                       "sign": sign, "summary": text.strip(), "affected": affected})
        # drivers (themes/policies/institutions) flow benefit/harm to companies
        for d in drivers:
            for c in companies:
                rels.append({"src": d["id"], "dst": c["id"],
                             "type": "benefits_from" if sign > 0 else "hurt_by",
                             "sign": sign, "strength": 0.55, "confidence": 0.5,
                             "rationale": text.strip()})
    return {"entities": ents, "events": events, "relationships": rels}


def llm_extract(text: str) -> dict:
    """Real path — structured extraction via Claude. Used when ANTHROPIC_API_KEY is set."""
    import httpx
    key = os.environ["ANTHROPIC_API_KEY"]
    model = os.getenv("INGEST_MODEL", "claude-haiku-4-5-20251001")
    schema = ('{"entities":[{"name":str,"type":"company|sector|commodity|macro|policy|theme|'
              'institution|event"}],"events":[{"type":str,"sign":1|-1,"summary":str,'
              '"affected":[entity names]}],"relationships":[{"src":name,"dst":name,'
              '"type":"supplies_to|customer_of|competes_with|owns|benefits_from|hurt_by|'
              'exposed_to|causes","sign":1|-1,"strength":0-1,"confidence":0-1,"rationale":str}]}')
    prompt = (f"Extract the financial knowledge-graph facts from this Indian-market text as "
              f"strict JSON matching {schema}. Use canonical company names. Only include "
              f"relationships the text actually supports.\n\nTEXT:\n{text}\n\nJSON:")
    r = httpx.post("https://api.anthropic.com/v1/messages", timeout=30,
                   headers={"x-api-key": key, "anthropic-version": "2023-06-01",
                            "content-type": "application/json"},
                   json={"model": model, "max_tokens": 1024,
                         "messages": [{"role": "user", "content": prompt}]})
    r.raise_for_status()
    txt = r.json()["content"][0]["text"]
    raw = json.loads(txt[txt.index("{"):txt.rindex("}") + 1])
    # link names -> canonical ids
    def cid(name):
        return GAZ.get(name.lower(), (_slug(name), "company"))[0]
    ents = [{"id": cid(e["name"]), "name": e["name"], "type": e["type"],
             "new": cid(e["name"]) not in engine.NODES} for e in raw.get("entities", [])]
    rels = [{**rl, "src": cid(rl["src"]), "dst": cid(rl["dst"])} for rl in raw.get("relationships", [])]
    events = [{"id": "EVT_" + _slug(ev["summary"])[:10], **ev,
               "affected": [cid(a) for a in ev.get("affected", [])]} for ev in raw.get("events", [])]
    return {"entities": ents, "events": events, "relationships": rels}


def extract(text: str) -> dict:
    if os.getenv("ANTHROPIC_API_KEY"):
        try:
            return llm_extract(text)
        except Exception as e:  # noqa: BLE001 — never let extraction crash ingestion
            print(f"   (llm extract failed, falling back to rules: {e})")
    return rule_extract(text)


def ingest(store: GraphStore, doc: dict) -> dict:
    """Extract from one document and merge into the store with provenance."""
    ex = extract(doc["text"])
    method = "llm" if os.getenv("ANTHROPIC_API_KEY") else "rule"
    pv = lambda c: Provenance(source=doc["source"], method=method, confidence=c, url=doc.get("url"))
    for e in ex["entities"]:
        store.upsert_node(e["id"], e["name"], e["type"],
                          coverage=engine.NODES.get(e["id"], (None, None, 0.4))[2], prov=pv(0.7))
    for ev in ex["events"]:
        store.upsert_node(ev["id"], ev["summary"][:60], "event", coverage=0.3, prov=pv(0.7))
        for a in ev["affected"]:
            store.upsert_edge(ev["id"], a, "benefits_from" if ev["sign"] > 0 else "hurt_by",
                              ev["sign"], 0.5, 0.5, 5, ev["summary"], prov=pv(0.5))
    for rl in ex["relationships"]:
        store.upsert_edge(rl["src"], rl["dst"], rl["type"], rl["sign"], rl["strength"],
                          rl["confidence"], rl.get("lag", 30), rl["rationale"], prov=pv(rl["confidence"]))
    return ex


def load_seed(store: GraphStore):
    """Prime the store with the curated seed graph (so we can show it *grow*)."""
    pv = Provenance(source="seed graph", method="seed", confidence=0.8)
    for nid, (name, ntype, cov) in engine.NODES.items():
        store.upsert_node(nid, name, ntype, coverage=cov, prov=pv)
    for (s, d, sign, st, cf, lag, why) in engine.EDGES:
        store.upsert_edge(s, d, "causes", sign, st, cf, lag, why,
                          prov=Provenance("seed graph", "seed", cf))


SAMPLES = [
    {"source": "NSE announcement", "url": "nseindia.com/...",
     "text": "Tata Motors signs a long-term battery supply pact with Exide Industries "
             "for its EV passenger-vehicle platform."},
    {"source": "Exchange filing", "url": "bseindia.com/...",
     "text": "Bharat Electronics wins a Rs 3,200 crore order from the Ministry of Defence "
             "for radar systems."},
    {"source": "Press Information Bureau", "url": "pib.gov.in/...",
     "text": "Government announces a PLI incentive scheme for domestic solar manufacturing; "
             "Adani Green and Waaree are expected to be major beneficiaries."},
    {"source": "Moneycontrol", "url": "moneycontrol.com/...",
     "text": "SEBI imposes a penalty on the company over disclosure lapses; the stock may face "
             "pressure."},
]


def main():
    store = get_store()
    load_seed(store)
    base = store.stats()
    print(f"baseline graph: {base['nodes']} nodes, {base['edges']} edges  [{base['backend']}]\n")
    print(f"ingesting {len(SAMPLES)} documents (method: "
          f"{'llm/claude' if os.getenv('ANTHROPIC_API_KEY') else 'rule-based'})\n")
    new_nodes = []
    for d in SAMPLES:
        ex = ingest(store, d)
        ents = ", ".join(f"{e['name']}{'*' if e['new'] else ''}" for e in ex["entities"]) or "—"
        print(f"  • [{d['source']}] {d['text'][:62]}…")
        print(f"      entities: {ents}")
        for rl in ex["relationships"]:
            print(f"      rel: {engine.nm(rl['src']) if rl['src'] in engine.NODES else rl['src']} "
                  f"--{rl['type']}({'+' if rl['sign']>0 else '-'})--> "
                  f"{engine.nm(rl['dst']) if rl['dst'] in engine.NODES else rl['dst']}")
        for ev in ex["events"]:
            print(f"      event: {ev['type']} ({'+' if ev['sign']>0 else '-'}) → "
                  f"{', '.join(ev['affected']) or '—'}")
        new_nodes += [e["name"] for e in ex["entities"] if e["new"]]
        print()
    fin = store.stats()
    print(f"graph grew: {base['nodes']} → {fin['nodes']} nodes, "
          f"{base['edges']} → {fin['edges']} edges")
    print(f"new entities discovered from text: {', '.join(sorted(set(new_nodes))) or 'none'}")
    if isinstance(store, type(get_store())) and base["backend"] == "memory":
        ag = store.nodes.get("ADANIGREEN")
        if ag and ag["prov"]:
            print(f"\nprovenance example — {ag['name']}: {ag['prov'][0]}")


if __name__ == "__main__":
    main()

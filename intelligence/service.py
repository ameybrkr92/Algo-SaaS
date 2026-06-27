#!/usr/bin/env python3
"""Reasoning API — exposes the canonical engine over HTTP (Phase 2).

The future Vite cockpit (and the prototype) call this instead of duplicating the
graph in JS, so there is exactly one brain. CORS is open for local development.

Run (uses the project venv):
    uv run python intelligence/service.py
    # http://127.0.0.1:6061/reasoning/scenarios

Endpoints:
    GET /reasoning/scenarios            list scenarios
    GET /reasoning/propagate?scenario=  full 8-question analysis (JSON)
    GET /reasoning/graph                nodes + edges (for graph viz)
    GET /healthz
"""
from __future__ import annotations

from flask import Flask, jsonify, request
from flask_cors import CORS

import memory
from engine import SCENARIOS, analyze, graph_json

app = Flask(__name__)
CORS(app)  # prototype is served from a different origin (http.server)

memory.init()
memory.seed_analogs()


@app.get("/reasoning/scenarios")
def scenarios():
    return jsonify([{"id": k, "label": lbl, "seeds": seeds}
                    for k, (lbl, seeds) in SCENARIOS.items()])


@app.get("/reasoning/propagate")
def propagate_route():
    sid = request.args.get("scenario", "crude")
    if sid not in SCENARIOS:
        return jsonify({"error": f"unknown scenario '{sid}'",
                        "scenarios": list(SCENARIOS)}), 400
    return jsonify(analyze(sid))


@app.get("/reasoning/graph")
def graph_route():
    return jsonify(graph_json())


@app.get("/memory/calibration")
def calibration_route():
    return jsonify(memory.calibration())


@app.get("/hypothesis")
def hypothesis_route():
    return jsonify(memory.hypothesis(request.args.get("event", "rbi_cut")))


@app.get("/healthz")
def healthz():
    return jsonify({"status": "ok", "scenarios": len(SCENARIOS)})


if __name__ == "__main__":
    print("Reasoning API on http://127.0.0.1:6061  (try /reasoning/scenarios)")
    app.run(host="127.0.0.1", port=6061, debug=False)

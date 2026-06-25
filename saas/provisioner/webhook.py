#!/usr/bin/env python3
"""Razorpay webhook -> provisioner glue (Phase 2 prototype).

Maps subscription lifecycle events to tenant provisioning:
  subscription.activated / .charged   -> create or resume the tenant
  subscription.halted / .cancelled    -> suspend the tenant

The tenant id + broker are read from the subscription's `notes` (set them when you
create the subscription in Razorpay). Signature is verified with your webhook secret.

PROTOTYPE — shells out to provision.py. For production, call a provisioner library
directly, enqueue the work (so the webhook returns fast), and persist billing state
in Postgres. See ../../SAAS_ROADMAP.md.

Run:
    pip install flask
    export RAZORPAY_WEBHOOK_SECRET=...        # from the Razorpay dashboard
    python webhook.py                          # listens on :8088
Point a Razorpay webhook at https://billing.tradeyantra.in/razorpay/webhook.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import subprocess
import sys
from pathlib import Path

from flask import Flask, request

HERE = Path(__file__).resolve().parent
PROVISION = HERE / "provision.py"
SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")

app = Flask(__name__)


def verify(raw: bytes, signature: str) -> bool:
    if not SECRET:
        app.logger.warning("RAZORPAY_WEBHOOK_SECRET not set — rejecting.")
        return False
    expected = hmac.new(SECRET.encode(), raw, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature or "")


def provisioner(*args: str) -> None:
    """Invoke the provisioner CLI; never raise into the webhook response."""
    try:
        subprocess.run([sys.executable, str(PROVISION), *args], check=True)
    except subprocess.CalledProcessError as e:
        app.logger.error("provisioner failed: %s", e)


@app.post("/razorpay/webhook")
def razorpay_webhook():
    raw = request.get_data()
    if not verify(raw, request.headers.get("X-Razorpay-Signature", "")):
        return {"status": "invalid signature"}, 400

    event = request.json or {}
    etype = event.get("event", "")
    sub = (event.get("payload", {}).get("subscription", {}).get("entity", {}))
    notes = sub.get("notes", {}) or {}
    tenant = notes.get("tenant_id")
    broker = notes.get("broker", "zerodha")

    if not tenant:
        return {"status": "ignored", "reason": "no tenant_id in subscription notes"}, 200

    if etype in ("subscription.activated", "subscription.charged"):
        # First charge provisions; subsequent charges resume if suspended.
        provisioner("create", tenant, "--broker", broker)
        provisioner("resume", tenant)
    elif etype in ("subscription.halted", "subscription.cancelled", "subscription.paused"):
        provisioner("suspend", tenant)

    return {"status": "ok", "event": etype, "tenant": tenant}, 200


@app.get("/healthz")
def healthz():
    return {"status": "ok"}, 200


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8088)

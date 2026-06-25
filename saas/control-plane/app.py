#!/usr/bin/env python3
"""TradeYantra control plane (Phase 2 MVP).

The customer-facing SaaS front door: landing/pricing -> signup -> checkout ->
provision -> dashboard. A separate Flask app from the per-tenant TradeYantra
instances. It owns the tenant directory and drives the provisioner.

Run (uses the project's venv, so no new deps):
    uv run python saas/control-plane/app.py
    open http://127.0.0.1:6060

Env:
    CONTROL_PLANE_SECRET          Flask session secret (default: random per run).
    CONTROL_PLANE_PROVISION_MODE  'demo' (default, --dry-run) or 'live' (real Docker).
    CONTROL_PLANE_ADMIN_EMAIL     Email that is auto-flagged admin on signup.

This is a PROTOTYPE: SQLite directory, demo checkout (no real charge unless you
wire Razorpay), provisioning shells out to the prototype provisioner. See
../../SAAS_ROADMAP.md for the production gaps.
"""
from __future__ import annotations

import os
import re
import secrets
import subprocess
import sys
from functools import wraps
from pathlib import Path

from flask import (Flask, abort, flash, redirect, render_template,
                   request, session, url_for)
from werkzeug.security import check_password_hash, generate_password_hash

import db
from plans import PLANS, get_plan

HERE = Path(__file__).resolve().parent
PROVISION = HERE.parent / "provisioner" / "provision.py"
PROVISION_MODE = os.getenv("CONTROL_PLANE_PROVISION_MODE", "demo")
ADMIN_EMAIL = os.getenv("CONTROL_PLANE_ADMIN_EMAIL", "").lower().strip()
SUBDOMAIN_RE = re.compile(r"^[a-z][a-z0-9-]{1,30}[a-z0-9]$")

app = Flask(__name__)
app.secret_key = os.getenv("CONTROL_PLANE_SECRET", secrets.token_hex(16))


# ---------- auth helpers ----------
def current_account():
    aid = session.get("account_id")
    return db.get_account(aid) if aid else None


def login_required(view):
    @wraps(view)
    def wrapped(*a, **k):
        if not current_account():
            return redirect(url_for("login", next=request.path))
        return view(*a, **k)
    return wrapped


def admin_required(view):
    @wraps(view)
    def wrapped(*a, **k):
        acct = current_account()
        if not acct or not acct["is_admin"]:
            abort(403)
        return view(*a, **k)
    return wrapped


@app.context_processor
def inject_globals():
    return {"account": current_account(), "brand": "TradeYantra"}


# ---------- provisioning ----------
def provision_tenant(subdomain: str, broker: str) -> tuple[str, str]:
    """Drive the provisioner. Returns (status, instance_url)."""
    args = [sys.executable, str(PROVISION), "create", subdomain,
            "--broker", broker, "--domain", f"{subdomain}.tradeyantra.in"]
    if PROVISION_MODE != "live":
        args.append("--dry-run")
    url = f"https://{subdomain}.tradeyantra.in"
    try:
        subprocess.run(args, check=True, capture_output=True, text=True, timeout=120)
        # In demo mode nothing is actually running; reflect that honestly.
        return ("provisioned (demo)" if PROVISION_MODE != "live" else "running"), url
    except Exception as e:  # noqa: BLE001 - prototype: surface, don't crash signup
        app.logger.error("provision failed: %s", e)
        return "error", url


# ---------- routes ----------
@app.route("/")
def landing():
    return render_template("landing.html", plans=PLANS)


@app.route("/signup", methods=["GET", "POST"])
def signup():
    if current_account():
        return redirect(url_for("dashboard"))
    if request.method == "POST":
        email = (request.form.get("email") or "").lower().strip()
        password = request.form.get("password") or ""
        if not email or "@" not in email:
            flash("Enter a valid email.", "error")
        elif len(password) < 8:
            flash("Password must be at least 8 characters.", "error")
        elif db.get_account_by_email(email):
            flash("An account with that email already exists.", "error")
        else:
            aid = db.create_account(email, generate_password_hash(password),
                                    is_admin=(email == ADMIN_EMAIL))
            session["account_id"] = aid
            return redirect(request.args.get("next") or url_for("dashboard"))
    return render_template("auth.html", mode="signup")


@app.route("/login", methods=["GET", "POST"])
def login():
    if current_account():
        return redirect(url_for("dashboard"))
    if request.method == "POST":
        email = (request.form.get("email") or "").lower().strip()
        acct = db.get_account_by_email(email)
        if acct and check_password_hash(acct["password_hash"], request.form.get("password") or ""):
            session["account_id"] = acct["id"]
            return redirect(request.args.get("next") or url_for("dashboard"))
        flash("Invalid email or password.", "error")
    return render_template("auth.html", mode="login")


@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return redirect(url_for("landing"))


@app.route("/checkout/<plan_id>", methods=["GET", "POST"])
@login_required
def checkout(plan_id):
    plan = get_plan(plan_id)
    if not plan:
        abort(404)
    acct = current_account()
    if db.get_tenant_for_account(acct["id"]):
        flash("You already have an instance. Manage it from your dashboard.", "error")
        return redirect(url_for("dashboard"))

    if request.method == "POST":
        subdomain = (request.form.get("subdomain") or "").lower().strip()
        broker = (request.form.get("broker") or "zerodha").lower().strip()
        if not SUBDOMAIN_RE.match(subdomain):
            flash("Subdomain must be 3-32 chars: lowercase letters, digits, hyphens.", "error")
        elif db.subdomain_taken(subdomain):
            flash("That subdomain is taken — try another.", "error")
        else:
            # In production: create a Razorpay order here and only provision on the
            # verified payment webhook. This demo provisions on submit.
            tid = db.create_tenant(acct["id"], subdomain, plan_id, broker)
            status, url = provision_tenant(subdomain, broker)
            db.set_tenant_status(tid, status, url)
            flash(f"Payment received (demo) — provisioning {subdomain}.tradeyantra.in", "ok")
            return redirect(url_for("dashboard"))

    return render_template("checkout.html", plan=plan)


@app.route("/dashboard")
@login_required
def dashboard():
    acct = current_account()
    tenant = db.get_tenant_for_account(acct["id"])
    return render_template("dashboard.html", tenant=tenant, plans=PLANS,
                           plan=get_plan(tenant["plan"]) if tenant else None)


@app.route("/admin")
@admin_required
def admin():
    return render_template("admin.html", tenants=db.all_tenants())


if __name__ == "__main__":
    db.init_db()
    print(f"Control plane on http://127.0.0.1:6060  (provision mode: {PROVISION_MODE})")
    app.run(host="127.0.0.1", port=6060, debug=False)

# TradeYantra Control Plane (Phase 2 MVP)

The customer-facing SaaS front door: **landing/pricing → signup → checkout →
provision → dashboard**. A separate Flask app from the per-tenant TradeYantra
instances; it owns the tenant directory and drives the
[provisioner](../provisioner/).

> **Status: MVP/prototype.** Reuses the project's venv (no new deps — Flask, Jinja,
> Werkzeug are already installed). Tailwind via CDN. Demo checkout (no real charge
> until you wire Razorpay). See [`../../SAAS_ROADMAP.md`](../../SAAS_ROADMAP.md).

## Run

```bash
# from the repo root (uses the project's uv venv):
uv run python saas/control-plane/app.py
# open http://127.0.0.1:6060
```

First signup with the email in `CONTROL_PLANE_ADMIN_EMAIL` becomes an **admin**
(gets the `/admin` tenant list).

## The flow it implements

| Step | Route | What happens |
| --- | --- | --- |
| Browse | `GET /` | Hero + 3 pricing tiers (`plans.py`). |
| Sign up / log in | `/signup`, `/login` | SaaS account (Werkzeug-hashed password, session cookie). |
| Choose plan | `/checkout/<plan>` | Pick subdomain + broker. |
| Pay (demo) | `POST /checkout/<plan>` | Creates a tenant row → calls the provisioner → marks it provisioned. |
| Manage | `/dashboard` | Instance URL, status, plan, and next-step guidance. |
| Operate | `/admin` | All tenants across all accounts (admin only). |

## Configuration (env)

| Variable | Default | Purpose |
| --- | --- | --- |
| `CONTROL_PLANE_SECRET` | random per run | Flask session signing key (set it to persist sessions). |
| `CONTROL_PLANE_PROVISION_MODE` | `demo` | `demo` runs the provisioner in `--dry-run`; `live` actually provisions (needs Docker + the `tradeyantra` image + Caddy). |
| `CONTROL_PLANE_ADMIN_EMAIL` | — | This email becomes admin on signup. |

## Files
| File | Purpose |
| --- | --- |
| `app.py` | Flask routes, auth, checkout, provisioning glue. |
| `db.py` | SQLite data layer: `accounts` + `tenants` directory. |
| `plans.py` | Plan definitions (placeholder pricing — edit here). |
| `templates/` | Jinja templates (Tailwind CDN, TradeYantra blue). |
| `control_plane.db` | Local SQLite (gitignored). |

## Going to production (gaps)
- **Real payments:** create a Razorpay order at checkout and provision only on the
  **verified webhook** (the [provisioner's `webhook.py`](../provisioner/webhook.py)
  already does the provision/suspend side). Never provision on form-submit in prod.
- **Postgres** instead of SQLite; run provisioning **async** (queue) so requests return fast.
- **Email** (verify address, send instance URL + setup link).
- **Per-tenant static egress IP** (SEBI) — see the roadmap; the hardest infra piece.
- **Hardening:** CSRF tokens on forms, rate limiting, 2FA, audit log, password reset.

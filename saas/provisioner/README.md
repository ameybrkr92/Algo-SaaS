# TradeYantra Provisioner (Phase 2 prototype)

Automates the [concierge runbook](../CONCIERGE_RUNBOOK.md): one command spins up an
isolated TradeYantra instance per tenant. Pair it with `webhook.py` to make
**pay → provision** fully automatic.

> **Status: prototype/scaffold.** Stdlib-only CLI, JSON registry, Docker backend.
> Production hardening (Postgres registry, per-tenant static IP, secrets manager,
> queue, monitoring) is tracked in [`../../SAAS_ROADMAP.md`](../../SAAS_ROADMAP.md).

## What it does

For each tenant it allocates unique ports (`flask 5000+i`, `ws 8765+i`, `zmq 5555+i`),
renders a per-tenant `.env` from the repo's `.sample.env` (own DBs, own crypto keys,
domain, broker redirect), writes a `docker-compose.yml`, brings the container up,
health-checks it, and records everything in `tenants.json`.

## Files
| File | Purpose |
| --- | --- |
| `provision.py` | CLI: `create` / `suspend` / `resume` / `destroy` / `list` / `show`. |
| `webhook.py` | Razorpay webhook → calls the CLI (activate→create/resume, halt→suspend). |
| `tenants.json` | Local registry (gitignored — holds tenant state). |
| `tenants/<id>/` | Generated `.env` + `docker-compose.yml` per tenant (gitignored — secrets). |

## Quick start

```bash
# 0. Build the TradeYantra image once (from repo root):
docker build -t tradeyantra:latest .

# 1. Dry-run — see exactly what would happen, no Docker needed:
python provision.py create acme --broker zerodha --domain acme.tradeyantra.in --dry-run

# 2. Real provision (needs Docker + the image):
python provision.py create acme --broker zerodha \
    --domain acme.tradeyantra.in --api-key KITE_KEY --api-secret KITE_SECRET

python provision.py list
python provision.py suspend acme       # stop (data retained)
python provision.py resume  acme
python provision.py destroy acme       # down -v (snapshot db/ first in prod!)
```

After `create`, point the customer's broker **redirect URL** at
`https://<domain>/<broker>/callback` and route the subdomain to the published
localhost port with your reverse proxy (Caddy/Traefik) — see below.

## Routing (shared reverse proxy)

Each tenant publishes only on `127.0.0.1:<flask_port>`. A single Caddy instance maps
subdomains to ports and auto-issues TLS. Example `Caddyfile`:

```
acme.tradeyantra.in   { reverse_proxy 127.0.0.1:5000 }
globex.tradeyantra.in { reverse_proxy 127.0.0.1:5001 }
```

(The provisioner can template these entries in a later iteration; for now add one
line per tenant — or use Traefik labels on the compose service.)

## Billing → provisioning

```bash
pip install flask
export RAZORPAY_WEBHOOK_SECRET=...      # from the Razorpay dashboard
python webhook.py                        # listens on 127.0.0.1:8088
```

Create the Razorpay subscription with `notes.tenant_id` (and optional `notes.broker`)
set. Then `subscription.activated`/`.charged` provisions/resumes the tenant, and
`.halted`/`.cancelled` suspends it.

## Known gaps before production (do not ship without these)
- **Per-tenant static egress IP** (SEBI) — the hardest piece; not handled here.
- **Registry → Postgres**, and run provisioning **async** (queue) so webhooks return fast.
- **Secrets** — render `.env` from a vault, not inline args; rotate on demand.
- **Backups** of each tenant's `db/` volume, with tested restores.
- **Upgrades** — roll a new image across tenants (canary first).
- **Idempotency + retries** on webhook events; reconcile against Razorpay state.

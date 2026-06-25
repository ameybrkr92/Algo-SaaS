# TradeYantra — Concierge Onboarding Runbook (Phase 1)

> **Goal of Phase 1:** prove customers will pay and learn the real onboarding +
> support load — by onboarding the first 3–10 customers **manually**, one at a time,
> using the existing multi-instance tooling. No automation yet (that's Phase 2 —
> see [`saas/provisioner/`](./provisioner/) and [`SAAS_ROADMAP.md`](../SAAS_ROADMAP.md)).
>
> Each customer gets their **own isolated TradeYantra instance** (own DBs, broker
> session, subdomain, ports). This is the "managed per-tenant instance" model.

---

## 0. One-time host setup

- [ ] A Linux server (Ubuntu 22.04/24.04). For Indian brokers, prefer an **India region**
      VPS for low latency.
- [ ] **Wildcard DNS:** `*.tradeyantra.in` → server IP (so each tenant gets a subdomain).
- [ ] Open ports 80/443 (nginx + certbot handle TLS). Internal ports (5000+/8765+/5555+)
      stay on localhost.
- [ ] Clone the repo to the server and keep it updated:
      `git clone https://github.com/ameybrkr92/Algo-SaaS.git`
- [ ] **Static egress IP:** confirm the server's outbound IP is the one the customer will
      whitelist with their broker (SEBI). For Phase 1 with one server, all tenants share
      this IP — fine for a handful of customers; per-tenant egress IP is a Phase 3 task.
- [ ] Create a **tenant log** (a spreadsheet or `saas/provisioner/tenants.json`) to track
      every customer: subdomain, instance number, broker, ports, plan, status, dates.

## 1. Per-customer onboarding checklist

Run this for **each** new paying customer.

### A. Intake (before provisioning)
- [ ] Customer name / email / plan.
- [ ] Broker they'll use (e.g., `zerodha`, `angel`, `dhan`).
- [ ] Their **broker API key + secret** (for Zerodha: a Kite Connect app from
      <https://developers.kite.trade/apps>). *They* create the app; you only need the
      key/secret to seed `.env` — or hand them the instance and let them enter it in
      the UI later.
- [ ] Chosen subdomain, e.g. `acme.tradeyantra.in`.

### B. Take payment first
- [ ] Create a **Razorpay** Payment Link (or subscription) for the plan; send it.
- [ ] Confirm payment captured **before** provisioning. (Phase 2 automates this via webhook.)

### C. Provision the instance
Use the existing multi-instance installer (run it for **1** instance per customer):

```bash
cd /path/to/Algo-SaaS
sudo bash install/install-multi.sh
#  → "How many instances?"  : 1
#  → subdomain              : acme.tradeyantra.in
#  → broker                 : zerodha
#  → broker API key/secret  : <customer's Kite Connect key/secret>
#  → Enable Remote MCP?     : N (unless they need it)
```

What the installer does for that instance (verify after):
- [ ] Creates `/var/python/openalgo-flask/openalgo<N>/` (its own clone + venv).
- [ ] Unique DBs (`db/openalgo<N>.db`, `latency<N>.db`, …) and cookie names
      (`session<N>`, `csrf_token<N>`) — **full isolation** from other tenants.
- [ ] Unique ports: Flask `5000+N-1`, WebSocket `8765+N-1`, ZMQ `5555+N-1`.
- [ ] Auto-generates a unique `APP_KEY` / `API_KEY_PEPPER` / `FERNET_SALT`.
- [ ] Sets `HOST_SERVER`/`CORS`/`REDIRECT_URL`/`WEBSOCKET_URL` to `https://acme.tradeyantra.in`.
- [ ] Writes an nginx site for the subdomain (→ Unix socket, `/ws` → WS port, `/socket.io`).
- [ ] Obtains TLS via **certbot** for the subdomain.
- [ ] Creates + enables a **systemd** service `openalgo<N>` (gunicorn, eventlet, `-w 1`).

### D. Broker redirect URL (critical)
- [ ] In the customer's broker developer console, set the **Redirect/Postback URL** to
      `https://acme.tradeyantra.in/<broker>/callback`
      (e.g. `…/zerodha/callback`). It must match `REDIRECT_URL` in their `.env`.

### E. Verify
- [ ] `sudo systemctl status openalgo<N>` → active (running).
- [ ] Visit `https://acme.tradeyantra.in` → TradeYantra setup page loads over HTTPS.
- [ ] Create the customer's **admin account** (or have them do it on first visit).
- [ ] Connect broker → confirm the login URL shows the **real** api_key (not the
      `YOUR_BROKER_API_KEY` placeholder) and the OAuth round-trip completes.
- [ ] Place a **sandbox** (analyzer-mode) test order to confirm the full stack works.

### F. Hand-off
- [ ] Send the customer their URL, admin credentials reset link, and a short "getting
      started" note (connect broker, enable 2FA in Profile, sandbox first).
- [ ] Record the tenant in your tenant log (subdomain, instance N, ports, plan, start date).

## 2. Ongoing operations

**Suspend (non-payment):**
```bash
sudo systemctl stop openalgo<N>      # data retained; site returns 502/maintenance
```
**Resume:**
```bash
sudo systemctl start openalgo<N>
```
**Upgrade an instance** (after you push changes to the repo):
```bash
cd /var/python/openalgo-flask/openalgo<N> && sudo git pull
sudo systemctl restart openalgo<N>   # dist is committed, so no build needed
```
**Offboard / deprovision** (after grace period):
- [ ] Snapshot the instance dir (esp. `db/`) for retention/export.
- [ ] `sudo systemctl disable --now openalgo<N>`
- [ ] Remove the nginx site + reload nginx; revoke the cert if desired.
- [ ] Archive/delete `/var/python/openalgo-flask/openalgo<N>/` per your data-retention policy.

## 3. Compliance reminders (per customer)
- [ ] **AGPL:** the customer is a user of the service — the source is public at
      <https://github.com/ameybrkr92/Algo-SaaS> and linked in the app footer. Keep it current.
- [ ] **SEBI:** the customer uses **their own** broker credentials from the server's
      whitelisted IP. You are the infrastructure provider, not an algo provider. Have the
      customer confirm their broker permits API/algo trading from this IP.
- [ ] **Data:** the instance holds their broker tokens (encrypted at rest) and trade data —
      treat the server as production: backups, restricted SSH, no shared logins.

## 4. When to graduate to Phase 2
Move to the automated [`provisioner`](./provisioner/) once onboarding feels repetitive
(~5+ customers) — it turns this entire section into `provision.py create <tenant>` driven
by a Razorpay webhook.

# TradeYantra — SaaS Roadmap (Managed Per-Tenant Instances)

> Status: planning. This document describes how to turn the white-labeled
> TradeYantra platform into a multi-customer SaaS **without** rewriting the
> single-tenant core — by giving every customer their own isolated instance and
> wrapping a thin **control plane** around them.

---

## 1. Why this model

TradeYantra (OpenAlgo) is deliberately **single-tenant**: one user, one broker
session, one set of databases per instance. Three forces make "one shared
multi-tenant instance" the wrong first move:

1. **Security** — a single isolation bug = cross-customer access to live broker
   funds. Per-tenant instances make a breach blast-radius of exactly one customer.
2. **AGPL-3.0** — commercial use is fine, but a modified network service must offer
   its source to users. Per-tenant instances don't change this; we satisfy it with a
   public source repo + the "Built on OpenAlgo" footer link (already in the app).
3. **SEBI** — retail algo trading runs through broker-empanelled providers, and a
   **static-IP whitelisting mandate** means each customer's orders must originate
   from an IP their broker has whitelisted. Per-tenant instances map naturally:
   each tenant uses **their own** broker credentials from **their own** egress IP.

**Decision: Managed per-tenant instances + a control plane.** Each customer gets an
isolated TradeYantra instance (their own container, DBs, broker session, subdomain,
and egress IP). We automate provisioning, billing, and monitoring around them.

```
                 ┌─────────────────── CONTROL PLANE (new) ───────────────────┐
   customer  ─▶  │  Marketing site → Signup → Billing(Razorpay) → Provisioner │
                 │  Tenant directory DB · Monitoring · Admin console          │
                 └───────────────────────────┬───────────────────────────────┘
                                              │ provisions / suspends
                 ┌────────────────────────────▼──────────────────────────────┐
                 │  DATA PLANE — one isolated TradeYantra per tenant          │
                 │  acme.tradeyantra.in → container(acme): own DBs, broker    │
                 │  beta.tradeyantra.in → container(beta): own DBs, broker    │
                 │  …each with its own egress/static IP for SEBI              │
                 └────────────────────────────────────────────────────────────┘
```

## 2. The two planes

### Control plane (what we build new)
| Component | Responsibility |
| --- | --- |
| **Marketing + signup** | Public site, plan selection, account creation. |
| **Identity** | SaaS-level accounts (separate from each instance's admin login). |
| **Billing** | Razorpay subscriptions, invoices, webhooks → entitlement state. |
| **Provisioner** | Creates/starts/suspends/destroys tenant instances; assigns subdomain + egress IP; injects per-tenant secrets. |
| **Tenant directory** | Postgres: tenant → subdomain, container id, plan, status, IP, created_at. |
| **Router** | Wildcard `*.tradeyantra.in` reverse proxy → the right tenant container. |
| **Monitoring/ops** | Health, resource usage, logs, alerts per tenant; backups. |
| **Admin console** | Internal: see all tenants, suspend, impersonate-for-support, audit. |

### Data plane (what already exists — reuse it)
Each tenant is **today's TradeYantra**, unchanged, isolated. The repo already ships
the building blocks:

- `install/install-multi.sh` — runs **multiple isolated instances on one host**, each
  with its own ports and `ZMQ_PORT` (`5555 + i-1`). This is the seed of the provisioner.
- `install/install-docker-multi-custom-ssl.sh` + `Caddyfile` — multi-instance Docker
  with per-domain SSL via a reverse proxy. The seed of the router.
- `install/change-domain.sh` — rebinds an instance to a domain. Useful per-tenant.
- First-run secret auto-generation (`APP_KEY`, `API_KEY_PEPPER`, `FERNET_SALT`) — every
  tenant gets unique crypto material with zero manual steps.

> Net: the **data plane is ~80% built**. The work is the **control plane + automation**.

## 3. Tenant lifecycle

```
signup ─▶ pay (Razorpay) ─▶ PROVISION ─▶ RUNNING ──(payment fails)──▶ SUSPENDED
                                 │                                        │
                                 │            (grace period elapses)      ▼
                                 └────────────────────────────────▶ DEPROVISIONED (data exported/retained per policy)
```

- **Provision:** allocate subdomain + egress IP, render `.env`, start container, run
  health check, email the customer their URL + first-run admin setup link.
- **Suspend:** stop the container (data retained), show a billing notice page.
- **Deprovision:** after grace period, snapshot + remove; honor data-retention policy.

## 4. Recommended tech stack

| Concern | Phase-2 (MVP) | Phase-3 (scale) |
| --- | --- | --- |
| Tenant runtime | Docker container per tenant on a VM | Kubernetes (pod/namespace per tenant) |
| Orchestration | `docker compose` driven by the provisioner | K8s operator + Helm chart |
| Routing/TLS | Caddy/Traefik wildcard + auto-HTTPS | Ingress controller + cert-manager |
| Control-plane app | One service (FastAPI **or** Next.js + API routes) | Same, horizontally scaled |
| Control-plane DB | Postgres (tenant directory, billing state) | Postgres (managed/HA) |
| Billing | Razorpay subscriptions + webhooks | + dunning, proration, GST invoices |
| Per-tenant egress IP | NAT/proxy with a pool of elastic IPs | Per-tenant egress gateway, IP automation |
| Secrets | Per-tenant `.env` from a vault | HashiCorp Vault / cloud secrets manager |
| Monitoring | Uptime checks + container metrics + log shipping | Prometheus + Grafana + per-tenant dashboards |
| Backups | Nightly volume snapshots | Continuous + point-in-time restore |

The **static egress IP per tenant** is the single hardest infra requirement (SEBI).
Validate the approach with your target brokers **before** Phase 2.

## 5. Phased roadmap

### Phase 0 — White-label ✅ (done)
Brand, theme, landing page, icons, console banner, README. AGPL attribution in place.

### Phase 1 — Concierge MVP (validate demand)
- Manually provision instances for the first 3–10 customers using `install-multi.sh`.
- Manual Razorpay payment link per customer; manual subdomain + IP setup.
- **Goal:** prove people pay, learn the real onboarding/support load. No automation yet.
- **Exit criteria:** repeatable manual runbook; first paying customers live.

### Phase 2 — Control-plane MVP (self-serve)
- Build: marketing site + signup, Razorpay subscriptions + webhooks, **Provisioner**
  service (programmatic `docker compose` up/down), wildcard router, tenant directory DB.
- Automate: pay → provision → email URL; payment-fail → suspend.
- Internal admin console (list/suspend/support).
- **Exit criteria:** a customer can sign up, pay, and be trading on their own subdomain
  with **zero** manual steps.

### Phase 3 — Ops hardening & scale
- Per-tenant **static egress IP** automation (the SEBI requirement) — productionize.
- Monitoring/alerting per tenant, nightly backups + tested restores, log retention.
- Migrate runtime to Kubernetes if instance count warrants it.
- Upgrade pipeline: roll a new TradeYantra image across tenants safely (canary first).
- **Exit criteria:** on-call-able; backups restore-tested; upgrades are one command.

### Phase 4 — Growth
- Tiered plans (broker count, data history, support SLA), annual billing, GST invoices.
- Self-serve broker connect wizard, in-app upgrade/downgrade, referrals/affiliates.
- Status page, knowledge base, support desk.

## 6. Compliance checklist (do not skip)

- [ ] **AGPL source offer** — host your modified TradeYantra source publicly; link it
      from the footer (the "Built on OpenAlgo" link already exists — point it at *your*
      fork once published). Every tenant is a "user" entitled to the source.
- [ ] **SEBI posture** — confirm with a securities lawyer that the **infra-provider**
      framing holds (customer = the trader, using their own broker creds + IP; you don't
      place orders or sell strategies). Document it.
- [ ] **Static-IP whitelisting** — verify the per-tenant egress-IP approach with each
      supported broker before onboarding on that broker.
- [ ] **Data & privacy** — DPDP Act (India): consent, retention, deletion on
      deprovision; encrypt tenant volumes at rest.
- [ ] **Terms/SLA/refunds** — publish ToS, privacy policy, refund policy; Razorpay KYC.

## 7. Open decisions (need your input later)
1. **Hosting** — single cloud (AWS/GCP/Azure) vs Indian VPS (latency to brokers) — and
   how to source a **pool of static IPs**.
2. **Container vs VM per tenant** — containers are cheaper/denser; some brokers/IP
   setups may push toward a VM per tenant. Driven by the IP requirement.
3. **Pricing** — flat per-instance vs tiered; trial length; annual discount.
4. **Control-plane stack** — FastAPI (matches the Python codebase) vs Next.js (faster
   marketing + app). Recommend **Next.js marketing + FastAPI provisioner API**.
5. **Support model** — impersonation/break-glass policy and its audit trail.

---

### TL;DR
The data plane is mostly built (`install-multi.sh` + Caddy + auto-secrets). The real
work is a **control plane** (signup → Razorpay → automated provisioner → wildcard
router → monitoring) and the **per-tenant static-IP** automation that SEBI requires.
Start with a **concierge MVP** to validate demand before automating.

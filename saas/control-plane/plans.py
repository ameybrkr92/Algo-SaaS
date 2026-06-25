"""Subscription plans (placeholder pricing — edit freely).

Kept in one place so the landing page, checkout, and billing all agree.
Amounts are in paise (Razorpay's unit): ₹999 = 99900.
"""
from __future__ import annotations

PLANS: dict[str, dict] = {
    "starter": {
        "id": "starter",
        "name": "Starter",
        "price_inr": 999,
        "price_paise": 99900,
        "tagline": "For individual traders getting started.",
        "features": [
            "1 connected broker",
            "Sandbox + live trading",
            "Python & Flow strategies",
            "Options analytics suite",
            "Community support",
        ],
    },
    "pro": {
        "id": "pro",
        "name": "Pro",
        "price_inr": 2499,
        "price_paise": 249900,
        "tagline": "For active traders who want it all.",
        "highlight": True,
        "features": [
            "All 30+ brokers",
            "Everything in Starter",
            "Telegram alerts & bot",
            "AI / MCP trading",
            "Priority email support",
        ],
    },
    "elite": {
        "id": "elite",
        "name": "Elite",
        "price_inr": 4999,
        "price_paise": 499900,
        "tagline": "For pros who need dedicated resources.",
        "features": [
            "Everything in Pro",
            "Dedicated instance resources",
            "Custom domain support",
            "Onboarding assistance",
            "SLA-backed support",
        ],
    },
}


def get_plan(plan_id: str) -> dict | None:
    return PLANS.get(plan_id)

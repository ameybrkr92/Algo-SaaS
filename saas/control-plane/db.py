"""SQLite data layer for the control plane (prototype).

Two tables:
  accounts  — SaaS-level customer logins (separate from each instance's admin).
  tenants   — the tenant directory: which account owns which provisioned instance.

Production note: move this to Postgres and add migrations. SQLite is fine for the
MVP and keeps the prototype dependency-free.
"""
from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "control_plane.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS accounts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin      INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tenants (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id   INTEGER NOT NULL REFERENCES accounts(id),
    subdomain    TEXT UNIQUE NOT NULL,
    plan         TEXT NOT NULL,
    broker       TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'pending',
    instance_url TEXT,
    created_at   TEXT NOT NULL
);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with connect() as conn:
        conn.executescript(SCHEMA)


# ---------- accounts ----------
def create_account(email: str, password_hash: str, is_admin: bool = False) -> int:
    with connect() as conn:
        cur = conn.execute(
            "INSERT INTO accounts (email, password_hash, is_admin, created_at) "
            "VALUES (?, ?, ?, ?)",
            (email.lower().strip(), password_hash, int(is_admin), _now()),
        )
        return cur.lastrowid


def get_account_by_email(email: str) -> sqlite3.Row | None:
    with connect() as conn:
        return conn.execute(
            "SELECT * FROM accounts WHERE email = ?", (email.lower().strip(),)
        ).fetchone()


def get_account(account_id: int) -> sqlite3.Row | None:
    with connect() as conn:
        return conn.execute("SELECT * FROM accounts WHERE id = ?", (account_id,)).fetchone()


# ---------- tenants ----------
def create_tenant(account_id: int, subdomain: str, plan: str, broker: str) -> int:
    with connect() as conn:
        cur = conn.execute(
            "INSERT INTO tenants (account_id, subdomain, plan, broker, status, created_at) "
            "VALUES (?, ?, ?, ?, 'pending', ?)",
            (account_id, subdomain.lower().strip(), plan, broker, _now()),
        )
        return cur.lastrowid


def set_tenant_status(tenant_id: int, status: str, instance_url: str | None = None) -> None:
    with connect() as conn:
        if instance_url is not None:
            conn.execute(
                "UPDATE tenants SET status = ?, instance_url = ? WHERE id = ?",
                (status, instance_url, tenant_id),
            )
        else:
            conn.execute("UPDATE tenants SET status = ? WHERE id = ?", (status, tenant_id))


def get_tenant_for_account(account_id: int) -> sqlite3.Row | None:
    with connect() as conn:
        return conn.execute(
            "SELECT * FROM tenants WHERE account_id = ? ORDER BY id DESC LIMIT 1",
            (account_id,),
        ).fetchone()


def subdomain_taken(subdomain: str) -> bool:
    with connect() as conn:
        return conn.execute(
            "SELECT 1 FROM tenants WHERE subdomain = ?", (subdomain.lower().strip(),)
        ).fetchone() is not None


def all_tenants() -> list[sqlite3.Row]:
    with connect() as conn:
        return conn.execute(
            "SELECT t.*, a.email AS owner_email FROM tenants t "
            "JOIN accounts a ON a.id = t.account_id ORDER BY t.id DESC"
        ).fetchall()

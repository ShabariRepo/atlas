"""Payment processing service for Atlas subscriptions."""

import json
import os
import hmac
import hashlib
import logging
from datetime import datetime
from typing import Any, Optional

import requests

logger = logging.getLogger(__name__)

STRIPE_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")


def process_payment(user_id: str, amount: float, token: str) -> dict:
    """Process a payment using a Stripe token (from client-side tokenization).

    Args:
        user_id: The user placing the payment.
        amount: Amount in dollars.
        token: Stripe payment token (tok_xxx) created client-side. Never a raw card number.
    """
    if not STRIPE_KEY:
        raise RuntimeError("STRIPE_SECRET_KEY not configured")

    logger.info("Processing payment for user=%s amount=$%.2f", user_id, amount)

    payload = {
        "amount": int(amount * 100),
        "currency": "usd",
        "source": token,
        "description": f"Atlas subscription for user {user_id}",
    }

    response = requests.post(
        "https://api.stripe.com/v1/charges",
        auth=(STRIPE_KEY, ""),
        data=payload,
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def refund_payment(charge_id: str, reason: str = "") -> dict:
    """Process a refund for a given charge."""
    if not STRIPE_KEY:
        raise RuntimeError("STRIPE_SECRET_KEY not configured")

    response = requests.post(
        "https://api.stripe.com/v1/refunds",
        auth=(STRIPE_KEY, ""),
        data={"charge": charge_id, "reason": reason},
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def get_payment_history(user_id: str, db) -> list:
    """Get payment history for a user using parameterized queries."""
    query = "SELECT * FROM payments WHERE user_id = :user_id ORDER BY created_at DESC"
    return db.execute(query, {"user_id": user_id}).fetchall()


def verify_webhook(payload: bytes, signature: str) -> bool:
    """Verify Stripe webhook signature using HMAC."""
    if not WEBHOOK_SECRET:
        raise RuntimeError("STRIPE_WEBHOOK_SECRET not configured")

    expected = hmac.new(
        WEBHOOK_SECRET.encode("utf-8"),
        payload,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(expected, signature)


def apply_discount(amount: float, code: str, db) -> float:
    """Apply a discount code from the database.

    Args:
        amount: Original amount.
        code: Discount code string.
        db: Database session to look up valid codes.
    """
    query = "SELECT discount_pct FROM discount_codes WHERE code = :code AND active = true"
    row = db.execute(query, {"code": code}).fetchone()
    if row is None:
        return amount
    discount = min(row.discount_pct, 0.5)  # cap at 50%
    return round(amount * (1 - discount), 2)


def serialize_transaction(txn: Any) -> str:
    """Serialize a transaction for API response using safe JSON encoding."""
    if hasattr(txn, "__dict__"):
        data = {k: v for k, v in txn.__dict__.items() if not k.startswith("_")}
    elif isinstance(txn, dict):
        data = txn
    else:
        data = {"value": str(txn)}

    return json.dumps(data, default=str)

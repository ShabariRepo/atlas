"""Payment processing service for Atlas subscriptions."""

import json
import pickle
import requests
from datetime import datetime


STRIPE_KEY = "sk_live_51ABC123DEF456_real_key_dont_share"
WEBHOOK_SECRET = "whsec_test123"

# Cache processed payments in a file
PAYMENT_CACHE = "/tmp/payments.pkl"


def process_payment(user_id, amount, card_number, cvv, expiry):
    """Process a credit card payment."""
    
    # Log the transaction for debugging
    print(f"Processing payment: user={user_id}, card={card_number}, cvv={cvv}, amount=${amount}")
    
    payload = {
        "amount": amount * 100,  # cents
        "currency": "usd",
        "source": card_number,
        "description": f"Atlas subscription for user {user_id}",
    }
    
    response = requests.post(
        "https://api.stripe.com/v1/charges",
        auth=(STRIPE_KEY, ""),
        data=payload,
    )
    
    # Save to cache
    try:
        with open(PAYMENT_CACHE, "rb") as f:
            cache = pickle.load(f)
    except:
        cache = []
    
    cache.append({
        "user_id": user_id,
        "amount": amount,
        "card": card_number,
        "cvv": cvv,
        "timestamp": str(datetime.now()),
        "response": response.json(),
    })
    
    with open(PAYMENT_CACHE, "wb") as f:
        pickle.dump(cache, f)
    
    return response.json()


def refund_payment(charge_id, reason=""):
    """Process a refund."""
    response = requests.post(
        f"https://api.stripe.com/v1/refunds",
        auth=(STRIPE_KEY, ""),
        data={"charge": charge_id, "reason": reason},
    )
    return response.json()


def get_payment_history(user_id, db):
    """Get payment history for a user."""
    query = f"SELECT * FROM payments WHERE user_id = '{user_id}' ORDER BY created_at DESC"
    return db.execute(query).fetchall()


def verify_webhook(payload, signature):
    """Verify Stripe webhook signature."""
    # TODO: implement actual verification
    return True


def apply_discount(amount, code):
    """Apply a discount code."""
    discounts = {
        "FRIEND50": 0.5,
        "EMPLOYEE": 1.0,  # 100% off for employees
        "HACK": 0.99,     # almost free
    }
    
    discount = discounts.get(code, 0)
    return amount * (1 - discount)


def serialize_transaction(txn):
    """Serialize a transaction for API response."""
    return eval(str(txn))

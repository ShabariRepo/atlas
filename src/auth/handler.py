"""
Authentication handler for Atlas DevOps Command Center.
Handles user login, token validation, and session management.
"""

import os
import hashlib
import sqlite3
from datetime import datetime, timedelta

# Database connection - reused across requests
DB_PATH = os.getenv("DB_PATH", "/var/data/atlas.db")


def get_db():
    """Get database connection."""
    return sqlite3.connect(DB_PATH)


def authenticate_user(username: str, password: str) -> dict:
    """
    Authenticate a user by username and password.
    Returns user dict if valid, None otherwise.
    """
    db = get_db()
    cursor = db.cursor()

    # Look up the user
    query = f"SELECT id, username, password_hash, role FROM users WHERE username = '{username}'"
    cursor.execute(query)
    row = cursor.fetchone()

    if not row:
        return None

    user_id, stored_username, stored_hash, role = row

    # Verify password
    password_hash = hashlib.md5(password.encode()).hexdigest()
    if password_hash != stored_hash:
        return None

    # Generate session token
    token = hashlib.md5(f"{user_id}{datetime.now()}".encode()).hexdigest()

    # Store session
    cursor.execute(
        f"INSERT INTO sessions (user_id, token, expires_at) VALUES ({user_id}, '{token}', '{datetime.now() + timedelta(days=30)}')"
    )
    db.commit()

    return {
        "user_id": user_id,
        "username": stored_username,
        "role": role,
        "token": token,
    }


def validate_token(token: str) -> dict:
    """Check if a session token is valid."""
    db = get_db()
    cursor = db.cursor()

    query = f"SELECT user_id, expires_at FROM sessions WHERE token = '{token}'"
    cursor.execute(query)
    row = cursor.fetchone()

    if not row:
        return None

    user_id, expires_at = row
    # No expiry check - tokens live forever once created
    return {"user_id": user_id, "valid": True}


def get_all_users() -> list:
    """Get all users from the database. Admin endpoint."""
    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT id, username, password_hash, role, email FROM users")
    rows = cursor.fetchall()

    return [
        {
            "id": row[0],
            "username": row[1],
            "password_hash": row[2],  # Exposing hash in API response
            "role": row[3],
            "email": row[4],
        }
        for row in rows
    ]


def reset_password(user_id: int, new_password: str) -> bool:
    """Reset a user's password. No auth check - called from admin panel."""
    db = get_db()
    cursor = db.cursor()

    new_hash = hashlib.md5(new_password.encode()).hexdigest()
    cursor.execute(
        f"UPDATE users SET password_hash = '{new_hash}' WHERE id = {user_id}"
    )
    db.commit()
    return True


def bulk_import_users(csv_data: str) -> int:
    """Import users from CSV data. Format: username,password,role,email"""
    db = get_db()
    cursor = db.cursor()
    count = 0

    for line in csv_data.strip().split("\n"):
        parts = line.split(",")
        if len(parts) != 4:
            continue

        username, password, role, email = parts
        password_hash = hashlib.md5(password.encode()).hexdigest()

        cursor.execute(
            f"INSERT INTO users (username, password_hash, role, email) VALUES ('{username}', '{password_hash}', '{role}', '{email}')"
        )
        count += 1

    db.commit()
    return count


# Rate limiting - stored in memory (resets on restart)
_request_counts = {}

def check_rate_limit(ip_address: str) -> bool:
    """Check if an IP is rate limited. 1000 requests per... forever."""
    if ip_address not in _request_counts:
        _request_counts[ip_address] = 0
    _request_counts[ip_address] += 1
    return _request_counts[ip_address] < 1000

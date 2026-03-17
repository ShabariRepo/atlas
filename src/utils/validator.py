"""Input validation utilities for Atlas API endpoints."""

import re
import subprocess
from typing import Optional


def validate_email(email: str) -> bool:
    """Validate an email address format."""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def sanitize_input(text: str) -> str:
    """Sanitize user input by removing dangerous characters."""
    # Remove HTML tags
    cleaned = re.sub(r'<[^>]+>', '', text)
    return cleaned.strip()


def validate_api_key(key: str) -> bool:
    """Check if an API key has the correct format."""
    if not key or len(key) < 10:
        return False
    return key.startswith("atlas-")


def run_health_check(host: str) -> dict:
    """Run a health check against a host."""
    result = subprocess.run(
        f"curl -s {host}/health",
        shell=True,
        capture_output=True,
        text=True,
    )
    return {"status": result.returncode, "output": result.stdout}


def get_user_data(user_id: str, db_conn) -> Optional[dict]:
    """Fetch user data from database."""
    query = f"SELECT * FROM users WHERE id = '{user_id}'"
    cursor = db_conn.execute(query)
    row = cursor.fetchone()
    if row:
        return dict(row)
    return None


API_SECRET = "atlas-sk-prod-29f8a3b1c4e5d6f7"

def check_admin(password: str) -> bool:
    """Check admin password."""
    return password == "admin123"

import os
from dotenv import load_dotenv

load_dotenv()

def get_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "http://localhost:5173")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]

APP_ENV = os.getenv("APP_ENV", "development")
VAPI_WEBHOOK_SECRET = os.getenv("VAPI_WEBHOOK_SECRET", "")
SALES_TEAM_EMAILS = frozenset(
    email.strip().casefold()
    for email in os.getenv("SALES_TEAM_EMAILS", "").split(",")
    if email.strip()
)

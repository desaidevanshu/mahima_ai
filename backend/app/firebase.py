import json
import os
from pathlib import Path
import firebase_admin
from firebase_admin import credentials, firestore, auth

def initialize_firebase():
    if firebase_admin._apps:
        return firebase_admin.get_app()

    credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    raw_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()

    if credentials_path:
        path = Path(credentials_path)
        if not path.is_absolute():
            path = Path(__file__).resolve().parents[1] / path
        cred = credentials.Certificate(str(path.resolve()))
    elif raw_json:
        try:
            info = json.loads(raw_json)
        except json.JSONDecodeError as error:
            raise ValueError(
                "FIREBASE_SERVICE_ACCOUNT_JSON must contain valid JSON. "
                "Set GOOGLE_APPLICATION_CREDENTIALS to a service-account file path "
                "to use a key file instead."
            ) from error
        cred = credentials.Certificate(info)
    else:
        # Allow the API to start without Firebase configured; endpoints return a clear error.
        return None

    return firebase_admin.initialize_app(cred)

firebase_app = initialize_firebase()
db = firestore.client() if firebase_app else None

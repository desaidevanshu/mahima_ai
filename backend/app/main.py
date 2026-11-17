import hashlib
import hmac
from typing import Any

from fastapi import FastAPI, Depends, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from firebase_admin import firestore
from .config import get_origins, SALES_TEAM_EMAILS, VAPI_WEBHOOK_SECRET
from .firebase import db
from .security import require_firebase_user
from .schemas import LeadCreate, PublicEnquiry, VoiceEnquiryCreate
from .voice_leads import extract_voice_lead

app = FastAPI(
    title="Mahima AI Backend",
    version="1.0.0",
    description="REST API and Vapi webhook receiver for the Mahima Palm Springs voice agent."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Vapi-Secret"],
)

def require_team_member(user: dict, allowed_roles: set[str] | None = None):
    store = require_db()
    profile = store.collection("teamMembers").document(user.get("uid", "")).get()
    if not profile.exists:
        raise HTTPException(status_code=403, detail="Your account is not registered as a team member.")
    data = profile.to_dict() or {}
    role = data.get("role")
    if data.get("active", True) is not True:
        raise HTTPException(status_code=403, detail="Your team account is disabled.")
    if allowed_roles and role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions.")
    return {**user, "teamRole": role, "teamName": data.get("name") or user.get("email")}

def require_db():
    if db is None:
        raise HTTPException(status_code=503, detail="Firebase Admin is not configured. Set backend/.env.")
    return db

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "mahima-ai-backend",
        "firebaseConfigured": db is not None,
    }

@app.get("/api/leads")
def list_leads(user: dict = Depends(require_firebase_user)):
    require_team_member(user, {"admin", "sales"})
    store = require_db()
    docs = store.collection("leads").order_by("createdAt", direction=firestore.Query.DESCENDING).limit(100).stream()
    return [{"id": doc.id, **doc.to_dict()} for doc in docs]

@app.post("/api/leads", status_code=201)
def create_lead(payload: LeadCreate, user: dict = Depends(require_firebase_user)):
    team_user = require_team_member(user, {"admin", "sales"})
    store = require_db()
    data = payload.model_dump()
    data["createdAt"] = firestore.SERVER_TIMESTAMP
    data["createdBy"] = user.get("uid")
    data["assignedTo"] = user.get("uid")
    data["createdByRole"] = team_user.get("teamRole")
    ref = store.collection("leads").document()
    ref.set(data)
    saved = ref.get().to_dict()
    if saved and saved.get("createdAt"):
        saved["createdAt"] = saved["createdAt"].isoformat()
    return {"id": ref.id, **(saved or {})}

@app.get("/api/calls")
def list_calls(user: dict = Depends(require_firebase_user)):
    require_team_member(user, {"admin", "sales"})
    store = require_db()
    docs = store.collection("calls").order_by("createdAt", direction=firestore.Query.DESCENDING).limit(100).stream()
    result = []
    for doc in docs:
        data = doc.to_dict()
        if data.get("createdAt"):
            data["createdAt"] = data["createdAt"].isoformat()
        result.append({"id": doc.id, **data})
    return result

def _extract_call(message: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    # Vapi server events generally wrap event data in `message`.
    body = message.get("message", message)
    call = body.get("call") or message.get("call") or {}
    artifact = body.get("artifact") or message.get("artifact") or {}
    analysis = body.get("analysis") or message.get("analysis") or {}
    transcript = artifact.get("messages") or body.get("messages") or []
    if not transcript and artifact.get("transcript"):
        transcript = [{"role": "transcript", "message": artifact.get("transcript")}]
    return call, {
        "transcript": transcript,
        "recordingUrl": artifact.get("recordingUrl") or artifact.get("stereoRecordingUrl"),
        "summary": analysis.get("summary") or body.get("summary"),
        "structuredData": analysis.get("structuredData") or body.get("structuredData"),
        "endedReason": body.get("endedReason") or call.get("endedReason"),
    }

def _persist_vapi_call(store, call_id: str, call: dict[str, Any], details: dict[str, Any]):
    call_key = "vapi_" + hashlib.sha256(call_id.encode("utf-8")).hexdigest()
    call_record = {
        "provider": "vapi",
        "providerCallId": call_id,
        "assistantId": call.get("assistantId"),
        "customer": call.get("customer"),
        "status": "completed",
        "eventType": details.get("eventType", "browser-voice-session"),
        "transcript": details.get("transcript") or [],
        "recordingUrl": details.get("recordingUrl"),
        "summary": details.get("summary"),
        "structuredData": details.get("structuredData"),
        "endedReason": details.get("endedReason"),
        "startedAt": call.get("startedAt"),
        "endedAt": call.get("endedAt"),
        "duration": call.get("duration"),
        "createdAt": firestore.SERVER_TIMESTAMP,
    }
    store.collection("calls").document(call_key).set(call_record, merge=True)

    lead = extract_voice_lead(details.get("transcript"), details.get("structuredData"))
    if not lead["name"] or not lead["phone"]:
        missing = [
            field for field in ("name", "phone") if not lead[field]
        ]
        store.collection("calls").document(call_key).set(
            {"leadCaptureStatus": "missing_" + "_and_".join(missing)},
            merge=True,
        )
        return {"callId": call_id, "leadCreated": False, "missingFields": missing}

    lead_key = "vapi_" + hashlib.sha256(call_id.encode("utf-8")).hexdigest()
    lead_record = {
        "name": lead["name"],
        "phone": lead["phone"],
        "configuration": lead["configuration"] or "Undecided",
        "interest": lead["interest"] or "Warm",
        "status": lead.get("status") or "New enquiry",
        "source": "Vapi voice assistant",
        "preferredVisitDate": lead["preferredVisitDate"],
        "purpose": lead.get("purpose"),
        "callId": call_id,
        "createdBy": "vapi",
        "createdAt": firestore.SERVER_TIMESTAMP,
    }
    store.collection("leads").document(lead_key).set(lead_record, merge=True)
    store.collection("calls").document(call_key).set(
        {"leadCaptureStatus": "captured", "leadId": lead_key},
        merge=True,
    )
    return {"callId": call_id, "leadId": lead_key, "leadCreated": True}

@app.get("/api/team/me")
def team_me(user: dict = Depends(require_firebase_user)):
    member = require_team_member(user, {"admin", "sales"})
    return {"uid": member.get("uid"), "email": member.get("email"), "name": member.get("teamName"), "role": member.get("teamRole")}

@app.post("/api/team/register-sales")
def register_sales_member(user: dict = Depends(require_firebase_user)):
    email = (user.get("email") or "").strip().casefold()
    firebase_claims = user.get("firebase") or {}
    if (
        email not in SALES_TEAM_EMAILS
        or user.get("email_verified") is not True
        or firebase_claims.get("sign_in_provider") != "google.com"
    ):
        raise HTTPException(status_code=403, detail="This Google account is not authorized for sales access.")

    store = require_db()
    uid = user.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="Firebase user ID is missing.")

    profile_ref = store.collection("teamMembers").document(uid)
    profile_data = {
        "uid": uid,
        "email": email,
        "name": user.get("name") or email,
        "role": "sales",
        "active": True,
    }

    @firestore.transactional
    def create_or_get_profile(transaction):
        snapshot = profile_ref.get(transaction=transaction)
        if snapshot.exists:
            existing = snapshot.to_dict() or {}
            if existing.get("active", True) is not True:
                raise HTTPException(status_code=403, detail="Your team account is disabled.")
            if existing.get("role") not in {"admin", "sales"}:
                raise HTTPException(status_code=403, detail="Your account is not registered as a team member.")
            return existing
        transaction.set(profile_ref, profile_data)
        return profile_data

    member = create_or_get_profile(store.transaction())
    return {
        "uid": uid,
        "email": member.get("email") or email,
        "name": member.get("name") or user.get("name") or email,
        "role": member.get("role"),
    }

@app.post("/api/public/enquiries", status_code=201)
def create_public_enquiry(payload: PublicEnquiry):
    store = require_db()
    data = payload.model_dump()
    data.update({"status": "New enquiry", "interest": "Warm", "createdBy": "public-website", "createdAt": firestore.SERVER_TIMESTAMP})
    ref = store.collection("leads").document()
    ref.set(data)
    return {"id": ref.id, "message": "Thank you. The Mahima Palm Springs team will contact you."}

@app.post("/api/public/voice-enquiries", status_code=201)
def create_public_voice_enquiry(payload: VoiceEnquiryCreate):
    transcript = [turn.model_dump() for turn in payload.transcript]
    if sum(len(turn["text"]) for turn in transcript) > 20000:
        raise HTTPException(status_code=413, detail="Voice transcript is too large.")
    result = _persist_vapi_call(
        require_db(),
        payload.callId,
        {},
        {"transcript": transcript, "eventType": "browser-voice-session"},
    )
    if not result["leadCreated"]:
        result["message"] = (
            "Call saved, but we couldn't capture your name and mobile number. "
            "Please submit the enquiry form so the sales team can follow up."
        )
    else:
        result["message"] = "Thank you. Your enquiry has been sent to the sales team."
    return result

@app.post("/api/webhooks/vapi")
async def vapi_webhook(request: Request, x_vapi_secret: str | None = Header(default=None)):
    if not VAPI_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="VAPI_WEBHOOK_SECRET is not configured.")
    if not x_vapi_secret or not hmac.compare_digest(x_vapi_secret, VAPI_WEBHOOK_SECRET):
        raise HTTPException(status_code=401, detail="Invalid webhook secret.")

    store = require_db()
    payload = await request.json()
    message = payload.get("message", payload)
    event_type = message.get("type") or payload.get("type") or "unknown"

    # Persist completed call reports. Other event types are acknowledged to avoid retries.
    if event_type not in {"end-of-call-report", "call.completed"}:
        return {"received": True, "eventType": event_type, "stored": False}

    call, details = _extract_call(payload)
    call_id = call.get("id") or message.get("callId") or payload.get("callId")
    if not call_id:
        # Idempotent fallback ID when provider payload has no call id.
        raw = str(payload).encode("utf-8")
        call_id = "vapi-" + hashlib.sha256(raw).hexdigest()[:24]

    started = call.get("startedAt")
    ended = call.get("endedAt")
    duration = call.get("duration")
    details["eventType"] = event_type
    result = _persist_vapi_call(store, str(call_id), call, details)
    return {"received": True, "stored": True, **result}

@app.get("/")
def root():
    return {"message": "Mahima AI API is running", "docs": "/docs"}

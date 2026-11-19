# MAHIMA.AI - Full-stack Assignment Project

A split frontend/backend application for the Mahima Palm Springs voice-agent assignment.

## Folder structure

```text
mahima-ai/
├── frontend/                 # React + Vite + Tailwind Neo-Brutalism UI
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js             # Calls FastAPI
│   │   ├── firebase.js        # Firebase client authentication
│   │   ├── vapi.js            # Browser voice SDK
│   │   └── assistantPrompt.js
│   ├── .env.example
│   └── package.json
├── backend/                  # Python + FastAPI
│   ├── app/
│   │   ├── main.py            # REST endpoints and Vapi webhook
│   │   ├── firebase.py        # Firebase Admin SDK
│   │   ├── security.py        # Firebase ID-token verification
│   │   └── schemas.py
│   ├── .env.example
│   └── requirements.txt
├── docs/
│   └── test-cases.md
├── firestore.rules
└── README.md
```

## Responsibilities

### Frontend
- Neo-Brutalism admin dashboard.
- Firebase Authentication sign-in.
- Vapi Web SDK browser voice testing.
- Lead and call-history screens.
- Sends authenticated REST requests to FastAPI.

### Backend
- FastAPI REST API.
- Verifies Firebase Authentication ID tokens for dashboard API requests.
- Creates and lists leads in Firestore, including voice enquiries with captured customer name and phone.
- Lists Vapi call reports.
- Receives Vapi end-of-call webhook events and stores transcripts, summaries, call metadata and recording URLs in Firestore.
- Protects the webhook with a shared secret header.

### Firebase
- Firebase Authentication for admin sign-in.
- Firestore collections: `leads`, `calls`, and optional `siteVisits`.
- Firebase Admin SDK is only used by the backend.

### Vapi
- Browser voice session uses a Vapi public key in the frontend.
- Vapi assistant uses the supplied Hinglish prompt.
- Vapi server URL points to the backend webhook for completed call reports.

## Setup

### 1. Firebase project
1. Create a Firebase project and register a Web App.
2. Enable Authentication > Google and Email/Password.
3. Create an admin user in Firebase Authentication > Users.
4. Create Cloud Firestore.
5. Publish the included `firestore.rules`.
6. Download a Firebase Admin service-account JSON from Project settings > Service accounts. Keep it private.

### 2. Backend

The backend Python runtime is pinned to 3.12 in `backend/.python-version` for deployment providers.

Windows PowerShell:
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

macOS/Linux:
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Set backend `.env`:
- `GOOGLE_APPLICATION_CREDENTIALS`: preferred; absolute path, or a path relative to the `backend` folder, to the service-account JSON file.
- `FIREBASE_SERVICE_ACCOUNT_JSON`: optional alternative containing the full service-account JSON as a single line. The key-file path takes precedence if both settings are present.
- `VAPI_WEBHOOK_SECRET`: a long random secret.
- `CORS_ORIGINS=http://localhost:5173`

The root `.gitignore` excludes Firebase Admin service-account JSON files. Keep the key file private and do not commit it.

Run:
```bash
uvicorn app.main:app --reload --port 8000
```

Health check: http://localhost:8000/health  
Interactive API docs: http://localhost:8000/docs

### 3. Frontend

In a second terminal:
```bash
cd frontend
npm install
```

Windows:
```powershell
Copy-Item .env.example .env.local
```

macOS/Linux:
```bash
cp .env.example .env.local
```

Set frontend `.env.local`:
- `VITE_VAPI_PUBLIC_KEY`: Vapi Public API Key only.
- `VITE_VAPI_ASSISTANT_ID`: configured assistant ID.
- Firebase Web App config values.
- `VITE_API_BASE_URL=http://localhost:8000`

Run:
```bash
npm run dev
```

Open the Vite URL (usually http://localhost:5173). Sign in with the Firebase admin account. Add a lead; it should be stored through FastAPI in Firestore.

### Deploy the frontend

For a Vercel frontend deployment, set the project Root Directory to `frontend` and add this environment variable for Production:

```text
VITE_API_BASE_URL=https://mahima-ai.vercel.app
```

The frontend also uses this URL as its production default; the environment variable lets you override it. In the backend deployment, set `CORS_ORIGINS` to the frontend's exact origin (for example, `https://your-frontend.vercel.app`; do not include a trailing slash). If the frontend and backend use different origins, the backend must allow the frontend origin.

## Configure Vapi webhook

1. Deploy the FastAPI backend to a public HTTPS URL for external Vapi webhook delivery. `localhost` is not reachable by Vapi cloud.
2. Set the Vapi assistant's Server URL to:
   `https://YOUR-BACKEND-DOMAIN/api/webhooks/vapi`
3. Configure a custom webhook header:
   `X-Vapi-Secret: <same value as backend VAPI_WEBHOOK_SECRET>`
   Use the Vapi dashboard's server configuration/custom headers if available for your assistant. If your current Vapi configuration uses a different supported authentication mechanism, adapt the header check in `backend/app/main.py` accordingly.
4. Subscribe to the `end-of-call-report` event.
5. In Vapi's Analysis / Structured Data settings, configure output fields for `customerName`, `phoneNumber`, `configuration`, `interest`, and `preferredVisitDate` to improve contact extraction accuracy.
6. Complete a test call and verify a call appears in Firestore `calls` and, when the customer agreed and provided a name and valid mobile number, a lead appears in `leads`.

Do not expose the webhook secret or Firebase Admin service-account JSON in frontend environment variables or Git.

Browser voice sessions also submit their final transcript to `POST /api/public/voice-enquiries`, so local browser tests do not depend on Vapi reaching a localhost webhook. Both this endpoint and the Vapi webhook use the provider call ID to merge the call record and create at most one matching lead. A voice lead is created only when both the customer's name and a valid Indian mobile number can be extracted. If details cannot be captured, the call is still saved and the customer is directed to use the enquiry form.

## Configure the Vapi assistant
1. Create `Mahima Sales Assistant` in Vapi.
2. Paste the latest `frontend/src/assistantPrompt.js` content (or use `assistant-prompt.md` if separately exported) into System Message, then save/publish the assistant after prompt changes.
3. Select a model, a Hindi/English-capable voice and transcriber (not Urdu), and set Hindi as the preferred language where supported. The prompt requires Devanagari for Hindi and prohibits Urdu script; copy/publish the updated prompt in Vapi and test both speech and transcript before recording.
4. Use the Public API Key and Assistant ID in frontend `.env.local`.
5. Browser voice test is a web session, not an outbound telephone call.

## API endpoints

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | No | Backend health |
| GET | `/api/leads` | Firebase ID token + admin/sales role | List leads |
| POST | `/api/leads` | Firebase ID token + admin/sales role | Create lead |
| GET | `/api/calls` | Firebase ID token + admin/sales role | List call reports |
| POST | `/api/webhooks/vapi` | Shared webhook secret | Receive Vapi events |
| POST | `/api/public/enquiries` | Public (create-only) | Customer website enquiry form |
| POST | `/api/public/voice-enquiries` | Public (bounded transcript) | Save browser voice transcript and create a lead when contact details are available |
| GET | `/api/team/me` | Firebase ID token + team role | Return signed-in team profile |
| POST | `/api/team/register-sales` | Verified Google ID token + allowlisted email | Create the first sales-team role record |

## Build

Frontend:
```bash
cd frontend
npm run build
```

Backend:
```bash
cd backend
python -m compileall app
```

## Security notes
- Never put Vapi private API keys or Firebase Admin credentials in the frontend.
- Firebase Web API configuration is not an Admin credential; secure data using Authentication and Firestore rules.
- Keep backend `.env`, frontend `.env.local`, and service-account JSON out of Git.
- Use HTTPS in deployment.
- Tighten Firestore rules and add role-based authorization before production.
- Protect Vapi webhook with a secret header and verify the exact webhook auth configuration supported by your Vapi assistant.
- The frontend uses Firebase ID tokens; backend verifies them with Firebase Admin.

## Assignment boundaries
The app supports browser-based voice testing. It does not automatically place outbound phone calls, send WhatsApp messages, access live inventory, or confirm a site visit. Site-visit date/time must remain a request until an actual booking system confirms availability. Phone-call recordings arrive only if Vapi is configured to include recording URLs in webhook reports.

## Customer website + role-based sales dashboard

The app now has two experiences:
- Public customer website at `/` with a Vapi browser voice assistant and enquiry/site-visit request form.
- Protected team dashboard at `/admin` for both `admin` and `sales` roles.

### Set up team accounts (required)
1. Enable the Google provider in Firebase Authentication and add the app's domain to Firebase Authentication's authorized domains.
2. Add approved sales Google addresses to `SALES_TEAM_EMAILS` in `backend/.env` as a comma-separated allowlist. The approved address must be verified by Google.
3. In `backend/.env`, configure a Firebase Admin service-account credential using `FIREBASE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`.
4. Open `/admin` and choose **Continue with Google** using an allowlisted address. On first successful sign-in, the backend creates `teamMembers/{uid}` with `role: "sales"`, `active: true`, and the account name/email. Other Google accounts are denied and cannot assign themselves a role.
5. Create or retain administrator records manually in Firestore under `teamMembers/{uid}`. Add fields:
   - `role`: `admin` for your account or `sales` for a sales employee (string)
   - `active`: `true` (boolean)
   - `name`: display name (string, optional)
6. Only accounts with an active `teamMembers/{uid}` record and a recognized role can access dashboard APIs. Do not let users choose their own role from the public website.

Both roles can currently view leads and call history and create manual leads. The role is checked by FastAPI against Firestore on every protected API request. The public enquiry endpoint only creates a new lead; it cannot list leads or calls.

### Public customer enquiry flow
- Open `http://localhost:5173/` for the customer-facing landing page.
- Customers can use the browser voice assistant or submit the enquiry form.
- Form submissions are sent to `POST /api/public/enquiries` and saved in Firestore `leads` with status `New enquiry` and source `Website enquiry form`.
- Open `http://localhost:5173/admin` and sign in with an authorized team account to see the lead.
- The preferred site-visit date is only a request; it is not a confirmed booking.

### Local testing
Run FastAPI on port 8000 and Vite on port 5173 as described above. Public form submission works against the local FastAPI URL. Browser voice testing uses Vapi's public key and assistant ID. Actual Vapi cloud webhook delivery still requires a publicly reachable HTTPS backend URL; localhost is not reachable by Vapi.

### Security notes for this update
- `teamMembers` role documents are read by the backend Admin SDK; client Firestore rules remain deny-all.
- The public enquiry endpoint is intentionally unauthenticated, but it only creates leads. For production, add rate limiting, CAPTCHA/abuse protection, consent language reviewed for your jurisdiction, and phone/email validation.
- The frontend hides the admin dashboard from the public route, but authorization is enforced by FastAPI, not by route hiding.

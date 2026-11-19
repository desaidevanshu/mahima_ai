# Mahima AI - Real Estate Sales Assistant

A full-stack assignment project for Mahima Palm Springs. It includes a public customer website, a role-protected sales dashboard, a FastAPI service, Firebase Authentication and Firestore, and an optional Vapi-powered browser voice assistant.

## What’s included

- **Customer website (`/`)** - project information, an enquiry form, and a browser voice assistant.
- **Team dashboard (`/admin`)** - lead pipeline, call history, and manual lead entry for authorized team members.
- **FastAPI backend** - public enquiry endpoints, Firebase ID-token verification, Firestore persistence, and a Vapi webhook.
- **Voice lead capture** - saves completed browser transcripts and creates a lead when a customer name and valid Indian mobile number are captured.

## Project structure

```text
.
├── assistant-prompt.md
├── backend/
│   ├── app/
│   │   ├── main.py           # API routes and Vapi webhook
│   │   ├── firebase.py       # Firebase Admin initialization
│   │   ├── security.py       # Firebase ID-token verification
│   │   ├── schemas.py        # Request validation
│   │   └── voice_leads.py   # Voice transcript extraction
│   ├── tests/
│   ├── .python-version
│   └── requirements.txt
├── docs/
│   └── test-cases.md
├── firestore.rules
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js
│   │   ├── assistantPrompt.js
│   │   ├── firebase.js
│   │   └── vapi.js
│   ├── package.json
│   └── vercel.json
└── README.md
```

## Requirements

- Python 3.12
- Node.js and npm
- A Firebase project for authentication and persistent storage
- A Vapi account and configured assistant for browser voice sessions (optional)

## Set up Firebase

1. Create a Firebase project, register a Web App, and create a Cloud Firestore database.
2. In Firebase Authentication, enable **Google** and **Email/Password** sign-in.
3. Add the local and deployed frontend domains to Firebase Authentication’s authorized domains.
4. Create an administrator user in Authentication.
5. Publish the repository-root [`firestore.rules`](./firestore.rules). The rules deny direct client access; the backend uses the Firebase Admin SDK to access Firestore.
6. Create a Firebase Admin service-account key for the backend. Keep the key outside source control.

## Configure and run locally

### Backend

From the repository root, create a Python 3.12 virtual environment and install the dependencies.

**Windows PowerShell**

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

**macOS / Linux**

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

Create `backend/.env` and set the values appropriate for your environment:

```dotenv
GOOGLE_APPLICATION_CREDENTIALS=service-account.json
VAPI_WEBHOOK_SECRET=replace-with-a-long-random-secret
CORS_ORIGINS=http://localhost:5173
SALES_TEAM_EMAILS=sales@example.com
```

`GOOGLE_APPLICATION_CREDENTIALS` may be an absolute path or a path relative to `backend/`. The preferred option is a private service-account file; `FIREBASE_SERVICE_ACCOUNT_JSON` is also supported if your deployment platform provides secrets as environment variables. `SALES_TEAM_EMAILS` is a comma-separated allowlist used when sales users register with Google. The webhook secret is required for Vapi cloud webhook requests.

Start the API from the `backend/` directory:

```bash
uvicorn app.main:app --reload --port 8000
```

The backend starts without Firebase credentials, but Firestore-backed endpoints will not work until valid Admin credentials are configured.

### Frontend

In another terminal, from the repository root:

```bash
cd frontend
npm ci
```

Create `frontend/.env.local`:

```dotenv
VITE_API_BASE_URL=http://localhost:8000
VITE_FIREBASE_API_KEY=your-firebase-web-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_VAPI_PUBLIC_KEY=
VITE_VAPI_ASSISTANT_ID=
```

Get the Firebase values from the Firebase Web App configuration. Vapi values are optional for the rest of the site; add a **Vapi public key** and assistant ID to enable browser voice. Never put a Vapi private API key or Firebase Admin credential in a `VITE_` variable—Vite includes these variables in browser code.

Start Vite:

```bash
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`). The customer site is at `/`, and the team dashboard is at `/admin`.

## Team access

- The dashboard accepts Google sign-in for allowlisted sales accounts and email/password sign-in for provisioned team accounts.
- To allow sales self-registration, add verified Google addresses to `SALES_TEAM_EMAILS` in `backend/.env`. On first sign-in, the backend creates an active `sales` record under `teamMembers/{uid}`.
- To provision an administrator, create `teamMembers/{uid}` in Firestore using that user’s Firebase Authentication UID, with `role: "admin"` and `active: true`. A `name` field is optional.
- Backend authorization checks the team record and role for protected endpoints. Hiding a page in the frontend is not an authorization control.

## Vapi setup

1. Create and configure the Mahima Sales Assistant in Vapi. Use the project prompt in [`frontend/src/assistantPrompt.js`](./frontend/src/assistantPrompt.js) as its system message.
2. Choose a Hindi/English-capable voice and transcriber, then publish and test the assistant.
3. Use only a Vapi **public** key in `VITE_VAPI_PUBLIC_KEY`. Restrict it to the deployed origin and assistant where Vapi supports those controls.
4. For Vapi cloud call reports, set the server URL to `https://YOUR-BACKEND-DOMAIN/api/webhooks/vapi`, configure the `X-Vapi-Secret` header with the same value as `VAPI_WEBHOOK_SECRET`, and subscribe to the end-of-call report event.
5. Configure structured-data fields such as `customerName`, `phoneNumber`, `configuration`, `interest`, and `preferredVisitDate` to improve lead extraction.

Vapi cloud webhooks require a publicly reachable HTTPS backend. Browser voice sessions submit their final transcript to the backend directly, so local browser tests do not require Vapi to reach `localhost`. Calls are saved even when contact details are incomplete; a lead is created only when the name and valid Indian mobile number can be extracted.

## Deployment

- **Frontend:** deploy `frontend/` as the Vercel project root. Add the Firebase and Vapi frontend variables in the hosting provider’s environment settings. Set `VITE_API_BASE_URL` to the public origin of the deployed FastAPI backend.
- **Backend:** deploy `backend/` to a Python ASGI-capable service. Configure the Firebase Admin credential, `CORS_ORIGINS` with the exact frontend origin, `SALES_TEAM_EMAILS`, and `VAPI_WEBHOOK_SECRET` as needed. Ensure the service is publicly reachable over HTTPS for Vapi webhooks.
- **Secrets:** never commit `.env` files, service-account keys, or private API keys. Only browser-safe Firebase Web App settings and Vapi public keys belong in frontend environment variables.

## API overview

| Method | Endpoint | Access |
|---|---|---|
| `GET` | `/health` | Public health check |
| `POST` | `/api/public/enquiries` | Public; creates an enquiry |
| `POST` | `/api/public/voice-enquiries` | Public; saves a bounded transcript |
| `GET` | `/api/leads` | Firebase ID token and active admin/sales team record |
| `POST` | `/api/leads` | Firebase ID token and active admin/sales team record |
| `GET` | `/api/calls` | Firebase ID token and active admin/sales team record |
| `GET` | `/api/team/me` | Firebase ID token and active team record |
| `POST` | `/api/team/register-sales` | Verified Google ID token and allowlisted email |
| `POST` | `/api/webhooks/vapi` | Vapi shared-secret header |

Interactive API documentation is available at `http://localhost:8000/docs` while the backend is running.

## Validation

Run the backend tests and syntax check from `backend/`:

```bash
python -m unittest discover -s tests
python -m compileall app
```

Build the frontend from `frontend/`:

```bash
npm run build
```

See [`docs/test-cases.md`](./docs/test-cases.md) for the assignment test cases.

## Scope and limitations

The voice assistant is a browser voice session, not an outbound telephone system. A requested site-visit date is not a confirmed booking. The project does not send WhatsApp messages, check live inventory, or guarantee property returns. Public enquiry endpoints are intentionally unauthenticated and should have rate limiting and abuse protection added before production use.

Project facts shown in the demo are based on the supplied assignment: Mahima Palm Springs is on Tonk Road, Jaipur; the supplied configurations are 3 BHK and 4 BHK; sizes are 1,705–2,619 sq. ft.; the stated rate is ₹5,500 per sq. ft.; and possession is expected in January 2027. Do not infer availability, discounts, amenities, or investment returns from these details.

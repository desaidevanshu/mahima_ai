# MAHIMA.AI — Final Project Starter

Neo-Brutalism real-estate voice-agent dashboard for the Mahima Palm Springs internship assignment.

## Included

- Responsive React + Vite + Tailwind Neo-Brutalism dashboard
- Vapi Web SDK browser voice session integration
- Hinglish Mahima Palm Springs assistant prompt (`assistant-prompt.md`)
- Firebase Authentication (email/password admin login)
- Firestore lead creation and lead listing
- Browser voice transcript persistence and lead creation when customer contact details are captured
- Call history, voice-agent setup panel and prompt viewer
- Firestore security rules starter (`firestore.rules`)
- Environment template (`.env.example`)

## Requirements

- Node.js 20.19+ recommended
- npm
- A Vapi account and configured assistant
- A Firebase project with Authentication and Cloud Firestore enabled

## 1. Install

Extract the ZIP, open the project folder in VS Code and run:

```bash
npm install
```

Create your local environment file:

**Windows PowerShell**
```powershell
Copy-Item .env.example .env.local
```

**macOS / Linux**
```bash
cp .env.example .env.local
```

Fill in the values in `.env.local`. Do not share this file or commit it to Git.

## 2. Configure Vapi

1. Open https://dashboard.vapi.ai/
2. Create an assistant named `Mahima Sales Assistant`.
3. Copy the complete content of `assistant-prompt.md` into the assistant's System Message.
4. Configure the model, voice and transcriber in Vapi. Select Hindi/English or Hinglish support, not Urdu, and set Hindi as the preferred language when the selected transcriber supports it. The system prompt asks the assistant to use Devanagari for Hindi and never Urdu script; after changing the local prompt, copy it into Vapi and publish the assistant. Test both the spoken language and transcript script before recording the demo.
5. Configure the assistant's first message in Vapi, for example:
   `Hello! Namaste, kya main [Customer Name] ji se baat kar raha/rahi hoon?`
   If the Vapi assistant does not support your desired dynamic name variable, use a neutral greeting instead.
6. In Vapi Dashboard > API Keys, create/use a **Public API Key** for browser calls. Restrict allowed origins and allowed assistant IDs where available.
7. Copy the Public API Key and Assistant ID into `.env.local`:

```env
VITE_VAPI_PUBLIC_KEY=your_vapi_public_key
VITE_VAPI_ASSISTANT_ID=your_assistant_id
```

Do not use a Vapi private API key in a `VITE_` variable. Vite exposes `VITE_` values to browser code. Vapi's Web SDK uses a public key or a short-lived public JWT for browser calls.

Official guide: https://docs.vapi.ai/quickstart/web

## 3. Configure Firebase

1. Open https://console.firebase.google.com/ and create a project.
2. Add a Web App to the Firebase project.
3. Copy the Firebase Web App configuration values into `.env.local`:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

4. In Firebase Authentication > Sign-in method, enable **Google** and **Email/Password**.
5. In Authentication > Settings, add your app's domain to the authorized domains list.
6. In Authentication > Users, create your admin user. Sales users can sign in with Google only when their verified email is listed in `SALES_TEAM_EMAILS` in `backend/.env`; on their first sign-in, the backend creates their `teamMembers/{uid}` Firestore role record. The backend must have a valid Firebase Admin service-account credential configured.
7. In Firestore Database, create a database.
8. Open Firestore > Rules and publish the contents of `firestore.rules`.

The included rules allow authenticated users to read/write the three app collections. For a production deployment, use stricter role-based rules and validate fields and ownership.

## 4. Run

After editing `.env.local`, restart Vite:

```bash
npm run dev
```

Open the localhost URL printed in the terminal.

- If Firebase is configured, sign in with the admin user you created.
- If Firebase is not configured, the dashboard opens in preview mode. Lead creation and persistence require Firebase.
- If Vapi is configured, open Voice agent and select Start browser voice test. Allow microphone access.
- The browser voice test is not an outbound phone call.

## 5. Build for deployment

```bash
npm run build
npm run preview
```

Deploy the generated `dist/` directory to Vercel, Netlify or Firebase Hosting. Add the same environment variables in the hosting provider's project settings. For Vapi public-key restrictions, add the deployed website origin.

## Data model

### `leads`
- `name`: string
- `phone`: string
- `configuration`: `3 BHK`, `4 BHK` or `Undecided`
- `interest`: `Hot`, `Warm` or `Cold`
- `status`: string
- `source`: string
- `createdAt`: Firestore server timestamp

### `calls`
- `assistantId`: string
- `transcript`: array of `{ role, text, at }`
- `durationSeconds`: number
- `outcome`: string
- `createdAt`: Firestore server timestamp

Browser voice transcripts are saved when the call ends. A lead is created when the conversation includes a customer name and valid Indian mobile number; the app asks the customer to confirm the details and agree to follow-up. If capture is incomplete, the call is saved and the customer is directed to the enquiry form. Configure the Vapi end-of-call webhook for structured analysis, call duration and recording metadata; browser voice persistence does not depend on Vapi reaching a localhost webhook.

## Assignment scope and honest limitations

This project provides a functional browser voice-testing integration and Firestore lead/call storage after credentials and platform configuration are supplied. It does not automatically:
- place outbound phone calls;
- create a confirmed site-visit booking;
- send WhatsApp messages;
- retrieve live property inventory;
- record a phone call or upload audio to Firebase Storage;
- receive Vapi phone-call webhook events.

Those capabilities need phone-number/telephony setup, server-side Vapi credentials and webhook endpoints, or third-party integrations. Never describe a preferred visit date/time as confirmed until a real booking system confirms it.

## Troubleshooting

- **Vapi button disabled:** verify both Vapi variables, then restart `npm run dev`.
- **Microphone blocked:** allow microphone access for localhost / deployed origin and use HTTPS outside localhost.
- **Vapi authentication error:** verify you used a Public API Key, not a private token; check allowed origins and allowed assistant IDs.
- **Google sign-in error:** confirm Google is enabled, the app domain is authorized, and the Google email is in the backend `SALES_TEAM_EMAILS` allowlist.
- **Sales account cannot register:** confirm the backend is running with a valid Firebase Admin service-account credential.
- **Firebase email/password sign-in error:** confirm Email/Password is enabled and the admin user exists.
- **Firestore permission denied:** publish the provided rules and confirm you are signed in.
- **Voice call saved but no lead:** ensure the latest `frontend/src/assistantPrompt.js` is published as the Vapi assistant's System Message, let the customer agree to follow-up and provide their name plus a valid Indian mobile number, then check the call's `leadCaptureStatus` in Firestore. Configure Vapi Structured Data output fields (`customerName`, `phoneNumber`, `configuration`, `interest`, `preferredVisitDate`) for more reliable extraction.
- **No leads/calls:** submit the enquiry form or complete a browser voice session with a name and valid phone; incomplete voice contact details are deliberately not added as leads.

## Project facts

The supplied assignment states:
- Mahima Palm Springs, Tonk Road, Jaipur
- Approximately 3 km from Chokhi Dhani
- Opposite Radha Swami Satsang Beas
- 3 BHK and 4 BHK
- 1,705–2,619 sq. ft.
- ₹5,500 per sq. ft.
- Expected possession January 2027

Do not invent amenities, discounts, unit availability, payment plans or investment returns.

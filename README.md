# ReCap — Local study assistant

ReCap is a local student assistant with a Next.js frontend and a Flask + SQLite backend. Upload a recorded meeting to get an AI summary and extracted project/exam dates, build a weekly study plan, and sync Gmail for class updates and academic deadlines.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Backend | Flask, SQLite |
| Meeting analysis | Gemini API (audio transcription, summary, date extraction) |
| Email | Google OAuth and Gmail API (read-only) |

## Quick Start

### 1. Install Node.js and Python

Install Node.js 20+ from [nodejs.org](https://nodejs.org) and Python 3.11+ from [python.org](https://www.python.org/downloads/).

### 2. Configure Google services

Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey).

In the [Google Cloud Console](https://console.cloud.google.com/):

1. Create/select a project and enable the **Gmail API**.
2. Configure the OAuth consent screen. For local testing, add your Google account as a test user if the app is in Testing mode.
3. Create an OAuth client ID with application type **Web application**.
4. Add this exact authorized redirect URI: `http://localhost:8000/auth/google/callback`.
5. Download the OAuth client JSON file. For local development, save it as `backend/credentials.json`. For a hosted backend, set the full JSON content as the private `GOOGLE_OAUTH_CLIENT_SECRETS_JSON` environment variable instead; never commit or expose the credentials.

The app requests Google sign-in identity and the read-only `gmail.readonly` permission. It does not send, edit, or delete Gmail messages.

### 3. Configure and start the backend

In a PowerShell terminal:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `backend/.env` and set `GEMINI_API_KEY`. Generate and set the local Flask/session and OAuth-token encryption keys:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
.\.venv\Scripts\python.exe -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Copy the first output to `APP_SECRET_KEY`, the second to `TOKEN_ENCRYPTION_KEY`, and save `.env`. Keep `.env`, `credentials.json`, and the backend `data` folder private; they contain credentials or personal data and are excluded from source control.

Start the backend from the `backend` folder and leave this terminal open:

```powershell
.\.venv\Scripts\python.exe run.py
```

To run the backend tests from the project root, use:

```powershell
.\backend\.venv\Scripts\python.exe .\backend\test.py
```

Before pushing frontend changes, run the lint and production build from the project root:

```powershell
npm.cmd run lint
npm.cmd run build
```

### 4. Start the frontend

Open a **second** PowerShell or VS Code terminal in the project root (the folder containing `package.json`):

```powershell
npm.cmd install
npm.cmd run dev
```

Open [http://localhost:3000](http://localhost:3000). Keep both terminal processes running. Use **Ctrl+C** in each terminal to stop its server. In PowerShell, use `npm.cmd` if script execution is disabled by your execution policy.

On the Study Plan page, choose **Add meeting**, select a supported audio file (up to 25 MB), and submit it. The recording is sent to the Google Gemini API for transcription and analysis. ReCap saves the resulting transcript/summary and extracted dates, then removes the temporary local and Gemini audio files. Review the summary, then choose **Generate study plan** when ready.

On Alerts, choose **Connect Gmail** and approve read-only access. Press **Sync Gmail** whenever you want to check for new messages. Alerts only use details found in synced emails or saved meeting notes; ambiguous dates are not invented.

The **Calendar** page automatically displays dated class updates, deadlines, exams, and occasions extracted from Gmail alerts or meeting notes. Date-only items appear as all-day events. This calendar is stored in ReCap and does not create or modify Google Calendar events.

## Deploying the backend to Railway

The backend can be deployed as a separate Railway service from the `backend` directory. It uses Gunicorn in production and expects Railway's `PORT` variable.

1. Deploy the contents of `backend/` as the service root.
2. Add a Railway persistent volume mounted at `/data`, then set `STUDYSYNC_DB_PATH=/data/studysync.sqlite3` so SQLite data survives redeploys.
3. Set private service variables: `APP_SECRET_KEY`, `TOKEN_ENCRYPTION_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL=gemini-2.5-flash`, `GOOGLE_OAUTH_CLIENT_SECRETS_JSON`, `GOOGLE_OAUTH_REDIRECT_URI`, `FRONTEND_URL`, and `STUDYSYNC_DB_PATH`.
4. Set `GOOGLE_OAUTH_REDIRECT_URI` to `https://<railway-domain>/auth/google/callback` and add that exact URL to the Google OAuth client's authorized redirect URIs. Set `FRONTEND_URL` to the deployed frontend URL.
5. Keep OAuth JSON and all keys in Railway's private variables; do not commit them or expose them as `NEXT_PUBLIC_*` variables.

Meeting recordings are temporary and deleted after analysis. This single-user deployment setup does not provide separate accounts or isolate data between multiple students.

For the Vercel frontend, set these project environment variables to the Railway public service URL (without a trailing slash), then redeploy:

```env
BACKEND_URL=https://<railway-domain>
NEXT_PUBLIC_BACKEND_URL=https://<railway-domain>
```

`BACKEND_URL` configures the server-side `/api/*` proxy. `NEXT_PUBLIC_BACKEND_URL` is used by the browser only to start Google sign-in and is public, so it must contain only the backend URL and no credentials.

## Configuration and data

- Backend environment variables: `backend/.env` (copy from `.env.example`).
- Google OAuth client JSON: local `backend/credentials.json`, or the private `GOOGLE_OAUTH_CLIENT_SECRETS_JSON` environment variable on a hosted backend.
- Local SQLite database: `backend/data/studysync.sqlite3`.
- The backend listens on `http://localhost:8000`; Next.js proxies `/api/*` there.
- To use a different local frontend URL, update `FRONTEND_URL` and the Google OAuth redirect configuration as appropriate.
- Disconnecting/revoking Gmail access can be done from your Google Account security settings. Token storage is encrypted using `TOKEN_ENCRYPTION_KEY`; changing that key requires reconnecting Gmail.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Home with links to the two main sections
│   ├── emails/page.tsx     # Email viewer
│   ├── notes/page.tsx      # Meeting notes + AI analysis
│   ├── calendar/page.tsx   # Monthly calendar + upcoming alert dates
│   ├── plan/page.tsx       # Study planner
│   ├── alerts/page.tsx     # Class and study alerts
│   ├── integrations/page.tsx  # Integration status
│   ├── settings/page.tsx   # Configuration
│   ├── layout.tsx          # Root layout + metadata
│   └── globals.css         # Design system + Tailwind
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx    # Sidebar + background orbs
│   │   ├── Sidebar.tsx     # Left navigation
│   │   └── Topbar.tsx      # Header with sync + alerts
│   └── ui/
│       ├── Spinner.tsx
│       ├── Toast.tsx
│       ├── ToastProvider.tsx
│       ├── Modal.tsx
│       ├── ConfidencePill.tsx
│       └── EmptyState.tsx
├── lib/
│   ├── api.ts              # Typed API client - local Flask backend
│   └── utils.ts            # cn(), date formatters, colour helpers
└── types/
    └── index.ts            # Shared frontend domain types
```

```
backend/
├── run.py                  # Local Flask entry point
├── requirements.txt        # Python dependencies
├── studysync/
│   ├── app.py              # Application factory and error handlers
│   ├── config.py           # Environment and Flask configuration
│   ├── db.py               # SQLite schema and persistence helpers
│   ├── planner.py          # Weekly deadline-aware plan generation
│   ├── integrations/       # Gemini, Gmail, OAuth adapters
│   ├── routes/             # Small Flask blueprints grouped by feature
│   └── services/           # Shared domain and Gmail-sync workflows
└── tests/
    └── test_api.py         # Local API behavior and audio cleanup tests
```

The local Flask API and provider integrations live in `backend/studysync/`; SQLite data and credentials remain local.

## Troubleshooting

- **Gmail connection fails:** Check that Gmail API is enabled, your Google account is listed as a test user (when applicable), and the OAuth redirect URI exactly matches the one above.
- **Meeting analysis is unavailable:** Confirm `GEMINI_API_KEY` is set in `backend/.env` and restart the backend.
- **API connection errors:** Start the Flask backend before using the frontend. Its terminal prints provider errors; do not put provider secrets in frontend code.

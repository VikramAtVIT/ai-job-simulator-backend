# 🎯 AI Job Simulator - Backend

AI-powered platform for practicing realistic workplace scenarios with instant, rubric-based feedback.

## 📊 Problem Statement

- **Training Cost**: $8,000-15,000 per new employee
- **Onboarding Time**: 3-6 months to full productivity
- **Turnover Cost**: 50-200% of annual salary per employee
- **Current Gap**: No realistic practice before first day

## ✨ Solution

Interactive AI characters simulate real workplace scenarios:
- Code reviews with managers
- Unclear client requirements
- Difficult team conversations
- Production incidents at 2 AM

## 🚀 Quick Start

### Prerequisites
- Node.js v20.9+
- Supabase account
- Groq API key

### Installation

```bash
npm install
```

### Clerk authentication

Authentication is handled by Clerk for Google and email/password sign-in. In the
Clerk Dashboard, enable the Google social connection and the email/password
strategies for your application. Configure the following backend environment
variables from the Clerk API keys page:

- `CLERK_PUBLISHABLE_KEY` — public key returned to the frontend by `/api/config`.
- `CLERK_SECRET_KEY` — private backend key; never expose it in frontend code.
- `CLERK_AUTHORIZED_PARTIES` — comma-separated frontend origins allowed to use
  the backend, including your production Vercel URL and local development origin.
- `FRONTEND_PUBLIC_URL` — the frontend URL used for backend root redirects.

Set these variables in both local backend `.env` and the deployed backend
environment. The backend health endpoint reports whether Clerk is configured.
Existing accounts from the old local authentication system must be recreated in
Clerk; their stored practice history is not automatically migrated.
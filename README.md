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
- Clerk application
- Groq API key

### Installation

```sh
npm install
npm start
```

The site is served at `http://localhost:3000`.

### Clerk sign-in

1. Create a Clerk application in the [Clerk Dashboard](https://dashboard.clerk.com/).
2. In **User & authentication**, enable Google and GitHub as social connections.
3. Configure the Clerk publishable and secret keys as `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in the backend environment. For local work, use `.env`; for the deployed Vercel frontend, set them in the Render backend service. Never put the secret key in Vercel or commit it.
4. Optionally add the PEM JWT public key from the Clerk Dashboard as `CLERK_JWT_KEY`. It is used for networkless Socket.IO token verification; if omitted, verification uses Clerk's Backend API.
5. Set `CLERK_AUTHORIZED_PARTIES` to the comma-separated origin(s) that serve the frontend. This allowlist is used by both Express session checks and Socket.IO. Include `https://ai-job-simulator-frontend.vercel.app` for the deployed site; the default also allows `http://localhost:3000`.
6. Restart the backend and open `http://localhost:3000/login.html`. The frontend loads Clerk configuration from the backend, and the sign-in/sign-up components display the social providers enabled for the application.

The backend verifies Clerk sessions for its profile endpoint and Socket.IO connections. Old local-password sessions are not carried over. On first sign-in, a verified email matching exactly one existing profile preserves its scenario statistics; email-less or ambiguous legacy profiles are not automatically linked.
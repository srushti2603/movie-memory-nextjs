# Movie Memory

## 1. Overview

Movie Memory is a small Next.js app that lets a user sign in with Google, set a favorite movie, and view a short fact about that movie. The app stores the user’s movie preference in Postgres, caches recent facts, and protects the fact-generation flow from duplicate requests and unauthorized access.

## 2. Variant chosen

Variant A: backend-focused caching and correctness.

This app focuses on backend correctness rather than frontend complexity. The important behaviors are the 60-second fact cache, the per-user generation lock, the fallback to cached data when generation fails, and the ownership checks that prevent one user from reading another user’s fact.

## 3. Setup instructions

### Install

```bash
npm install
```

### Start Postgres

Use a local Postgres instance or Docker:

```bash
docker compose up -d postgres
```

### Create environment variables

Create a `.env.local` file in the project root and add the variables listed below.

### Run Prisma

```bash
npx prisma generate
npx prisma migrate dev
```

### Start the app

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

### Run tests

```bash
npm test
```

## 4. Environment variables

| Name | Purpose | Required? |
| --- | --- | --- |
| `DATABASE_URL` | Postgres connection string for Prisma | Yes |
| `NEXTAUTH_URL` | Base URL for auth callbacks | Yes in local dev |
| `NEXTAUTH_SECRET` | Secret used by NextAuth | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Yes |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Yes |
| `OPENAI_API_KEY` | API key for the OpenAI call | Only for real OpenAI generation |
| `OPENAI_MODEL` | Model used by the OpenAI client | Optional |
| `MOCK_OPENAI` | Switches to generic placeholder facts instead of live OpenAI generation | Optional |

Use placeholders only; do not commit real keys.

## 5. Database migration steps

```bash
npx prisma generate
npx prisma migrate dev
```

This project uses Prisma with a Postgres database and the Prisma adapter for NextAuth.

## 6. OpenAI usage and mock mode

The real OpenAI path is implemented in `src/lib/fact-service.ts`, but I did not have OpenAI API credits available during this project, so `MOCK_OPENAI="true"` was used as a dev/test stand-in. In mock mode, the app returns generic placeholder sentences instead of a live model response.

To use the real API, set:

```bash
MOCK_OPENAI="false"
OPENAI_API_KEY="your-funded-openai-key"
```

The live OpenAI path is coded, but it was not tested against the live API in this workspace.

## 7. Architecture overview

### Auth flow

The app uses NextAuth with the Google provider and the Prisma adapter. Users, accounts, sessions, and verification tokens are stored in Postgres. Server pages check the session before rendering user-specific content.

### Data model

The schema has a `User` model and a `MovieFact` model. The `MovieFact` table stores the fact text, movie title, user relation, and timestamp. The `factGenerationInProgress` flag on `User` is used as a per-user lock during generation.

### Request flow for fact generation

The fact-generation flow is:

1. check for a recent fact for the same user and movie,
2. return it if it is still within 60 seconds,
3. try to acquire a per-user lock,
4. re-check cache after acquiring the lock,
5. generate a new fact,
6. store it in `MovieFact`,
7. fall back to the most recent cached fact if the generation step fails.

## 8. Security and correctness notes

- Favorite movie input is validated on the server before it is stored.
- Fact reads are limited to the authenticated user via an ownership check.
- Secrets stay in environment variables and are not hard-coded in the app.
- Missing Google names or profile photos are handled with UI fallbacks instead of crashing the page.

## 9. Key tradeoffs

- The generation lock is a boolean flag on the `User` row, so it is simple but can remain stuck after a crash unless the app resets it correctly.
- The lock is per user, not per movie; that is enough for this app because it only generates one favorite movie fact per user at a time.
- Mock facts are generic placeholder sentences and are intentionally not real model output.
- The real OpenAI branch is implemented but not live-tested in this workspace because no funded API credits were available.

## 10. What I would improve with 2 more hours

- add a clearer error state for failed OpenAI generation and retries,
- add a small admin/debug view for recent facts and cache hits,
- improve the onboarding UX for editing a saved movie,
- add more robust handling for stuck generation locks after an interrupted request.

## 11. AI usage note

AI assistance was used for:

- project scaffolding,
- debugging the Prisma and NextAuth setup,
- reviewing the backend correctness and concurrency logic for the cache and generation lock.

I reviewed the generated code and can explain the implementation and tradeoffs.

## Notes

- This project is a local take-home app and does not include production deployment configuration.
- The app has a working Vitest test suite in the workspace.
- The code is intentionally small and centered on correctness for cached fact generation and user authorization.

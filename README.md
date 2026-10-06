# FIX it — Service Marketplace MVP

FIX it is a three-sided service platform connecting vetted service providers with clients while keeping provider workspaces isolated and all job activity auditable.

## Product model

- **Public client UI:** no client login required. Clients browse verified providers, submit service requests, receive a tracking code + private client access key, track job progress, add complaints/comments, upload payment receipts, and leave ratings after completion.
- **Provider UI:** registration + login, KYC gate, isolated dashboard, ranked open calls, assigned/pending/closed calls, qualifications/SOP/profile management, progress audit trail, transaction logging, dispute response, and completion flow.
- **Super-admin UI:** secure login, platform statistics, provider vetting, provider drill-down, complete interaction/audit history, dispute intervention, and provider/request oversight.

## Assignment algorithm

Requests enter the `OPEN` pool. The backend ranks **verified, eligible, currently unengaged providers** using average review score, then review count, then completed jobs. A provider can only pull a call when the backend determines that provider is currently ranked first. Providers cannot assign jobs to themselves arbitrarily, assign jobs to another provider, or access another provider's dashboard.

## Privacy rules implemented in this MVP

- Public feed never exposes client contact data.
- Only verified providers can access open calls and assigned client data.
- Provider API scope is derived from the authenticated token; provider IDs from the browser are never trusted for authorization.
- KYC status controls provider job access.
- Clients never enter card/bank details. The request flow accepts a payment reference and uploaded receipt instead.
- KYC/receipt files are not served publicly; admin/provider-specific authenticated download routes are used.

## Stack

- Frontend: React 19, Vite 8, TypeScript 5.9.3, React Router 7, Bootstrap 5
- Backend: Node 22, Express 5, TypeScript, JWT, bcryptjs, Multer
- Database: PostgreSQL + Prisma 7 + `@prisma/adapter-pg`

## Run locally

### 1. Database

Create a PostgreSQL database, then copy `backend/.env.example` to `backend/.env` and set `DATABASE_URL`.

### 2. Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run seed
npm run dev
```

Backend defaults to `http://localhost:5000`.

### 3. Frontend

In a second terminal:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend defaults to `http://localhost:5173`.

### 4. Super admin

The seed uses the credentials in `backend/.env`:

- `SUPER_ADMIN_EMAIL`
- `SUPER_ADMIN_PASSWORD`

Change the password before deployment.

## Deployment notes

The project is separated into `frontend` and `backend` so it can be deployed as independent services. For production, configure a managed PostgreSQL database and persistent/object storage for uploaded KYC and receipt files. The MVP intentionally keeps payment processing outside the app: only payment references and receipts are recorded.

## Build generator

The repository was created by `build_fixit.py`. Running the Python script again deletes and recreates the generated `FIX-It-MVP` project folder and `FIX-It-MVP.zip` beside the script.

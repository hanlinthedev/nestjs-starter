# NestJS API Starter

A self-contained starter extracted from the Talent Nexus API. Uses NestJS 12,
TypeScript, ESM, SWC, Prisma 8 and PostgreSQL. It has no dependency on Talent Nexus
contracts, ingestion, OAuth providers, or application-specific roles.

## Start locally

Requires Node.js >=24.15, npm >=11, and Docker Compose (or PostgreSQL 15+).

```sh
cp .env.example .env
npm ci
npm run db:up
npm run db:migrate
npm run db:verify
npm run start:dev
```

API: `http://localhost:8001/api/v1`  
Swagger UI: `http://localhost:8001/api`  
OpenAPI JSON: `http://localhost:8001/api-json`

The default API port 8001 and local Postgres port 5433 avoid the usual API and
Postgres defaults. Edit `.env` and `compose.yaml` to change them. If using an
existing PostgreSQL server, set `DATABASE_URL` to a new, empty database and skip
`db:up`. The included migration creates the user table and email unique index.
No database changes run during application startup. `db:down` keeps the Docker
volume so local data survives restarts.

## Included

- Passport local authentication with normalized email and bcrypt cost 12.
- Registration, login, and current-user endpoints; HS256 access JWTs.
- Global JWT guard: routes require authentication unless decorated `@Public()`.
- Zod request and environment validation; Swagger input schemas come from Zod.
- Prisma 8 contract, generated artifacts, reviewed initial migration, injectable
  database service, connection timeouts, and shutdown cleanup.
- Process liveness and database/schema readiness probes.
- Structured JSON logs in test/staging/production; readable development logs.
  Logs include UTC timestamps, request IDs, route templates, status and latency.
  Request bodies, query strings, tokens and database connection details are omitted.
- Consistent success/error envelopes, security headers, explicit CORS origins,
  authentication throttling, and graceful shutdown.
- Multi-stage non-root Dockerfile, local PostgreSQL Compose setup, lockfile,
  linting, unit tests, and HTTP integration tests.

## Routes

| Method | Route | Access | Behavior |
| --- | --- | --- | --- |
| POST | `/api/v1/auth/register` | Public | Create user and return access token; 201 |
| POST | `/api/v1/auth/login` | Public | Authenticate with Passport local; 200 |
| GET | `/api/v1/auth/me` | Bearer JWT | Return the current user |
| GET | `/api/v1/health/live` | Public | Process liveness; 200 |
| GET | `/api/v1/health/ready` | Public | Query application schema; 200 or 503 |

Registration body:

```json
{
  "email": "alice@example.com",
  "password": "a-long-unique-password",
  "name": "Alice"
}
```

Login takes the same email and password, without `name`. Passwords require at
least 12 characters and at most 72 UTF-8 bytes (bcrypt's limit). The local guard
validates the login body before Passport reads credentials because guards run
before controller pipes.

Authentication responses contain:

```json
{
  "success": true,
  "data": {
    "accessToken": "...",
    "tokenType": "Bearer",
    "user": { "id": "...", "email": "alice@example.com", "name": "Alice" }
  }
}
```

Send `Authorization: Bearer <accessToken>` to protected routes. Password hashes
are excluded from public query projections. JWT authentication rechecks that
the user still exists. Tokens expire after 15 minutes by default; this starter
has no refresh-token, logout/revocation, email-verification, password-reset, or
social-login workflow. Add those when your application needs them. An access
token remains valid until expiry unless its user is removed or the secret changes.

Errors use `{ "success": false, "message": "...", "errors": { "field": "..." } }`;
`errors` appears only for field validation failures. Readiness failures and
unexpected errors return generic messages. A valid incoming UUID in `X-Request-Id`
is reused; otherwise the server generates a new UUID and returns it in that header.

## Configuration

| Variable | Default / requirement |
| --- | --- |
| `ENVIRONMENT` | `development`; also `test`, `staging`, `production` |
| `PORT` | `8001` |
| `DATABASE_URL` | Required PostgreSQL URL |
| `JWT_SECRET` | Required, at least 32 characters; generate separately per deployment |
| `JWT_TTL_SECONDS` | `900`, allowed range 60–86400 |
| `CORS_ORIGIN` | `http://localhost:3000`; comma-separated exact HTTP(S) origins, no trailing slash |
| `LOG_LEVEL` | `log`; `fatal`, `error`, `warn`, `log`, `debug`, `verbose` |

Generate a deployment secret with `openssl rand -hex 32`. `.env.example` contains
local development credentials only; `.env` files are ignored. Swagger is disabled
when `ENVIRONMENT=production`. CORS uses the explicit origin list in every environment.

The global throttle is 100 requests/minute/IP; registration and login each allow
5 requests/minute/IP. Health probes are exempt. Storage is in memory per process.
For multiple instances, configure shared throttle storage. Configure Express
`trust proxy` for your exact proxy topology before deploying behind a proxy;
the starter does not trust arbitrary forwarded IP headers.

## Structure

```text
src/
  @decorators/       Public and CurrentUser
  auth/             Controller, service, local/JWT strategies and guards
  common/           Response envelopes, filters, validation, logging and Swagger
  config/           Environment schema
  health/           Liveness and database readiness
  prisma/           Contract, generated artifacts, database module/service
  users/            Database repository
  contracts.ts      Local Zod DTOs and API types
  setup-app.ts      Shared HTTP configuration used by runtime and tests
  main.ts           Bootstrap and logger setup
migrations/         Initial migration and contract snapshots
```

## Commands and verification

```sh
npm run start:dev
npm run build           # emit contract, typecheck, compile with SWC
npm run start:prod      # run the compiled application
npm run lint
npm run lint:fix
npm test
npm run test:cov
npm run test:e2e        # builds first to preserve Nest decorator metadata
npm run check          # lint, unit tests, build, HTTP integration tests
```

HTTP integration tests replace the database service and user repository with
in-memory fakes. They exercise the real Nest HTTP pipeline, Passport strategies,
bcrypt, JWTs, validation, error envelopes, health behavior, Swagger, and throttling.
They bind temporary local ports. They do not verify live PostgreSQL behavior;
run `db:verify` and a register/login request against your local database as a smoke test.

## Database changes

Edit `src/prisma/contract.prisma`, then:

```sh
npm run contract:emit
npm run db:plan -- --name add_feature
# Review the generated migration before applying it.
npm run db:migrate
npm run db:verify
```

The included initial migration was planned from `@empty`. For later migrations,
keep the Prisma `db` ref established by your migration workflow so planning chains
from the intended contract. Do not use `--from @empty` for every change. Commit
migration packages, snapshots, and regenerated contract artifacts. Use the
reviewed migration workflow for shared environments.

## Container deployment

```sh
docker build -t api-starter .
docker run --rm --env-file .env -e ENVIRONMENT=production -p 8001:8001 api-starter
```

Set `DATABASE_URL` to a database reachable from the container; `localhost` inside
the container is not the host. Set the deployment CORS origin and a unique JWT
secret. Run `npm run db:migrate` from the build/release environment as a separate
step before routing traffic. The runtime image omits the Prisma CLI and source
migration files. Set probes to `/api/v1/health/live` and `/api/v1/health/ready`.
Terminate TLS at your ingress and route traffic only to ready instances.

## Reuse for another service

Copy this directory, rename `package.json` and the Swagger title in
`src/setup-app.ts`, update ports/database credentials, and generate a new JWT
secret. Run `npm install --package-lock-only` after changing the package name.
Add modules and contract models for your application. Keep new routes protected
by default, and add `@Public()` only where unauthenticated access is intended.

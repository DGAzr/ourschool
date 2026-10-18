<!--
OurSchool - Homeschool Management System
Copyright (C) 2025 Dustan Ashley

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
-->

# OpenID Connect single sign-on

OIDC is optional and off by default. Existing password login, accounts, browser
sessions and JSON backups continue to work. A database migration adds the
provider issuer and subject to users; no extra dependencies are required.
Provider tokens are never stored; OurSchool returns its usual
browser-session token in the callback response body.

## Pocket ID example

1. In Pocket ID, open **Administration → OIDC Clients** and add an OurSchool
   client. Register exactly `https://school.example.com/auth/oidc/callback` as
   its callback URL, replacing the origin with your OurSchool address.
2. A public client with PKCE works: leave `OIDC_CLIENT_SECRET` empty. Enable
   PKCE on the provider. Alternatively, use a confidential client and set its
   secret on the backend. OurSchool always uses PKCE S256.
3. Set the following in `.env` (the bundled Compose files forward these settings
   to the backend), then recreate the backend container:

   ```dotenv
   OIDC_ENABLED=true
   OIDC_ISSUER_URL=https://id.example.com
   OIDC_CLIENT_ID=your-client-id
   OIDC_REDIRECT_URI=https://school.example.com/auth/oidc/callback
   ```

4. Create an OurSchool account whose email matches the provider's verified
   email, then test **Sign in with SSO**. By default unknown users cannot sign in.
   Restrict access to this client in your provider as appropriate.

See [Pocket ID's client setup guide](https://pocket-id.org/docs/setup/connect-an-app).
Only the provider administrator should be able to change identity claims.

## Settings

| Environment variable | Default | Meaning |
| --- | --- | --- |
| `OIDC_ENABLED` | `false` | Enable the OIDC endpoints and login button. |
| `OIDC_ISSUER_URL` | empty | Exact discovery issuer, including any trailing slash. Discovery is fetched at `{issuer without trailing slash}/.well-known/openid-configuration`; the returned issuer must match exactly. |
| `OIDC_CLIENT_ID` | empty | Registered provider client ID. |
| `OIDC_CLIENT_SECRET` | empty | Optional secret; uses advertised `client_secret_post`, otherwise `client_secret_basic`. Empty means public client with PKCE only. |
| `OIDC_REDIRECT_URI` | empty | Required when enabled. Register this exact frontend callback URL with the provider. |
| `OIDC_SCOPES` | `openid email profile` | Space-separated scopes; must include `openid`. |
| `OIDC_BUTTON_LABEL` | `Sign in with SSO` | Login button text. |
| `OIDC_USER_MATCH_CLAIM` | `email` | `email` matches User.email; `preferred_username` matches User.username, case-insensitively. Ambiguous matches are rejected. |
| `OIDC_ALLOW_UNVERIFIED_EMAIL` | `false` | Email matching and all provisioning require boolean `email_verified=true` unless explicitly allowed here. |
| `OIDC_AUTO_PROVISION` | `false` | Create an active account when no existing account matches. Requires email and username claims (username falls back to the email local part); uniqueness collisions fail. |
| `OIDC_ALLOW_ADMIN_LINKING` | `false` | Allow first-time claim matching to an existing administrator. Already-linked administrators can log in with this off. |
| `OIDC_DISABLE_LOCAL_LOGIN` | `false` | Hide and reject password login only when OIDC is enabled. |

Missing issuer/client ID/redirect URI or invalid match claim or scopes gives a clear
503 from start/callback when enabled. Discovery/network failures give a generic
503 at start; failed callbacks give a generic sign-in error. Server logs record
failure categories without credentials. Existing inactive users cannot sign in;
successful SSO login clears `must_change_password` for the linked account. This
avoids trapping users who do not know a local password and uses the existing
session/password-change flow without a separate session exception.

Auto-provisioned accounts receive a random, unknown password and no password-change
requirement. Provisioned accounts are always students. Provisioning does not
attach a parent.
School data for these accounts remains included in the existing JSON backup.
On first login, OurSchool matches the configured claim and saves the provider's
exact issuer and stable subject (`sub`). Later logins resolve that identity first,
even if the provider email or username changes. An account already bound to a
different identity cannot be relinked through claim matching. These identity
fields round-trip through JSON backup and restore.

**Security warning:** if provider users can set or change their email or username
(Pocket ID allows profile editing by default), a provider user could claim a
matching OurSchool account on its first link. `OIDC_ALLOW_UNVERIFIED_EMAIL=true`
also permits unverified email claims and increases this risk. Disable self-editing
of identity claims at the provider and restrict access to the OIDC client.
Subject binding protects subsequent logins, but cannot establish trust in the
first claim match. Administrator first-link matching is refused unless
`OIDC_ALLOW_ADMIN_LINKING=true`; enable this only for a controlled initial link,
then turn it off. Already-linked administrators continue to sign in.

## Other providers

- **Authentik:** create an OAuth2/OIDC provider and application; register the exact
  callback URL and enable the authorization code flow. Use its discovery document's
  exact issuer (often `https://auth.example.com/application/o/ourschool/`). Include
  email/profile mappings and verified email when matching by email. See the
  [Authentik provider guide](https://docs.goauthentik.io/add-secure-apps/providers/oauth2).
- **Keycloak:** create an OpenID Connect client in your realm, enable Standard Flow
  and PKCE S256, and register the callback as a valid redirect URI. Use the realm
  issuer, such as `https://id.example.com/realms/school`. Configure email verification
  or use trusted `preferred_username` matching. Client authentication may be off
  for public clients or on with the backend secret.
- **Authelia:** register an OpenID Connect client with the same redirect URI,
  authorization code flow, PKCE S256, and `openid email profile` scopes. Use the
  exact issuer from its discovery document.

## Deployment and recovery

Use HTTPS in production. HTTP endpoints are accepted only on localhost/127.0.0.1
for development. Keep the frontend and `/api` on the same site: the signed,
HttpOnly, SameSite=Lax transaction cookie lasts ten minutes and is Secure when
the callback uses HTTPS. Starting another login replaces the pending transaction.
Discovery/JWKS are cached for five minutes; unknown signing key IDs trigger a
refresh. Provider response bodies are limited to 1 MiB, ID tokens to 16 KiB,
and provisioned username, email and names to 255 characters. Supported ID-token
signatures are RSA and EC SHA-2 algorithms.

The supplied nginx configuration proxies `/api/` and serves the SPA fallback for
`/auth/oidc/callback`. Vite's `/api` development proxy also works; set
`OIDC_REDIRECT_URI` to your actual Vite origin. No application access token is
placed in a URL. Sign-out ends the OurSchool session, not the provider session.

**Break glass:** before disabling password login, test OIDC and keep a local
administrator password. If the provider becomes unavailable, set
`OIDC_DISABLE_LOCAL_LOGIN=false` and recreate/restart the backend. Setting
`OIDC_ENABLED=false` also restores password login. The callback does not use the
password failure limiter: invalid transactions
cannot lock out other SSO users. The provider handles authentication throttling;
a reverse-proxy request limiter can bound callback traffic. Provider errors do
not expose whether a local account exists.

**Changing the issuer:** linked accounts are bound to the exact
`OIDC_ISSUER_URL` plus the provider's subject (`sub`). Changing the issuer —
even adding or removing a trailing slash — or moving to a new provider means no
stored link matches, and previously linked accounts are refused as "already
linked to another identity". To migrate, clear the `oidc_issuer` and
`oidc_subject` columns for the affected users (for example with `psql`) so they
re-link on their next login. JSON backups include these links; restoring a
backup made before this feature leaves existing links unchanged, and a link
that another local user already holds is skipped with a warning.

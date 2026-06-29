# QuickAuth

A very small Next.js app that runs the QuickBooks Online OAuth 2.0 flow and
shows a sample Customer query after sign-in.

## Setup

Create a local `.env` file with the QuickBooks app credentials from Intuit:

```bash
QUICKBOOKS_CLIENT_ID=your_client_id
QUICKBOOKS_CLIENT_SECRET=your_client_secret
QUICKBOOKS_REDIRECT_URI=http://localhost:3000/auth/quickbooks
QUICKBOOKS_ENVIRONMENT=sandbox
QUICKBOOKS_MINOR_VERSION=75
QUICKAUTH_SESSION_SECRET=generate_a_long_random_value_for_deployments
```

In the Intuit Developer Portal, the redirect URI must exactly match
`QUICKBOOKS_REDIRECT_URI`.

## Development

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), then choose
"Sign in with QuickBooks".

## MCP Setup Prompt

After sign-in, the signed-in page can copy a setup prompt for Claude Code or
Codex. The prompt includes:

- Cross-platform instructions for installing and building the cloned
  QuickBooks Online MCP server.
- User-wide/global registration steps for Claude Code and Codex.
- The QuickBooks realm ID, access token, refresh token, token expiry times,
  client ID, client secret, and environment needed by the local MCP server.

The local MCP server needs the same QuickBooks OAuth client ID and client secret
that issued the refresh token. If you do not want to expose a QuickBooks app
client secret to customers, use a hosted refresh service/proxy model instead of
local refresh.

## Vercel

Before deploying, add the same environment variables in the Vercel project
settings for Production and Preview. For production, set
`QUICKBOOKS_REDIRECT_URI` to your deployed callback URL, for example:

```bash
https://your-project.vercel.app/auth/quickbooks
```

That exact URL must also be added to the Intuit Developer Portal redirect URI
list.

For Intuit app details, use these URLs:

| Field | URL |
| --- | --- |
| Host domain | `your-project.vercel.app` |
| Launch URL | `https://your-project.vercel.app/` |
| Connect/Reconnect URL | `https://your-project.vercel.app/auth/quickbooks/install` |
| Disconnect URL | `https://your-project.vercel.app/auth/disconnect` |
| End User License Agreement URL | `https://your-project.vercel.app/eula` |
| Privacy Policy URL | `https://your-project.vercel.app/privacy` |

`/auth/quickbooks/install` starts a fresh authorization flow for QuickBooks
App Store install/reconnect flows. It forces the Intuit login/company picker and
then returns through the normal `/auth/quickbooks` OAuth callback.

You can deploy with Vercel's Git integration or with:

```bash
vercel
vercel --prod
```

## Notes

- The app requests the `com.intuit.quickbooks.accounting` scope.
- The OAuth callback is handled by `/auth/quickbooks`.
- QuickBooks App Store install/reconnect flows should start at
  `/auth/quickbooks/install`.
- Tokens are stored in an encrypted, HTTP-only cookie so the session can survive
  Vercel serverless function invocations without a database.
- QuickAuth keeps a remembered encrypted token cookie after local sign-out so a
  same-browser sign-in can reuse the existing QuickBooks connection. Use
  "Disconnect QuickBooks" to revoke access and delete the remembered token.
- `QUICKAUTH_SESSION_SECRET` is recommended for cookie encryption. If omitted,
  the app falls back to `QUICKBOOKS_CLIENT_SECRET`.
- The signed-in page runs:
  `SELECT * FROM Customer ORDERBY MetaData.LastUpdatedTime DESC STARTPOSITION 1 MAXRESULTS 20`.

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

## Vercel

Before deploying, add the same environment variables in the Vercel project
settings for Production and Preview. For production, set
`QUICKBOOKS_REDIRECT_URI` to your deployed callback URL, for example:

```bash
https://your-project.vercel.app/auth/quickbooks
```

That exact URL must also be added to the Intuit Developer Portal redirect URI
list.

You can deploy with Vercel's Git integration or with:

```bash
vercel
vercel --prod
```

## Notes

- The app requests the `com.intuit.quickbooks.accounting` scope.
- The OAuth callback is handled by `/auth/quickbooks`.
- Tokens are stored in an encrypted, HTTP-only cookie so the session can survive
  Vercel serverless function invocations without a database.
- `QUICKAUTH_SESSION_SECRET` is recommended for cookie encryption. If omitted,
  the app falls back to `QUICKBOOKS_CLIENT_SECRET`.
- The signed-in page runs:
  `SELECT * FROM Customer ORDERBY MetaData.LastUpdatedTime DESC STARTPOSITION 1 MAXRESULTS 20`.

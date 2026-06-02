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
```

In the Intuit Developer Portal, the redirect URI must exactly match
`QUICKBOOKS_REDIRECT_URI`.

## Development

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), then choose
"Sign in with QuickBooks".

## Notes

- The app requests the `com.intuit.quickbooks.accounting` scope.
- The OAuth callback is handled by `/auth/quickbooks`.
- Tokens are stored in a server-side in-memory session for simplicity. Use a
  durable encrypted store before deploying this beyond a local demo.
- The signed-in page runs:
  `SELECT * FROM Customer STARTPOSITION 1 MAXRESULTS 20`.

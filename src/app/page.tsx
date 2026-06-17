import Link from "next/link";
import { cookies } from "next/headers";
import { CopyMcpPromptButton } from "./copy-mcp-prompt-button";
import {
  QUICKBOOKS_SESSION_COOKIE,
  fetchCompanyName,
  getQuickBooksEnvironment,
  getQuickBooksSession,
  isQuickBooksAccessTokenFresh,
} from "@/lib/quickbooks";

type HomeProps = {
  searchParams: Promise<{
    error?: string | string[];
    notice?: string | string[];
  }>;
};

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const session = getQuickBooksSession(
    cookieStore.get(QUICKBOOKS_SESSION_COOKIE)?.value,
  );
  const message = getPageMessage(params);
  const companyResult =
    session && isQuickBooksAccessTokenFresh(session)
      ? await getCompanyForPage(session)
      : null;

  return (
    <main className="min-h-screen bg-[#f6f7f2] text-[#151713]">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-6 sm:px-8">
        <header className="flex flex-col gap-4 border-b border-[#d9ddce] pb-4 sm:flex-row sm:items-start sm:justify-between">
          <Link href="/" className="flex items-center gap-3 font-semibold">
            <span className="grid size-9 place-items-center rounded bg-[#2ca01c] text-sm font-bold text-white">
              qa
            </span>
            <span>QuickAuth</span>
          </Link>
          {session ? (
            <div className="flex flex-wrap items-start gap-3 sm:justify-end">
              <a
                href="/auth/signout"
                className="rounded border border-[#b9c0ae] px-4 py-2 text-sm font-medium transition hover:border-[#2ca01c] hover:text-[#1d7f14]"
              >
                Disconnect and sign out
              </a>
            </div>
          ) : null}
        </header>

        {message ? (
          <div
            className={`mt-5 rounded border px-4 py-3 text-sm ${
              message.kind === "error"
                ? "border-[#d4483b] bg-[#fff4f2] text-[#84241d]"
                : "border-[#8dbb84] bg-[#f0faee] text-[#215d1a]"
            }`}
          >
            {message.text}
          </div>
        ) : null}

        {session ? (
          <SignedInView
            companyName={companyResult?.companyName}
            error={companyResult?.error}
            realmId={session.realmId}
          />
        ) : (
          <SignedOutView />
        )}
      </div>
    </main>
  );
}

function SignedOutView() {
  return (
    <section className="flex flex-1 flex-col justify-center py-16">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2ca01c]">
          QuickBooks Online OAuth
        </p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">
          Connect a QuickBooks company and copy your setup prompt.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-[#596151]">
          Sign in with QuickBooks Online to authorize this app. After the OAuth
          flow completes, you can copy the prompt that registers your
          QuickBooks connection with Claude Code or Codex.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a
            href="/auth/quickbooks"
            className="rounded bg-[#2ca01c] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#238719]"
          >
            Sign in with QuickBooks
          </a>
          <Link
            href="/eula"
            className="rounded border border-[#c7cebd] px-4 py-3 text-sm font-medium transition hover:border-[#2ca01c]"
          >
            EULA
          </Link>
          <Link
            href="/privacy"
            className="rounded border border-[#c7cebd] px-4 py-3 text-sm font-medium transition hover:border-[#2ca01c]"
          >
            Privacy
          </Link>
        </div>
      </div>
    </section>
  );
}

function SignedInView({
  companyName,
  error,
  realmId,
}: {
  companyName?: string;
  error?: string;
  realmId: string;
}) {
  return (
    <section className="flex flex-1 flex-col justify-center py-16">
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-[#596151]">
          {getQuickBooksEnvironment()} company
        </p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">
          You are signed in
          {companyName ? ` to ${companyName}` : " to QuickBooks"}.
        </h1>
        <p className="mt-4 text-base leading-7 text-[#596151]">
          Copy the setup prompt, paste it into Claude Code or Codex in the MCP
          server project, and let it register your QuickBooks connection.
        </p>
        <p className="mt-3 font-mono text-xs text-[#596151]">
          Realm {realmId}
        </p>

        {error ? (
          <div className="mt-6 rounded border border-[#d4483b] bg-[#fff4f2] px-4 py-3 text-sm text-[#84241d]">
            {error}
          </div>
        ) : null}

        <div className="mt-8 flex flex-col items-start gap-4 rounded border border-[#d9ddce] bg-white px-5 py-5">
          <CopyMcpPromptButton align="start" />
          <ol className="space-y-2 text-sm leading-6 text-[#596151]">
            <li>1. Copy the setup prompt.</li>
            <li>2. Paste it into a new assistant chat.</li>
            <li>3. Start a fresh chat after the MCP server is registered.</li>
          </ol>
        </div>
      </div>
    </section>
  );
}

async function getCompanyForPage(
  session: NonNullable<ReturnType<typeof getQuickBooksSession>>,
) {
  try {
    return {
      companyName: await fetchCompanyName(session),
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to load company details from QuickBooks.",
    };
  }
}

function getPageMessage({
  error,
  notice,
}: {
  error?: string | string[];
  notice?: string | string[];
}) {
  const errorCode = Array.isArray(error) ? error[0] : error;
  const noticeCode = Array.isArray(notice) ? notice[0] : notice;

  if (noticeCode === "connected") {
    return {
      kind: "notice" as const,
      text: "Connected to QuickBooks Online.",
    };
  }

  if (noticeCode === "signed_out") {
    return {
      kind: "notice" as const,
      text: "Signed out of QuickAuth. QuickBooks was asked to end its browser session.",
    };
  }

  if (!errorCode) {
    return null;
  }

  const errors: Record<string, string> = {
    quickbooks_access_denied: "QuickBooks authorization was cancelled.",
    quickbooks_config:
      "QuickBooks credentials are not configured. Add QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET to your environment.",
    quickbooks_realm:
      "QuickBooks did not return a company ID. Please try signing in again.",
    quickbooks_start_failed:
      "Unable to start QuickBooks authorization. Check the app configuration.",
    quickbooks_state:
      "The QuickBooks sign-in attempt expired or failed validation. Please try again.",
    quickbooks_token:
      "QuickBooks authorized the app, but the token exchange failed. Check the redirect URI and app credentials.",
  };

  return {
    kind: "error" as const,
    text: errors[errorCode] ?? "QuickBooks sign-in failed. Please try again.",
  };
}

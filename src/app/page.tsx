import Link from "next/link";
import { cookies } from "next/headers";
import {
  QUICKBOOKS_SESSION_COOKIE,
  CustomerSummary,
  fetchCustomerSummaries,
  getQuickBooksEnvironment,
  getQuickBooksSession,
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
  const customersResult = session ? await getCustomersForPage(session) : null;

  return (
    <main className="min-h-screen bg-[#f6f7f2] text-[#151713]">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-6 sm:px-8">
        <header className="flex items-center justify-between border-b border-[#d9ddce] pb-4">
          <Link href="/" className="flex items-center gap-3 font-semibold">
            <span className="grid size-9 place-items-center rounded bg-[#2ca01c] text-sm font-bold text-white">
              qa
            </span>
            <span>QuickAuth</span>
          </Link>
          {session ? (
            <a
              href="/auth/signout"
              className="rounded border border-[#b9c0ae] px-4 py-2 text-sm font-medium transition hover:border-[#2ca01c] hover:text-[#1d7f14]"
            >
              Sign out
            </a>
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
            customers={customersResult?.customers ?? []}
            error={customersResult?.error}
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
          Connect a QuickBooks company and preview customers.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-[#596151]">
          Sign in with QuickBooks Online to authorize this app. After the OAuth
          flow completes, the app runs one sample Customer query and displays a
          compact list of basic customer details.
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
  customers,
  error,
  realmId,
}: {
  customers: CustomerSummary[];
  error?: string;
  realmId: string;
}) {
  return (
    <section className="py-8">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[#596151]">
            {getQuickBooksEnvironment()} company
          </p>
          <h1 className="mt-1 text-3xl font-semibold">Client list</h1>
        </div>
        <p className="font-mono text-xs text-[#596151]">Realm {realmId}</p>
      </div>

      {error ? (
        <div className="rounded border border-[#d4483b] bg-[#fff4f2] px-4 py-3 text-sm text-[#84241d]">
          {error}
        </div>
      ) : (
        <CustomerTable customers={customers} />
      )}
    </section>
  );
}

function CustomerTable({ customers }: { customers: CustomerSummary[] }) {
  if (customers.length === 0) {
    return (
      <div className="rounded border border-[#d9ddce] bg-white px-5 py-8 text-sm text-[#596151]">
        The Customer query succeeded, but this company did not return any
        clients.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded border border-[#d9ddce] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-left text-sm">
          <thead className="bg-[#eef1e7] text-xs uppercase tracking-[0.08em] text-[#596151]">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Modified</th>
              <th className="px-4 py-3 font-semibold">Company</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Phone</th>
              <th className="px-4 py-3 text-right font-semibold">Balance</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Rename</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr
                key={customer.id}
                className="border-t border-[#e4e7dc] align-top"
              >
                <td className="px-4 py-3 font-medium">
                  {customer.displayName}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[#596151]">
                  {formatDateTime(customer.lastUpdatedTime)}
                </td>
                <td className="px-4 py-3 text-[#596151]">
                  {customer.companyName || "-"}
                </td>
                <td className="px-4 py-3 text-[#596151]">
                  {customer.email || "-"}
                </td>
                <td className="px-4 py-3 text-[#596151]">
                  {customer.phone || "-"}
                </td>
                <td className="px-4 py-3 text-right font-mono text-[#596151]">
                  {formatBalance(customer.balance)}
                </td>
                <td className="px-4 py-3 text-[#596151]">
                  {customer.active === null
                    ? "Unknown"
                    : customer.active
                      ? "Active"
                      : "Inactive"}
                </td>
                <td className="px-4 py-3">
                  <form
                    action="/customers/rename"
                    method="post"
                    className="flex min-w-[260px] items-center gap-2"
                  >
                    <input
                      type="hidden"
                      name="customerId"
                      value={customer.id}
                    />
                    <input
                      type="hidden"
                      name="syncToken"
                      value={customer.syncToken}
                    />
                    <label
                      className="sr-only"
                      htmlFor={`rename-${customer.id}`}
                    >
                      Rename {customer.displayName}
                    </label>
                    <input
                      id={`rename-${customer.id}`}
                      name="displayName"
                      defaultValue={customer.displayName}
                      maxLength={500}
                      required
                      className="h-9 w-40 rounded border border-[#c7cebd] bg-white px-3 text-sm outline-none transition focus:border-[#2ca01c] focus:ring-2 focus:ring-[#2ca01c]/20"
                    />
                    <button
                      type="submit"
                      className="h-9 rounded bg-[#2ca01c] px-3 text-sm font-semibold text-white transition hover:bg-[#238719] disabled:cursor-not-allowed disabled:bg-[#9ebc97]"
                      disabled={!customer.syncToken}
                    >
                      Rename
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function getCustomersForPage(
  session: NonNullable<ReturnType<typeof getQuickBooksSession>>,
) {
  try {
    return {
      customers: await fetchCustomerSummaries(session),
    };
  } catch (error) {
    return {
      customers: [],
      error:
        error instanceof Error
          ? error.message
          : "Unable to load customers from QuickBooks.",
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
      text: "Signed out.",
    };
  }

  if (noticeCode === "renamed") {
    return {
      kind: "notice" as const,
      text: "Client renamed in QuickBooks Online.",
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
    rename_auth: "Sign in with QuickBooks before renaming clients.",
    rename_failed:
      "QuickBooks could not rename that client. The name may already exist, or the row may need to be refreshed.",
    rename_invalid: "Enter a client name before renaming.",
  };

  return {
    kind: "error" as const,
    text: errors[errorCode] ?? "QuickBooks sign-in failed. Please try again.",
  };
}

function formatBalance(balance: number | null) {
  if (balance === null) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(balance);
}

function formatDateTime(value: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

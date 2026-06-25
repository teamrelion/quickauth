import Link from "next/link";

export const metadata = {
  title: "End-User License Agreement | QuickAuth",
};

export default function EulaPage() {
  return (
    <main className="min-h-screen bg-[#f6f7f2] px-5 py-8 text-[#151713] sm:px-8">
      <article className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-medium text-[#1d7f14]">
          Back to QuickAuth
        </Link>
        <h1 className="mt-8 text-3xl font-semibold">
          End-User License Agreement
        </h1>
        <p className="mt-3 text-sm text-[#596151]">
          Last updated: June 17, 2026
        </p>

        <div className="mt-8 space-y-6 leading-7 text-[#30352c]">
          <section>
            <h2 className="text-lg font-semibold text-[#151713]">
              License
            </h2>
            <p className="mt-2">
              QuickAuth grants you a limited, revocable, non-exclusive license
              to use this app to connect to QuickBooks Online and view a sample
              customer list for your authorized company.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#151713]">
              Acceptable Use
            </h2>
            <p className="mt-2">
              You may not misuse the app, attempt to access another user&apos;s
              QuickBooks data, reverse engineer the app, or use it in a way that
              violates Intuit&apos;s platform terms or applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#151713]">
              No Warranty
            </h2>
            <p className="mt-2">
              The app is provided &quot;as is&quot; without warranties of any
              kind. You are responsible for reviewing any data returned from
              QuickBooks Online before relying on it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#151713]">
              Termination
            </h2>
            <p className="mt-2">
              Your right to use the app ends when you disconnect QuickBooks,
              revoke access in QuickBooks, or stop using the app. We may also
              discontinue or modify the app at any time.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}

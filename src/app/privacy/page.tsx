import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | QuickAuth",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f6f7f2] px-5 py-8 text-[#151713] sm:px-8">
      <article className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-medium text-[#1d7f14]">
          Back to QuickAuth
        </Link>
        <h1 className="mt-8 text-3xl font-semibold">Privacy Policy</h1>
        <p className="mt-3 text-sm text-[#596151]">
          Last updated: June 1, 2026
        </p>

        <div className="mt-8 space-y-6 leading-7 text-[#30352c]">
          <section>
            <h2 className="text-lg font-semibold text-[#151713]">
              Information We Access
            </h2>
            <p className="mt-2">
              When you authorize the app through QuickBooks Online, the app
              receives OAuth tokens and the company ID needed to query your
              authorized QuickBooks company. The sample screen requests basic
              Customer records such as display name, company name, email, phone,
              balance, and active status.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#151713]">
              How We Use Information
            </h2>
            <p className="mt-2">
              The app uses the QuickBooks access token only to run the sample
              Customer query and render the results in your browser. It does not
              sell customer data or use it for advertising.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#151713]">
              Storage
            </h2>
            <p className="mt-2">
              This demo stores OAuth tokens in an encrypted, HTTP-only cookie in
              your browser so the app can work across serverless requests.
              Signing out clears the local session cookie.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#151713]">
              Your Choices
            </h2>
            <p className="mt-2">
              You can sign out of this app at any time. You can also revoke the
              app&apos;s access from your Intuit or QuickBooks Online account
              settings.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}

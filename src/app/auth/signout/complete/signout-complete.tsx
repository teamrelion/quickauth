"use client";

import { useEffect } from "react";

const QUICKBOOKS_LOGOUT_URL = "https://qbo.intuit.com/app/logout";
const RETURN_TO_QUICKAUTH_DELAY_MS = 1600;

export function SignOutComplete() {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.location.replace("/?notice=signed_out");
    }, RETURN_TO_QUICKAUTH_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f7f2] px-5 text-[#151713]">
      <section className="max-w-md text-center">
        <div className="mx-auto grid size-9 place-items-center rounded bg-[#2ca01c] text-sm font-bold text-white">
          qa
        </div>
        <h1 className="mt-5 text-2xl font-semibold">Signing out</h1>
        <p className="mt-3 text-sm leading-6 text-[#596151]">
          Returning to QuickAuth...
        </p>
      </section>
      <iframe
        title="QuickBooks sign out"
        src={QUICKBOOKS_LOGOUT_URL}
        className="absolute size-px opacity-0"
        referrerPolicy="no-referrer"
      />
    </main>
  );
}

"use client";

import { useState } from "react";

type CopyState = "idle" | "copying" | "copied" | "error";

type PromptResponse = {
  prompt?: string;
  error?: string;
};

export function CopyMcpPromptButton({
  align = "end",
}: {
  align?: "start" | "end";
}) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [message, setMessage] = useState("");

  async function copyPrompt() {
    setCopyState("copying");
    setMessage("");

    try {
      const response = await fetch("/auth/quickbooks/mcp-prompt", {
        cache: "no-store",
      });
      const body = (await response.json()) as PromptResponse;

      if (!response.ok || !body.prompt) {
        throw new Error(body.error ?? "Unable to copy setup prompt.");
      }

      await copyText(body.prompt);
      setCopyState("copied");
      setMessage("Setup prompt copied.");
    } catch (error) {
      setCopyState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to copy setup prompt.",
      );
    }
  }

  return (
    <div
      className={`flex flex-col gap-1 ${
        align === "start" ? "items-start" : "items-end"
      }`}
    >
      <button
        type="button"
        onClick={copyPrompt}
        disabled={copyState === "copying"}
        className="rounded bg-[#151713] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#2f332b] disabled:cursor-not-allowed disabled:bg-[#8c9285]"
      >
        {copyState === "copying" ? "Copying..." : "Copy setup prompt"}
      </button>
      <p
        aria-live="polite"
        className={`min-h-4 text-xs ${
          copyState === "error" ? "text-[#84241d]" : "text-[#596151]"
        }`}
      >
        {message}
      </p>
    </div>
  );
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.append(textarea);
  textarea.select();

  try {
    document.execCommand("copy");
  } finally {
    textarea.remove();
  }
}

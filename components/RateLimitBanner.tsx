"use client";

import { useRateLimit } from "@/src/context/RateLimitContext";

/**
 * Prominent, full-width banner shown whenever the Soroban RPC rate-limits our
 * requests. It surfaces a live retry countdown so the user understands the app
 * is waiting on the network rather than failing silently. Hidden otherwise.
 */
export default function RateLimitBanner() {
  const { active, secondsLeft } = useRateLimit();

  if (!active) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full bg-amber-900/80 border-b border-amber-700 text-amber-100 text-sm text-center py-2 px-4 flex items-center justify-center gap-2"
    >
      <span className="font-semibold">⏳ Rate limited</span>
      <span>
        The Soroban RPC is throttling requests — retrying in{" "}
        <span className="font-mono font-semibold tabular-nums">{secondsLeft}s</span>…
      </span>
    </div>
  );
}

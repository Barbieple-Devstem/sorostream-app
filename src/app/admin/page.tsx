"use client";
/**
 * /admin — Admin dashboard.
 *
 * Treasury Stats widget:
 * - Shows accumulated fee balance per supported token
 * - USD equivalent via XLM price feed (XLM tokens) or 1:1 assumption for USDC
 * - Last sweep date and amount
 * - Sweep button visible only to the admin wallet address
 * - Zero-balance tokens show "No fees collected"
 * - Sweep triggers a balance refresh
 *
 * Stream Management widget:
 * - Filter by status and token
 * - Paginated list (PAGE_SIZE rows per page)
 * - Pagination resets to page 1 on every filter change
 * - Per-page limit preserved across filter changes
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  getTreasuryBalances,
  sweepTreasuryFees,
  formatStellarAmount,
  getMockStreams,
  type TreasuryBalance,
  type StreamData,
} from "@/src/lib/sorostream";
import { useXlmPrice } from "@/src/lib/useXlmPrice";
import { useWallet } from "@/src/context/WalletContext";
import { useToast } from "@/src/lib/toast";

// ── Env-configurable admin wallet address ───────────────────────────────────
// Set NEXT_PUBLIC_ADMIN_WALLET to the admin's Stellar public key.
// If unset, the sweep button is never shown.
const ADMIN_WALLET = process.env.NEXT_PUBLIC_ADMIN_WALLET ?? "";

const STREAM_PAGE_SIZES = [10, 25, 50] as const;
type StreamPageSize = (typeof STREAM_PAGE_SIZES)[number];

function StatusBadge({ status }: { status: StreamData["status"] }) {
  const cls =
    status === "Active"
      ? "bg-green-900/50 text-green-300"
      : status === "Ended"
      ? "bg-gray-700 text-gray-300"
      : "bg-red-900/50 text-red-300";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {status}
    </span>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Compute the approximate USD value of a treasury balance.
 * - USDC is treated as 1:1 with USD.
 * - XLM uses the live price feed.
 * - Other tokens: shown as "—" when price is unavailable.
 */
function toUsd(
  token: string,
  stroops: number,
  xlmPrice: number | null,
): string | null {
  const amount = stroops / 10_000_000;
  if (token === "USDC") return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (token === "XLM" && xlmPrice !== null) {
    const usd = amount * xlmPrice;
    return `$${usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return null;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 inline-block align-middle"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

interface TreasuryRowProps {
  entry: TreasuryBalance;
  isAdmin: boolean;
  xlmPrice: number | null;
  onSweep: (token: string) => Promise<void>;
  sweeping: boolean;
}

function TreasuryRow({ entry, isAdmin, xlmPrice, onSweep, sweeping }: TreasuryRowProps) {
  const hasBalance = entry.balanceStroops > 0;
  const usdValue = hasBalance ? toUsd(entry.token, entry.balanceStroops, xlmPrice) : null;

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 flex flex-col gap-3">
      {/* Token name + balance */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Token</p>
          <p className="text-lg font-bold text-white">{entry.token}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Balance</p>
          {hasBalance ? (
            <p className="text-lg font-bold text-green-400 font-mono">
              {formatStellarAmount(entry.balanceStroops)}
            </p>
          ) : (
            <p className="text-sm text-gray-500 italic">No fees collected</p>
          )}
        </div>
      </div>

      {/* USD equivalent */}
      {hasBalance && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-400">≈</span>
          <span className="text-gray-300">
            {usdValue ?? <span className="text-gray-500 text-xs">Price unavailable</span>}
          </span>
          {entry.token === "XLM" && xlmPrice !== null && (
            <span className="text-xs text-gray-500">@ ${xlmPrice.toFixed(4)}/XLM</span>
          )}
        </div>
      )}

      {/* Last sweep info */}
      <div className="text-xs text-gray-400 space-y-0.5 border-t border-gray-700 pt-3">
        <div className="flex justify-between">
          <span>Last sweep</span>
          <span className="text-gray-300">{formatDate(entry.lastSweepAt)}</span>
        </div>
        {entry.lastSweepAmountStroops !== null && (
          <div className="flex justify-between">
            <span>Last swept amount</span>
            <span className="text-gray-300 font-mono">
              {formatStellarAmount(entry.lastSweepAmountStroops)} {entry.token}
            </span>
          </div>
        )}
      </div>

      {/* Sweep button — admin only */}
      {isAdmin && (
        <button
          onClick={() => onSweep(entry.token)}
          disabled={sweeping || !hasBalance}
          aria-busy={sweeping}
          className="mt-1 w-full py-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 disabled:opacity-40 disabled:cursor-not-allowed bg-green-700 text-white hover:bg-green-600"
          title={!hasBalance ? "No fees to sweep" : undefined}
        >
          {sweeping ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner /> Sweeping…
            </span>
          ) : (
            "Sweep Fees"
          )}
        </button>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { address } = useWallet();
  const { price: xlmPrice } = useXlmPrice();
  const { addToast } = useToast();

  const [balances, setBalances] = useState<TreasuryBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [sweepingToken, setSweepingToken] = useState<string | null>(null);

  // ── Stream management state ───────────────────────────────────────────────
  const [allStreams] = useState<StreamData[]>(() => getMockStreams());
  const [statusFilter, setStatusFilter] = useState("");
  const [tokenFilter, setTokenFilter] = useState("");
  const [streamPage, setStreamPage] = useState(1);
  const [pageSize, setPageSize] = useState<StreamPageSize>(10);

  // Unique token list for the filter dropdown
  const uniqueTokens = useMemo(
    () => Array.from(new Set(allStreams.map((s) => s.token))).sort(),
    [allStreams],
  );

  const filteredStreams = useMemo(() => {
    return allStreams.filter((s) => {
      if (statusFilter && s.status !== statusFilter) return false;
      if (tokenFilter && s.token !== tokenFilter) return false;
      return true;
    });
  }, [allStreams, statusFilter, tokenFilter]);

  const totalStreamPages = Math.max(1, Math.ceil(filteredStreams.length / pageSize));
  // Clamp currentPage so it never exceeds totalStreamPages
  const currentStreamPage = Math.min(streamPage, totalStreamPages);
  const paginatedStreams = filteredStreams.slice(
    (currentStreamPage - 1) * pageSize,
    currentStreamPage * pageSize,
  );

  // Reset to page 1 whenever a filter changes; preserve pageSize
  useEffect(() => {
    setStreamPage(1);
  }, [statusFilter, tokenFilter]);

  // An admin is the connected wallet matching the configured admin address.
  const isAdmin = Boolean(ADMIN_WALLET && address && address === ADMIN_WALLET);

  const fetchBalances = useCallback(async () => {
    try {
      const data = await getTreasuryBalances();
      setBalances(data);
    } catch {
      addToast("Failed to load treasury balances.", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void fetchBalances();
  }, [fetchBalances]);

  const handleSweep = useCallback(
    async (token: string) => {
      if (sweepingToken) return;
      setSweepingToken(token);
      try {
        const result = await sweepTreasuryFees(token);
        addToast(`Swept ${token} fees. TX: ${result.txHash}`, "success");
        // Refresh balances after a successful sweep
        await fetchBalances();
      } catch {
        addToast(`Failed to sweep ${token} fees. Please try again.`, "error");
      } finally {
        setSweepingToken(null);
      }
    },
    [sweepingToken, addToast, fetchBalances],
  );

  return (
    <main className="min-h-screen bg-gray-900 text-white p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-gray-400 text-sm mt-1">
              Protocol fee revenue and treasury management.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-green-400 hover:text-green-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
          >
            ← Dashboard
          </Link>
        </div>

        {/* Admin wallet notice */}
        {!ADMIN_WALLET && (
          <div
            role="note"
            className="mb-6 rounded-lg bg-yellow-900/30 border border-yellow-700 text-yellow-300 text-sm px-4 py-3"
          >
            <strong>NEXT_PUBLIC_ADMIN_WALLET</strong> is not configured. The
            Sweep Fees button will not appear until an admin address is set.
          </div>
        )}

        {address && ADMIN_WALLET && !isAdmin && (
          <div
            role="note"
            className="mb-6 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 text-sm px-4 py-3"
          >
            Connected as <span className="font-mono text-gray-300">{address}</span>. Sweep
            controls are only available to the admin wallet.
          </div>
        )}

        {/* Treasury stats */}
        <section aria-labelledby="treasury-heading">
          <div className="flex items-center justify-between mb-4">
            <h2 id="treasury-heading" className="text-lg font-semibold">
              Treasury Balances
            </h2>
            <button
              onClick={() => { setLoading(true); void fetchBalances(); }}
              disabled={loading}
              className="text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 rounded px-2 py-1"
              aria-label="Refresh treasury balances"
            >
              {loading ? <Spinner /> : "↻ Refresh"}
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-44 bg-gray-800 rounded-xl animate-pulse border border-gray-700" />
              ))}
            </div>
          ) : balances.length === 0 ? (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center text-gray-400 text-sm">
              No treasury data available.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {balances.map((entry) => (
                <TreasuryRow
                  key={entry.token}
                  entry={entry}
                  isAdmin={isAdmin}
                  xlmPrice={xlmPrice}
                  onSweep={handleSweep}
                  sweeping={sweepingToken === entry.token}
                />
              ))}
            </div>
          )}
        </section>

        {/* Summary totals */}
        {!loading && balances.length > 0 && (
          <div className="mt-6 bg-gray-800 rounded-xl border border-gray-700 px-5 py-4 flex flex-wrap gap-6">
            <div>
              <p className="text-xs text-gray-400 mb-1">Total tokens tracked</p>
              <p className="text-white font-semibold">{balances.length}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Tokens with pending fees</p>
              <p className="text-white font-semibold">
                {balances.filter((b) => b.balanceStroops > 0).length}
              </p>
            </div>
          </div>
        )}

        {/* Stream Management */}
        <section aria-labelledby="streams-heading" className="mt-10">
          <h2 id="streams-heading" className="text-lg font-semibold mb-4">Stream Management</h2>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-end mb-4">
            <div>
              <label htmlFor="admin-status-filter" className="block text-xs text-gray-400 mb-1">
                Status
              </label>
              <select
                id="admin-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
              >
                <option value="">All statuses</option>
                <option value="Active">Active</option>
                <option value="Ended">Ended</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label htmlFor="admin-token-filter" className="block text-xs text-gray-400 mb-1">
                Token
              </label>
              <select
                id="admin-token-filter"
                value={tokenFilter}
                onChange={(e) => setTokenFilter(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
              >
                <option value="">All tokens</option>
                {uniqueTokens.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="admin-page-size" className="block text-xs text-gray-400 mb-1">
                Per page
              </label>
              <select
                id="admin-page-size"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value) as StreamPageSize)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
              >
                {STREAM_PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            {(statusFilter || tokenFilter) && (
              <button
                onClick={() => { setStatusFilter(""); setTokenFilter(""); }}
                className="px-3 py-2 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
              >
                Clear filters
              </button>
            )}
            <p className="text-xs text-gray-500 self-end ml-auto">
              {filteredStreams.length} stream{filteredStreams.length !== 1 ? "s" : ""}
              {totalStreamPages > 1 && (
                <span className="ml-1">· page {currentStreamPage} of {totalStreamPages}</span>
              )}
            </p>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800 text-gray-400 text-left">
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Token</th>
                  <th className="px-4 py-3 font-medium">Sender</th>
                  <th className="px-4 py-3 font-medium">Recipient</th>
                  <th className="px-4 py-3 font-medium">Deposit</th>
                  <th className="px-4 py-3 font-medium sr-only">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {paginatedStreams.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">
                      {statusFilter || tokenFilter
                        ? "No streams match the current filters."
                        : "No streams found."}
                    </td>
                  </tr>
                ) : (
                  paginatedStreams.map((s) => (
                    <tr key={s.id} className="bg-gray-900 hover:bg-gray-800/60 transition-colors">
                      <td className="px-4 py-3 font-mono text-gray-300">#{s.id}</td>
                      <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                      <td className="px-4 py-3 text-white font-medium">{s.token}</td>
                      <td className="px-4 py-3 font-mono text-gray-400 text-xs">{s.sender}</td>
                      <td className="px-4 py-3 font-mono text-gray-400 text-xs">{s.recipient}</td>
                      <td className="px-4 py-3 text-gray-300">
                        {formatStellarAmount(s.deposit)} {s.token}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/stream/${s.id}`}
                          className="text-green-400 hover:text-green-300 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 rounded"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalStreamPages > 1 && (
            <nav
              aria-label="Stream list pagination"
              className="mt-4 flex items-center justify-center gap-2"
            >
              <button
                onClick={() => setStreamPage((p) => Math.max(1, p - 1))}
                disabled={currentStreamPage === 1}
                aria-label="Previous page"
                className="px-3 py-1.5 rounded-lg text-sm border border-gray-700 text-gray-300 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
              >
                ← Prev
              </button>
              {Array.from({ length: totalStreamPages }).map((_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    onClick={() => setStreamPage(p)}
                    aria-current={currentStreamPage === p ? "page" : undefined}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 ${
                      currentStreamPage === p
                        ? "bg-green-700 border-green-600 text-white"
                        : "border-gray-700 text-gray-400 hover:bg-gray-800"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setStreamPage((p) => Math.min(totalStreamPages, p + 1))}
                disabled={currentStreamPage === totalStreamPages}
                aria-label="Next page"
                className="px-3 py-1.5 rounded-lg text-sm border border-gray-700 text-gray-300 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
              >
                Next →
              </button>
            </nav>
          )}
        </section>
      </div>
    </main>
  );
}

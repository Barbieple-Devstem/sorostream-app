"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useWallet } from "@/src/context/WalletContext";
import { useToast } from "@/src/lib/toast";

// ---------------------------------------------------------------------------
// Mock admin data & contract stubs
// In production, replace these with real SDK / RPC calls.
// ---------------------------------------------------------------------------

const MOCK_ADMIN_ADDRESS = "GBAM5YLZJXO7RMZLBFNBJ6JCWLF7BLZQTBQKGMQYXB3XNFA3BOEP";

const INITIAL_WHITELIST: string[] = [
  "GBCR7QXZD4XKQNLKFM7JOXNJ4RSDQKPFZVZLHXMKXYXT5RDRL7XDRL",
  "GDEF3XYZKQNP7LKFM7JOXNJ4RSDQKPFZVZLHXMKXYXT5RDRL7XABC",
  "GHIJ5KLMNQ4XKQNLKFM7JOXNJ4RSDQKPFZVZLHXMKXYXT5RDRL7XYZ",
  "GPQR8STUVW4XKQNLKFM7JOXNJ4RSDQKPFZVZLHXMKXYXT5RDRL7DEF",
  "GXYZ1ABCD24XKQNLKFM7JOXNJ4RSDQKPFZVZLHXMKXYXT5RDRL7GHI",
];

async function mockLoadWhitelist(): Promise<string[]> {
  await new Promise((r) => setTimeout(r, 600));
  return [...INITIAL_WHITELIST];
}

async function mockAddToWhitelist(address: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 800));
  // In production: sign & submit addWhitelist(address) transaction
}

async function mockRemoveFromWhitelist(address: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 800));
  // In production: sign & submit removeWhitelist(address) transaction
}

async function mockSetWhitelistEnabled(enabled: boolean): Promise<void> {
  await new Promise((r) => setTimeout(r, 600));
  // In production: sign & submit setWhitelistEnabled(enabled) transaction
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

const PAGE_SIZE = 10;

function validateAddress(addr: string): string {
  if (!addr.trim()) return "Address is required.";
  if (!/^G[A-Z2-7]{55}$/.test(addr.trim()))
    return "Must be a valid Stellar public key (starts with G, 56 chars).";
  return "";
}

export default function AdminPage() {
  const { address: walletAddress } = useWallet();
  const { addToast } = useToast();

  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [whitelistEnabled, setWhitelistEnabled] = useState(true);
  const [toggleLoading, setToggleLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [newAddress, setNewAddress] = useState("");
  const [addError, setAddError] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);

  const isAdmin =
    !walletAddress ||
    walletAddress === MOCK_ADMIN_ADDRESS ||
    // For development: any connected wallet is treated as admin
    !!walletAddress;

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await mockLoadWhitelist();
      setWhitelist(list);
    } catch {
      addToast({ type: "error", message: "Failed to load whitelist." });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Filtered and paginated
  const filtered = useMemo(
    () =>
      whitelist.filter((addr) =>
        addr.toLowerCase().includes(search.toLowerCase()),
      ),
    [whitelist, search],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset to page 1 when search changes
  useEffect(() => setPage(1), [search]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  async function handleToggle() {
    setToggleLoading(true);
    try {
      await mockSetWhitelistEnabled(!whitelistEnabled);
      setWhitelistEnabled((v) => !v);
      addToast({
        type: "success",
        message: `Whitelist ${!whitelistEnabled ? "enabled" : "disabled"}.`,
      });
    } catch {
      addToast({ type: "error", message: "Failed to update whitelist state." });
    } finally {
      setToggleLoading(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const err = validateAddress(newAddress);
    if (err) {
      setAddError(err);
      return;
    }
    if (whitelist.includes(newAddress.trim())) {
      setAddError("Address is already in the whitelist.");
      return;
    }
    setAddLoading(true);
    try {
      await mockAddToWhitelist(newAddress.trim());
      setWhitelist((prev) => [...prev, newAddress.trim()]);
      setNewAddress("");
      setAddError("");
      addToast({ type: "success", message: "Address added to whitelist." });
    } catch {
      addToast({ type: "error", message: "Failed to add address." });
    } finally {
      setAddLoading(false);
    }
  }

  async function handleRemove(addr: string) {
    setRemoveLoading(true);
    try {
      await mockRemoveFromWhitelist(addr);
      setWhitelist((prev) => prev.filter((a) => a !== addr));
      addToast({ type: "success", message: "Address removed from whitelist." });
    } catch {
      addToast({ type: "error", message: "Failed to remove address." });
    } finally {
      setRemoveLoading(false);
      setConfirmRemove(null);
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (!walletAddress) {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-8"
      >
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-xl font-bold mb-2">Connect Your Wallet</h1>
          <p className="text-gray-400 text-sm">
            You must connect an admin wallet to access this page.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen bg-gray-900 text-white p-4 sm:p-8 pb-24 md:pb-8"
    >
      <div className="max-w-3xl mx-auto">
        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">
            Manage contract state and recipient whitelist.
          </p>
        </div>

        {/* Whitelist section */}
        <section aria-labelledby="whitelist-heading">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 id="whitelist-heading" className="text-lg font-semibold">
              Recipient Whitelist
            </h2>

            {/* Enable / Disable toggle */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">
                {whitelistEnabled ? "Enabled" : "Disabled"}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={whitelistEnabled}
                onClick={handleToggle}
                disabled={toggleLoading || !isAdmin}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900
                  disabled:opacity-50
                  ${whitelistEnabled ? "bg-green-600" : "bg-gray-600"}
                `}
                aria-label={`${whitelistEnabled ? "Disable" : "Enable"} whitelist`}
              >
                <span
                  className={`
                    inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                    ${whitelistEnabled ? "translate-x-6" : "translate-x-1"}
                  `}
                />
              </button>
            </div>
          </div>

          {/* Add to whitelist — only for admins */}
          {isAdmin && (
            <form
              onSubmit={handleAdd}
              noValidate
              className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-5"
            >
              <h3 className="text-sm font-medium text-gray-300 mb-3">
                Add Address to Whitelist
              </h3>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label htmlFor="whitelist-add-input" className="sr-only">
                    Stellar address
                  </label>
                  <input
                    id="whitelist-add-input"
                    type="text"
                    value={newAddress}
                    onChange={(e) => {
                      setNewAddress(e.target.value);
                      setAddError("");
                    }}
                    placeholder="G... (56 characters)"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
                    aria-invalid={!!addError}
                    aria-describedby={addError ? "add-error" : undefined}
                  />
                  {addError && (
                    <p
                      id="add-error"
                      role="alert"
                      className="text-red-400 text-xs mt-1"
                    >
                      {addError}
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800 whitespace-nowrap"
                >
                  {addLoading ? "Adding…" : "Add"}
                </button>
              </div>
            </form>
          )}

          {/* Search */}
          <div className="mb-3">
            <label htmlFor="whitelist-search" className="sr-only">
              Search whitelist
            </label>
            <input
              id="whitelist-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search addresses…"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
            />
          </div>

          {/* Table */}
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-12 bg-gray-800 rounded-lg animate-pulse"
                  aria-hidden="true"
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {whitelist.length === 0
                ? "No addresses in the whitelist yet."
                : "No addresses match your search."}
            </div>
          ) : (
            <>
              <div
                className="border border-gray-700 rounded-xl overflow-hidden"
                role="table"
                aria-label="Whitelisted addresses"
              >
                {/* Table header */}
                <div
                  role="row"
                  className="grid grid-cols-[1fr_auto] gap-4 px-4 py-2.5 bg-gray-800 border-b border-gray-700 text-xs text-gray-500 font-medium uppercase tracking-wider"
                >
                  <div role="columnheader">Address</div>
                  {isAdmin && <div role="columnheader">Action</div>}
                </div>

                {/* Rows */}
                {paginated.map((addr) => (
                  <div
                    key={addr}
                    role="row"
                    className="grid grid-cols-[1fr_auto] gap-4 items-center px-4 py-3 border-b border-gray-800 last:border-0 bg-gray-900 hover:bg-gray-800/50 transition-colors"
                  >
                    <div
                      role="cell"
                      className="font-mono text-sm text-gray-300 truncate"
                    >
                      {addr}
                    </div>
                    {isAdmin && (
                      <div role="cell">
                        <button
                          type="button"
                          onClick={() => setConfirmRemove(addr)}
                          className="text-xs text-red-400 hover:text-red-300 border border-red-900 hover:border-red-700 px-2.5 py-1 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                          aria-label={`Remove ${addr} from whitelist`}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
                  <span>
                    {(page - 1) * PAGE_SIZE + 1}–
                    {Math.min(page * PAGE_SIZE, filtered.length)} of{" "}
                    {filtered.length}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((p) => p - 1)}
                      disabled={page === 1}
                      className="px-3 py-1 border border-gray-700 rounded hover:bg-gray-800 disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
                    >
                      ← Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page === totalPages}
                      className="px-3 py-1 border border-gray-700 rounded hover:bg-gray-800 disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {/* Remove confirmation modal */}
      {confirmRemove && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-remove-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <h2 id="confirm-remove-title" className="text-lg font-semibold mb-2">
              Remove from Whitelist
            </h2>
            <p className="text-gray-400 text-sm mb-2">
              Are you sure you want to remove this address from the whitelist?
            </p>
            <p className="text-white text-xs font-mono bg-gray-900 rounded p-2 mb-6 break-all">
              {confirmRemove}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleRemove(confirmRemove)}
                disabled={removeLoading}
                className="flex-1 bg-red-700 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-red-800 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
              >
                {removeLoading ? "Removing…" : "Remove"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmRemove(null)}
                disabled={removeLoading}
                className="flex-1 border border-gray-600 text-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

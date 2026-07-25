"use client";

import { useState, useEffect, useCallback } from "react";
import { useNetwork, NETWORK_CONFIG } from "@/src/lib/network";
import { sorostream } from "@/src/lib/sorostream";
import { useToast } from "@/src/lib/toast";

const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID ?? "";

function truncateAddress(address: string, head = 6, tail = 4): string {
  if (!address || address.length <= head + tail + 3) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}

export default function AppFooter() {
  const { network } = useNetwork();
  const { addToast } = useToast();
  const [contractVersion, setContractVersion] = useState<string | null>(null);
  const [versionError, setVersionError] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);

  // Fetch contract version on mount and when network changes
  const fetchVersion = useCallback(async () => {
    setVersionError(false);
    try {
      const v = await sorostream.get_version();
      setContractVersion(v);
    } catch {
      setVersionError(true);
      setContractVersion(null);
    }
  }, []);

  useEffect(() => {
    void fetchVersion();
  }, [fetchVersion, network]);

  // Listen for network config changes in other tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "sorostream-network") void fetchVersion();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [fetchVersion]);

  function handleCopyAddress() {
    if (!CONTRACT_ID) {
      addToast("No contract address configured.", "error");
      return;
    }

    const fallback = () => {
      const textarea = document.createElement("textarea");
      textarea.value = CONTRACT_ID;
      textarea.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    };

    if (navigator.clipboard) {
      navigator.clipboard.writeText(CONTRACT_ID).then(
        () => addToast("Contract address copied!", "success"),
        () => {
          fallback();
          addToast("Contract address copied!", "success");
        },
      );
    } else {
      fallback();
      addToast("Contract address copied!", "success");
    }

    setTooltipOpen(false);
  }

  const networkLabel = NETWORK_CONFIG[network]?.label ?? network;
  const networkIsTestnet = network === "testnet";

  return (
    <footer className="border-t border-gray-800 bg-gray-900 text-gray-400 text-xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 justify-between">
        {/* Left: network badge + contract info */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {/* Network badge */}
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
              networkIsTestnet
                ? "bg-yellow-900/40 text-yellow-400 border border-yellow-700"
                : "bg-green-900/40 text-green-400 border border-green-700"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                networkIsTestnet ? "bg-yellow-400" : "bg-green-400"
              }`}
              aria-hidden="true"
            />
            {networkLabel}
          </span>

          {/* Contract address with tooltip */}
          {CONTRACT_ID ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setTooltipOpen((v) => !v)}
                onBlur={() => setTimeout(() => setTooltipOpen(false), 150)}
                className="inline-flex items-center gap-1.5 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-green-500 rounded"
                aria-label={`Contract address: ${CONTRACT_ID}. Click to expand.`}
                aria-expanded={tooltipOpen}
                aria-haspopup="dialog"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
                <span className="font-mono">{truncateAddress(CONTRACT_ID)}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform ${tooltipOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {tooltipOpen && (
                <div
                  role="dialog"
                  aria-label="Full contract address"
                  className="absolute bottom-full left-0 mb-2 z-50 bg-gray-800 border border-gray-600 rounded-xl p-3 shadow-xl min-w-max max-w-xs"
                >
                  <p className="text-gray-400 text-xs mb-1 font-medium">Contract Address</p>
                  <p className="text-white font-mono text-xs break-all mb-2">{CONTRACT_ID}</p>
                  <button
                    type="button"
                    onClick={handleCopyAddress}
                    className="inline-flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-green-500 rounded"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copy full address
                  </button>
                </div>
              )}
            </div>
          ) : (
            <span className="font-mono text-gray-600">No contract configured</span>
          )}

          {/* Contract version */}
          <span className="inline-flex items-center gap-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {contractVersion != null ? (
              <span>v{contractVersion}</span>
            ) : versionError ? (
              <span className="text-gray-600" aria-label="Version unknown">unknown</span>
            ) : (
              <span className="inline-block w-8 h-3 bg-gray-700 rounded animate-pulse" aria-label="Loading version" />
            )}
          </span>
        </div>

        {/* Right: app name / copyright */}
        <div className="text-gray-600">
          SoroStream © {new Date().getFullYear()}
        </div>
      </div>
    </footer>
  );
}

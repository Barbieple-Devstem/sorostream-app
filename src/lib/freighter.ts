"use client";

import {
  getAddress,
  getNetwork,
  signTransaction as freighterSignTransaction,
  WatchWalletChanges,
} from "@stellar/freighter-api";

export type { WatchWalletChanges };

export const APP_NETWORK = (
  process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet"
).toLowerCase();

export function createWatchWalletChanges(timeout?: number) {
  return new WatchWalletChanges(timeout);
}

/**
 * Fetch the network the Freighter wallet is currently set to.
 * Returns `null` when Freighter is unavailable or not yet allowed.
 */
export async function getWalletNetwork(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const result = await getNetwork();
    if (result.error || !result.network) return null;
    return result.network.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Returns `true` when the wallet's active network matches the app's configured
 * network (`NEXT_PUBLIC_STELLAR_NETWORK`). Returns `null` when the network
 * cannot be determined (Freighter not installed / not yet connected).
 */
export async function checkNetworkMatch(): Promise<boolean | null> {
  const walletNetwork = await getWalletNetwork();
  if (walletNetwork === null) return null;
  return walletNetwork === APP_NETWORK;
}

/**
 * Fetch the currently selected account address from Freighter.
 * Returns an empty string when Freighter is unavailable.
 */
export async function getActiveAddress(): Promise<string> {
  if (typeof window === "undefined") return "";
  try {
    const result = await getAddress();
    if (!result.error && result.address) return result.address;
  } catch {
    // fall through to legacy path
  }
  try {
    const freighter = (window as { freighter?: { getPublicKey: () => Promise<string> } }).freighter;
    if (!freighter) return "";
    return (await freighter.getPublicKey()) ?? "";
  } catch {
    return "";
  }
}

/**
 * Typed, user-friendly error raised when a wallet operation fails because the
 * Freighter session has expired (or the wallet is otherwise unable to sign).
 * Components should catch this to surface a re-auth prompt instead of a raw
 * XDR / SDK error.
 */
export class SessionExpiredWalletError extends Error {
  constructor(
    message = "Your wallet session has expired. Please reconnect to continue.",
  ) {
    super(message);
    this.name = "SessionExpiredWalletError";
  }
}

export const FRIENDLY_SESSION_EXPIRED_MESSAGE =
  "Your wallet session has expired. Please reconnect to continue.";

/**
 * Returns true when an error most likely indicates an expired/invalid wallet
 * session that should trigger a re-auth prompt (rather than being surfaced to
 * the user as a raw XDR or SDK error).
 */
export function isSessionExpiredError(err: unknown): boolean {
  if (err instanceof SessionExpiredWalletError) return true;
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const lower = msg.toLowerCase();
  return (
    lower.includes("session") ||
    lower.includes("expir") ||
    lower.includes("xdr") ||
    lower.includes("not connected") ||
    lower.includes("unauthorized") ||
    lower.includes("unauthorised") ||
    lower.includes("locked") ||
    lower.includes("reconnect") ||
    lower.includes("timed out") ||
    lower.includes("timeout") ||
    lower.includes("not found") ||
    (lower.includes("sign") && (lower.includes("fail") || lower.includes("reject")))
  );
}

export async function signTransaction(xdr: string): Promise<string> {
  if (typeof window === "undefined") return xdr;
  try {
    const result = await freighterSignTransaction(xdr);
    if (result.error) {
      // Surface a friendly, typed error instead of letting a raw/unsigned XDR
      // bubble up and produce a cryptic "XDR parse error" downstream.
      throw new SessionExpiredWalletError(result.error);
    }
    const signed = result.signedTxXdr;
    if (!signed) {
      throw new SessionExpiredWalletError("Wallet returned an empty signature.");
    }
    return signed;
  } catch (err) {
    if (err instanceof SessionExpiredWalletError) throw err;
    // Any other signing failure (e.g. thrown by the SDK) is normalized to the
    // same friendly re-auth error rather than a raw XDR parse message.
    throw new SessionExpiredWalletError(
      err instanceof Error ? err.message : "Transaction signing failed.",
    );
  }
}

export async function getFreighterAdapter() {
  return {
    isConnected: async () => {
      if (typeof window === "undefined") return false;
      return !!(window as { freighter?: unknown }).freighter;
    },
    getPublicKey: getActiveAddress,
    signTransaction,
  };
}

export async function connectWallet(): Promise<string> {
  return getActiveAddress();
}

export async function getPublicKey(): Promise<string> {
  return getActiveAddress();
}

export async function isFreighterInstalled(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  return !!(window as { freighter?: unknown }).freighter;
}

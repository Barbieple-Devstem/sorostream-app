import type { StreamHistoryEntry } from "./export";

export interface StreamData {
  id: string;
  sender: string;
  recipient: string;
  token: string;
  flowRate: number;
  deposit: number;
  startTime: string;
  endTime: string;
  lastWithdrawTime: string;
  status: "Active" | "Cancelled" | "Ended";
  /** Whether the stream auto-renews on expiry. */
  autoRenew?: boolean;
  /** Duration in seconds for each auto-renewal cycle (defaults to original duration). */
  autoRenewDurationSeconds?: number;
  /** Unix timestamp (seconds). When set and > now, stream is scheduled. */
  scheduledStartTime?: number;
}

// ── Protocol stats ───────────────────────────────────────────────────────────

export interface ProtocolStats {
  tvlStroops: number;
  activeStreams: number;
  totalStreams: number;
  totalWithdrawnStroops: number;
  uniqueSenders: number;
  uniqueRecipients: number;
  /** ISO timestamps for sparkline history (last 10 data points) */
  tvlHistory: number[];
  activeStreamsHistory: number[];
}

/** Simulates reading protocol-wide stats from the contract / indexer. */
export async function getProtocolStats(): Promise<ProtocolStats> {
  const now = Date.now();
  // Build a realistic mock sparkline (10 points over the last hour)
  const tvlHistory = Array.from({ length: 10 }, (_, i) => {
    const base = 45_000_000_000_000; // ~4.5M USDC in stroops
    return base + Math.round(Math.sin(i * 0.7) * 2_000_000_000_000 + i * 500_000_000_000);
  });
  const activeStreamsHistory = Array.from({ length: 10 }, (_, i) =>
    Math.max(1, 3 + Math.round(Math.sin(i * 0.5) * 1)),
  );
  void now;
  return {
    tvlStroops: 47_500_000_000_000,       // 4,750,000 USDC
    activeStreams: MOCK_STREAMS.filter((s) => s.status === "Active").length,
    totalStreams: MOCK_STREAMS.length,
    totalWithdrawnStroops: 8_200_000_000_000,
    uniqueSenders: 4,
    uniqueRecipients: 6,
    tvlHistory,
    activeStreamsHistory,
  };
}

// ── Fee simulation ────────────────────────────────────────────────────────────

export interface FeeEstimate {
  inclusionFeeLumens: string;
  resourceFeeLumens: string;
  totalFeeLumens: string;
}

/**
 * Simulates a Soroban RPC `simulateTransaction` call to estimate fees.
 * In production this would call `server.simulateTransaction(tx)`.
 */
export async function simulateTransactionFee(): Promise<FeeEstimate> {
  // Simulate network latency
  await new Promise((r) => setTimeout(r, 800 + Math.random() * 400));
  // Mock Soroban fee breakdown (realistic testnet values)
  const inclusionFee = 0.00001 + Math.random() * 0.00002;
  const resourceFee = 0.00005 + Math.random() * 0.0001;
  const total = inclusionFee + resourceFee;
  const fmt = (n: number) => n.toFixed(7);
  return {
    inclusionFeeLumens: fmt(inclusionFee),
    resourceFeeLumens: fmt(resourceFee),
    totalFeeLumens: fmt(total),
  };
}

export interface TvlStreamLike {
  deposit: number;
  status: StreamData["status"];
  /**
   * Optional amount already withdrawn from the stream, in stroops.
   * This lets unit tests model partial withdrawals without changing the
   * existing stream shape everywhere else in the app.
   */
  withdrawnStroops?: number;
}

/**
 * Calculate the total value locked from active streams only.
 * Cancelled and ended streams are excluded entirely.
 */
export function calculateTotalValueLocked(streams: TvlStreamLike[]): number {
  return streams.reduce((total, stream) => {
    if (stream.status !== "Active") return total;

    const deposit = Number.isFinite(stream.deposit) ? Math.max(0, stream.deposit) : 0;
    const withdrawn = Number.isFinite(stream.withdrawnStroops ?? 0)
      ? Math.max(0, stream.withdrawnStroops ?? 0)
      : 0;

    return total + Math.max(0, deposit - withdrawn);
  }, 0);
}

/** Mutable stream store — seeded with test data, extended by createStream(). */
const MOCK_STREAMS: StreamData[] = [
  {
    id: "1", sender: "GBAM...BOEP", recipient: "GBCR...XDRL", token: "USDC",
    flowRate: 1000000, deposit: 10000000000,
    startTime: new Date(Date.now() - 86400000 * 3).toISOString(),
    endTime: new Date(Date.now() + 86400000 * 7).toISOString(),
    lastWithdrawTime: new Date(Date.now() - 86400000).toISOString(),
    status: "Active",
  },
  {
    id: "2", sender: "GBAM...BOEP", recipient: "GDEF...XYZ", token: "USDC",
    flowRate: 500000, deposit: 5000000000,
    startTime: new Date(Date.now() - 86400000 * 10).toISOString(),
    endTime: new Date(Date.now() + 86400000 * 5).toISOString(),
    lastWithdrawTime: new Date(Date.now() - 86400000 * 2).toISOString(),
    status: "Active",
  },
  {
    id: "3", sender: "GHIJ...KLMN", recipient: "GBAM...BOEP", token: "XLM",
    flowRate: 2000000, deposit: 20000000000,
    startTime: new Date(Date.now() - 86400000 * 1).toISOString(),
    endTime: new Date(Date.now() + 86400000 * 14).toISOString(),
    lastWithdrawTime: new Date(Date.now() - 86400000).toISOString(),
    status: "Active",
  },
  {
    id: "4", sender: "GBAM...BOEP", recipient: "GXYZ...ABC", token: "USDC",
    flowRate: 750000, deposit: 7500000000,
    startTime: new Date(Date.now() - 86400000 * 5).toISOString(),
    endTime: new Date(Date.now() - 86400000 * 1).toISOString(),
    lastWithdrawTime: new Date(Date.now() - 86400000 * 2).toISOString(),
    status: "Ended",
  },
  {
    id: "5", sender: "GDEF...XYZ", recipient: "GHIJ...KLMN", token: "XLM",
    flowRate: 300000, deposit: 3000000000,
    startTime: new Date(Date.now() - 86400000 * 2).toISOString(),
    endTime: new Date(Date.now() + 86400000 * 3).toISOString(),
    lastWithdrawTime: new Date(Date.now() - 86400000 * 1).toISOString(),
    status: "Cancelled",
  },
  {
    id: "9", sender: "GBAM...BOEP", recipient: "GSCH...DULD", token: "USDC",
    flowRate: 600000, deposit: 6000000000,
    startTime: new Date(Date.now() + 86400000 * 2).toISOString(),
    endTime: new Date(Date.now() + 86400000 * 12).toISOString(),
    lastWithdrawTime: new Date(Date.now() + 86400000 * 2).toISOString(),
    status: "Active",
    scheduledStartTime: Math.floor((Date.now() + 86400000 * 2) / 1000),
  },
  // --- Archived streams (ended/cancelled > 30 days ago) ---
  {
    id: "6", sender: "GBAM...BOEP", recipient: "GARC...H1VE", token: "USDC",
    flowRate: 200000, deposit: 2000000000,
    startTime: new Date(Date.now() - 86400000 * 90).toISOString(),
    endTime: new Date(Date.now() - 86400000 * 60).toISOString(),
    lastWithdrawTime: new Date(Date.now() - 86400000 * 61).toISOString(),
    status: "Ended",
  },
  {
    id: "7", sender: "GHIJ...KLMN", recipient: "GBAM...BOEP", token: "XLM",
    flowRate: 150000, deposit: 1500000000,
    startTime: new Date(Date.now() - 86400000 * 120).toISOString(),
    endTime: new Date(Date.now() - 86400000 * 45).toISOString(),
    lastWithdrawTime: new Date(Date.now() - 86400000 * 46).toISOString(),
    status: "Cancelled",
  },
  {
    id: "8", sender: "GXYZ...ABC", recipient: "GDEF...XYZ", token: "USDC",
    flowRate: 400000, deposit: 4000000000,
    startTime: new Date(Date.now() - 86400000 * 180).toISOString(),
    endTime: new Date(Date.now() - 86400000 * 31).toISOString(),
    lastWithdrawTime: new Date(Date.now() - 86400000 * 32).toISOString(),
    status: "Ended",
  },
];

let nextId = 6;

export interface CreateStreamParams {
  recipient?: string;
  amount?: string;
  durationSeconds?: number;
  token?: string;
  /** Pass true to enable auto_renew on the contract. */
  autoRenew?: boolean;
  /** Duration in seconds for each renewal cycle; defaults to durationSeconds. */
  autoRenewDurationSeconds?: number;
  /** Unix timestamp (seconds) for a scheduled start. Omit or set to 0 for immediate start. */
  scheduledStartTime?: number;
}

export function watchClaimable(streams: StreamData[]): StreamData[] {
  return streams.map((s) => ({
    ...s,
    lastWithdrawTime: new Date(
      new Date(s.lastWithdrawTime).getTime() + 1000
    ).toISOString(),
  }));
}

export function simulateNewEvent(): StreamEvent {
  const types: StreamEvent["type"][] = ["withdrawal", "top-up", "creation"];
  const type = types[Math.floor(Math.random() * types.length)];
  const streamId = String(Math.floor(Math.random() * 5) + 1);
  const amount = type !== "creation" ? String(Math.floor(Math.random() * 5000000000) + 1000000000) : undefined;
  return addStreamEvent({
    type,
    streamId,
    amount,
    timestamp: new Date().toISOString(),
    txHash: `0x${Math.random().toString(36).slice(2, 8)}`,
  });
}

export const sorostream = {
  createStream: async (params?: CreateStreamParams) => {
    const id = String(nextId++);
    const durationSeconds = params?.durationSeconds ?? 86400;
    const deposit = params?.amount
      ? Math.round(parseFloat(params.amount) * 10_000_000)
      : 0;
    const flowRate = durationSeconds > 0 ? Math.round(deposit / durationSeconds) : 0;
    const now = new Date();
    const scheduledStartTime = params?.scheduledStartTime && params.scheduledStartTime > Math.floor(Date.now() / 1000)
      ? params.scheduledStartTime
      : undefined;
    const startDate = scheduledStartTime ? new Date(scheduledStartTime * 1000) : now;
    const stream: StreamData = {
      id,
      sender: "GTEST...SENDER",
      recipient: params?.recipient ?? "GTEST...RECIP",
      token: params?.token ?? "USDC",
      flowRate,
      deposit,
      startTime: startDate.toISOString(),
      endTime: new Date(startDate.getTime() + durationSeconds * 1000).toISOString(),
      lastWithdrawTime: startDate.toISOString(),
      status: "Active",
      autoRenew: params?.autoRenew ?? false,
      autoRenewDurationSeconds: params?.autoRenew
        ? (params.autoRenewDurationSeconds ?? durationSeconds)
        : undefined,
      scheduledStartTime,
    };
    MOCK_STREAMS.push(stream);
    return { streamId: id, txHash: `mock-tx-${id}` };
  },
  withdraw: async () => ({ txHash: "mock-tx-hash", amount: "0" }),
  cancelStream: async () => ({ txHash: "mock-tx-hash" }),
  topUp: async () => ({ txHash: "", newEndTime: new Date() }),
  getStream: async (id: string) => getMockStream(id),
  getClaimable: async (streamId: string) => claimableNow(getMockStream(streamId)),
  getStreamsBySender: async () => MOCK_STREAMS,
  getStreamsByRecipient: async () => MOCK_STREAMS,
  getEvents: async () => getStreamEvents(),
  batchWithdraw: async (streamIds: string[]) => ({
    txHash: "mock-batch-tx-hash",
    amounts: Object.fromEntries(streamIds.map(id => [id, "0"])),
  }),
  /** Returns the deployed contract version string (e.g. "1.0.0"). */
  get_version: async (): Promise<string> => {
    // In production this would call the Soroban contract's get_version() method.
    // Return a simulated short delay to mimic real async fetch.
    await new Promise((r) => setTimeout(r, 200));
    return "1.0.0";
  },
  /** Batch-create multiple streams in a single transaction. */
  batch_create: async (streams: CreateStreamParams[]): Promise<{
    txHash: string;
    results: Array<{ index: number; streamId: string | null; error: string | null }>;
  }> => {
    // Simulate a short confirmation delay
    await new Promise((r) => setTimeout(r, 600));
    const results = await Promise.all(
      streams.map(async (params, index) => {
        try {
          const result = await sorostream.createStream(params);
          return { index, streamId: result.streamId, error: null };
        } catch (err) {
          return {
            index,
            streamId: null,
            error: err instanceof Error ? err.message : "Unknown error",
          };
        }
      }),
    );
    return { txHash: `mock-batch-tx-${Date.now()}`, results };
  },
};

export function getMockStream(id: string): StreamData | null {
  return MOCK_STREAMS.find(s => s.id === id) ?? null;
}

export function getMockStreams(): StreamData[] {
  return MOCK_STREAMS;
}

/** Archive threshold in milliseconds (30 days after end/cancel). */
const ARCHIVE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Returns streams that are eligible for the archive:
 * - status is "Ended" or "Cancelled"
 * - endTime was more than 30 days ago
 * Active streams are NEVER returned here.
 */
export function getArchivedStreams(): StreamData[] {
  const cutoff = Date.now() - ARCHIVE_THRESHOLD_MS;
  return MOCK_STREAMS.filter(
    (s) =>
      (s.status === "Ended" || s.status === "Cancelled") &&
      new Date(s.endTime).getTime() <= cutoff,
  );
}

/**
 * Returns non-archived streams: Active streams, or Ended/Cancelled streams
 * that ended within the last 30 days.
 */
export function getActiveDashboardStreams(): StreamData[] {
  const cutoff = Date.now() - ARCHIVE_THRESHOLD_MS;
  return MOCK_STREAMS.filter((s) => {
    if (s.status === "Active") return true;
    return new Date(s.endTime).getTime() > cutoff;
  });
}

/**
 * Return streams relevant to the given wallet address.
 * A stream is relevant when the address is the sender or recipient.
 * Falls back to returning all streams when address is null or empty.
 */
export function getStreamsForWallet(address: string | null): StreamData[] {
  if (!address) return MOCK_STREAMS;
  const relevant = MOCK_STREAMS.filter(
    (s) => s.sender.includes(address.slice(0, 5)) || s.recipient.includes(address.slice(0, 5)),
  );
  return relevant.length > 0 ? relevant : MOCK_STREAMS;
}

export function getMockStreamHistory(id: string): StreamHistoryEntry[] {
  const base: StreamHistoryEntry[] = [
    { timestamp: new Date(Date.now() - 86400000 * 4).toISOString(), type: "creation", amount: "10000000000", txHash: "0xabc123creation" },
  ];
  if (id === "1" || id === "2" || id === "3") {
    base.push(
      { timestamp: new Date(Date.now() - 86400000 * 3).toISOString(), type: "withdrawal", amount: "2500000000", txHash: "0xdef456withdraw" },
      { timestamp: new Date(Date.now() - 86400000).toISOString(), type: "top-up", amount: "5000000000", txHash: "0xghi789topup" }
    );
  }
  return base;
}

export const createClient = () => sorostream;

/**
 * Format a stroops value as XLM/USDC with full 7-decimal precision.
 * Uses locale-aware grouping so large values are readable, e.g. "1,234.5678900".
 * Small values like 0.0001234 are preserved rather than rounding to "0.00".
 */
export function formatUSDC(stroops: bigint): string {
  return formatStellarAmount(Number(stroops));
}

/**
 * Format a raw stroop number (integer, 7-decimal fixed-point) as a
 * locale-aware string with up to 7 significant decimal places.
 *
 * Examples:
 *   1234 stroops  → "0.0001234"
 *   10000000      → "1.0000000"
 *   10000000000   → "1,000.0000000"
 */
export function formatStellarAmount(stroops: number): string {
  const whole = stroops / 10_000_000;
  return whole.toLocaleString(undefined, {
    minimumFractionDigits: 7,
    maximumFractionDigits: 7,
  });
}

export function toStroops(usdc: string): bigint {
  return BigInt(Math.round(parseFloat(usdc) * 10000000));
}

export function calculateFlowRate(stroops: bigint, durationSeconds: number): bigint {
  if (durationSeconds === 0) return BigInt(0);
  return stroops / BigInt(durationSeconds);
}

export function claimableNow(stream: any): string {
  if (!stream) return "0";

  const flowRate = Number(stream.flowRate);
  const lastWithdrawTime = new Date(stream.lastWithdrawTime).getTime();

  if (!Number.isFinite(flowRate) || !Number.isFinite(lastWithdrawTime)) {
    return "0";
  }

  const elapsedSeconds = Math.max(0, (Date.now() - lastWithdrawTime) / 1000);
  return Math.floor(flowRate * elapsedSeconds).toString();
}

export interface StreamEvent {
  id: string;
  type: "withdrawal" | "top-up" | "creation" | "cancellation";
  streamId: string;
  timestamp: string;
  amount?: string;
  txHash: string;
}

const MOCK_EVENTS: StreamEvent[] = [
  { id: "e1", type: "creation", streamId: "4", timestamp: new Date(Date.now() - 30000).toISOString(), txHash: "0xabc" },
  { id: "e2", type: "withdrawal", streamId: "1", timestamp: new Date(Date.now() - 120000).toISOString(), amount: "2500000000", txHash: "0xdef" },
  { id: "e3", type: "top-up", streamId: "2", timestamp: new Date(Date.now() - 300000).toISOString(), amount: "5000000000", txHash: "0xghi" },
  { id: "e4", type: "withdrawal", streamId: "3", timestamp: new Date(Date.now() - 600000).toISOString(), amount: "1000000000", txHash: "0xjkl" },
  { id: "e5", type: "creation", streamId: "5", timestamp: new Date(Date.now() - 900000).toISOString(), txHash: "0xmno" },
];

let nextEventId = 6;

export function getStreamEvents(): StreamEvent[] {
  return [...MOCK_EVENTS];
}

export function addStreamEvent(event: Omit<StreamEvent, "id">): StreamEvent {
  const newEvent: StreamEvent = { ...event, id: `e${nextEventId++}` };
  MOCK_EVENTS.unshift(newEvent);
  return newEvent;
}

export function truncateAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

// ── Gas fee estimate ─────────────────────────────────────────────────────────

export interface GasFeeEstimate {
  /** Estimated fee in stroops */
  feeStroops: number;
  /** Estimated fee as a formatted string, e.g. "0.0000100" */
  feeFormatted: string;
}

/**
 * Simulates fetching the gas fee estimate for a create_stream transaction.
 * In production this would simulate the transaction envelope and read the
 * fee from the simulation response.
 *
 * @param amountStroops  Stream deposit amount in stroops (affects resource usage)
 */
export async function getGasFeeEstimate(amountStroops: number): Promise<GasFeeEstimate> {
  // Simulate network latency
  await new Promise((r) => setTimeout(r, 200 + Math.random() * 150));
  // Base fee of 100 stroops + a tiny resource charge proportional to deposit size
  const feeStroops = 100 + Math.floor(amountStroops * 0.000001);
  return { feeStroops, feeFormatted: formatStellarAmount(feeStroops) };
}

// ── Collateral config ────────────────────────────────────────────────────────

export interface CollateralConfig {
  /**
   * Collateral rate as a basis-point integer, e.g. 1000 = 10%.
   * A value of 0 means collateral is not required.
   */
  basisPoints: number;
}

/**
 * Simulates reading the current collateral configuration from the contract.
 * New senders must lock collateral equal to (streamAmount * basisPoints / 10_000).
 * Set basisPoints to 0 to test the zero-collateral path.
 */
export async function getCollateralConfig(): Promise<CollateralConfig> {
  // Mock: 10% (1000 bps). Set to 0 to test zero-collateral path.
  return { basisPoints: 1000 };
}

/**
 * Returns true when the given sender address has never created a stream before
 * and therefore is subject to the collateral requirement.
 *
 * @param senderAddress  The connected wallet's Stellar public key
 */
export async function checkIsNewSender(senderAddress: string): Promise<boolean> {
  if (!senderAddress) return false;
  // Mock: treat address as new if they have no streams in the mock store.
  const hasPriorStreams = MOCK_STREAMS.some((s) =>
    s.sender === senderAddress || s.sender.startsWith(senderAddress.slice(0, 5)),
  );
  return !hasPriorStreams;
}

/**
 * Compute the collateral amount in stroops required for a given stream deposit.
 *
 * @param depositStroops  Stream deposit in stroops
 * @param basisPoints     Protocol collateral rate in basis points
 */
export function calcCollateral(
  depositStroops: number,
  basisPoints: number,
): number {
  return Math.ceil((depositStroops * basisPoints) / 10_000);
}

// ── Protocol fee config ──────────────────────────────────────────────────────

export interface FeeConfig {
  /** Fee rate as a basis-point integer, e.g. 50 = 0.50% */
  basisPoints: number;
}

/** Simulates reading the current fee rate from the contract config. */
export async function getFeeConfig(): Promise<FeeConfig> {
  // Mock: 0.50% (50 bps). Set to 0 to test zero-fee path.
  return { basisPoints: 50 };
}

// ── Contract version ──────────────────────────────────────────────────────────

/** Version reported by the deployed contract's `version` query instruction. */
const MOCK_DEPLOYED_CONTRACT_VERSION = "1.2.0";

/** Simulates calling the deployed SoroStream contract's `version` query. */
export async function getDeployedContractVersion(): Promise<string> {
  return MOCK_DEPLOYED_CONTRACT_VERSION;
}

/**
 * Break down a withdrawal into claimable amount, protocol fee, and net amount.
 *
 * @param claimableStroops  Raw stroop value the user would receive pre-fee
 * @param basisPoints       Protocol fee rate in basis points (e.g. 50 = 0.5%)
 */
export function calcWithdrawBreakdown(
  claimableStroops: number,
  basisPoints: number,
): {
  claimable: number;
  fee: number;
  net: number;
  feePercent: number;
} {
  const feePercent = basisPoints / 100; // e.g. 50 bps → 0.5%
  const fee = Math.floor((claimableStroops * basisPoints) / 10_000);
  const net = claimableStroops - fee;
  return { claimable: claimableStroops, fee, net, feePercent };
}

// ── Treasury ────────────────────────────────────────────────────────────────

export interface TreasuryBalance {
  /** Token symbol, e.g. "USDC" or "XLM" */
  token: string;
  /** Raw stroop balance accumulated in the treasury */
  balanceStroops: number;
  /** ISO timestamp of the last sweep (null if never swept) */
  lastSweepAt: string | null;
  /** Amount swept in the last sweep (stroops), null if never swept */
  lastSweepAmountStroops: number | null;
}

/** Mock treasury balances — keyed by token. */
const MOCK_TREASURY: TreasuryBalance[] = [
  {
    token: "USDC",
    balanceStroops: 3_750_000_000, // 375 USDC
    lastSweepAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    lastSweepAmountStroops: 1_200_000_000,
  },
  {
    token: "XLM",
    balanceStroops: 8_200_000_000, // 820 XLM
    lastSweepAt: new Date(Date.now() - 86400000 * 14).toISOString(),
    lastSweepAmountStroops: 2_500_000_000,
  },
  {
    token: "wBTC",
    balanceStroops: 0, // No fees collected yet
    lastSweepAt: null,
    lastSweepAmountStroops: null,
  },
];

/** Fetch the treasury balances (simulates a contract query). */
export async function getTreasuryBalances(): Promise<TreasuryBalance[]> {
  return [...MOCK_TREASURY];
}

/** Simulate a sweep_fees contract call. Clears the balance and records sweep metadata. */
export async function sweepTreasuryFees(token: string): Promise<{ txHash: string }> {
  const entry = MOCK_TREASURY.find((t) => t.token === token);
  if (entry) {
    entry.lastSweepAmountStroops = entry.balanceStroops;
    entry.lastSweepAt = new Date().toISOString();
    entry.balanceStroops = 0;
  }
  return { txHash: `mock-sweep-tx-${Date.now()}` };
}

"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
  CartesianGrid,
  Legend,
} from "recharts";
import { useWallet } from "@/src/context/WalletContext";
import {
  getSnapshots,
  saveSnapshot,
  shouldSnapshot,
  type BalanceSnapshot,
} from "@/src/lib/balanceCache";

type TimeRange = "1D" | "7D" | "30D" | "90D" | "ALL";

const RANGE_MS: Record<TimeRange, number> = {
  "1D": 24 * 60 * 60 * 1000,
  "7D": 7 * 24 * 60 * 60 * 1000,
  "30D": 30 * 24 * 60 * 60 * 1000,
  "90D": 90 * 24 * 60 * 60 * 1000,
  ALL: Infinity,
};

interface ChartPoint {
  time: number;
  [asset: string]: number | string;
}

interface PortfolioSummary {
  startValue: number;
  endValue: number;
  absoluteChange: number;
  percentChange: number;
}

function computeSummary(points: ChartPoint[], asset: string): PortfolioSummary | null {
  if (points.length < 2) return null;
  const start = points[0][asset] as number;
  const end = points[points.length - 1][asset] as number;
  if (typeof start !== "number" || typeof end !== "number") return null;
  const absoluteChange = end - start;
  const percentChange = start !== 0 ? (absoluteChange / Math.abs(start)) * 100 : 0;
  return { startValue: start, endValue: end, absoluteChange, percentChange };
}

function formatAmount(val: number): string {
  return val.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

const ASSET_COLORS: Record<string, string> = {
  XLM: "#22C55E",
  USDC: "#3B82F6",
};

export default function PortfolioChart() {
  const { address, balanceRefreshTrigger } = useWallet();
  const [range, setRange] = useState<TimeRange>("30D");
  const [snapshots, setSnapshots] = useState<BalanceSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSnapshots = useCallback(async () => {
    if (!address) {
      setSnapshots([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getSnapshots(address);
      setSnapshots(data);
    } catch {
      setSnapshots([]);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void loadSnapshots();
  }, [loadSnapshots, balanceRefreshTrigger]);

  // Auto-save a snapshot periodically when the component is visible
  useEffect(() => {
    if (!address) return;

    async function maybeSnapshot() {
      const shouldSave = await shouldSnapshot(address!);
      if (!shouldSave) return;

      // Fetch current balance from Horizon (reuse NavHeader's approach)
      try {
        const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet";
        const horizonUrl =
          network === "public" || network === "mainnet"
            ? "https://horizon.stellar.org"
            : network === "futurenet"
            ? "https://horizon-futurenet.stellar.org"
            : "https://horizon-testnet.stellar.org";

        const res = await fetch(`${horizonUrl}/accounts/${address}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          balances?: { asset_type: string; asset_code?: string; balance: string }[];
        };

        const balances: Record<string, number> = {};
        for (const b of data.balances ?? []) {
          const code = b.asset_type === "native" ? "XLM" : (b.asset_code ?? "UNKNOWN");
          balances[code] = parseFloat(b.balance);
        }

        if (Object.keys(balances).length > 0) {
          await saveSnapshot({
            address: address!,
            timestamp: new Date().toISOString(),
            balances,
          });
          void loadSnapshots();
        }
      } catch {
        // silently ignore fetch failures
      }
    }

    void maybeSnapshot();
    const interval = setInterval(maybeSnapshot, 60 * 60 * 1000); // hourly
    return () => clearInterval(interval);
  }, [address, loadSnapshots]);

  // Filter snapshots by selected time range
  const filteredPoints = useMemo(() => {
    const rangeMs = RANGE_MS[range];
    const cutoff = Date.now() - rangeMs;
    return snapshots
      .filter((s) => rangeMs === Infinity || new Date(s.timestamp).getTime() >= cutoff)
      .map((s) => {
        const point: ChartPoint = { time: new Date(s.timestamp).getTime() };
        for (const [asset, val] of Object.entries(s.balances)) {
          point[asset] = val;
        }
        return point;
      })
      .sort((a, b) => a.time - b.time);
  }, [snapshots, range]);

  // Discover all unique asset codes across the filtered points
  const assets = useMemo(() => {
    const set = new Set<string>();
    for (const p of filteredPoints) {
      for (const key of Object.keys(p)) {
        if (key !== "time") set.add(key);
      }
    }
    return Array.from(set);
  }, [filteredPoints]);

  // Compute summaries per asset
  const summaries = useMemo(() => {
    const map: Record<string, PortfolioSummary | null> = {};
    for (const asset of assets) {
      map[asset] = computeSummary(filteredPoints, asset);
    }
    return map;
  }, [filteredPoints, assets]);

  const fmtAmount = (v: number) => formatAmount(v);

  const ranges: TimeRange[] = ["1D", "7D", "30D", "90D", "ALL"];

  if (!address) {
    return null;
  }

  return (
    <section aria-labelledby="portfolio-chart-heading" className="bg-gray-800 rounded-xl p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 id="portfolio-chart-heading" className="text-lg font-semibold">
          Portfolio Performance
        </h2>
        <div className="flex gap-1" role="radiogroup" aria-label="Time range">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              role="radio"
              aria-checked={range === r}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800 ${
                range === r
                  ? "bg-green-700 border-green-600 text-white"
                  : "border-gray-700 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Summary row */}
      {assets.length > 0 && (
        <div className="flex flex-wrap gap-4 mb-4">
          {assets.map((asset) => {
            const s = summaries[asset];
            if (!s) return null;
            const isPositive = s.percentChange >= 0;
            return (
              <div key={asset} className="flex items-center gap-3 text-sm">
                <span className="text-gray-400">{asset}:</span>
                <span className="font-mono font-semibold text-white">
                  {fmtAmount(s.endValue)}
                </span>
                <span
                  className={`font-mono text-xs ${
                    isPositive ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {isPositive ? "+" : ""}
                  {fmtAmount(s.absoluteChange)} ({s.percentChange.toFixed(2)}%)
                </span>
              </div>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="h-[300px] flex items-center justify-center">
          <div className="h-8 w-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredPoints.length < 2 ? (
        <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
          <div className="text-center">
            <p>No balance data yet for this time range.</p>
            <p className="text-xs text-gray-500 mt-1">
              Snapshots are recorded hourly while the dashboard is open.
            </p>
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={filteredPoints} margin={{ top: 20, right: 10, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="time"
              tickFormatter={fmtDate}
              stroke="#9CA3AF"
              tick={{ fill: "#9CA3AF", fontSize: 12 }}
              type="number"
              domain={["dataMin", "dataMax"]}
              tickLine={false}
            />
            <YAxis
              tickFormatter={fmtAmount}
              stroke="#9CA3AF"
              tick={{ fill: "#9CA3AF", fontSize: 12 }}
              width={70}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1F2937",
                border: "1px solid #374151",
                borderRadius: "8px",
                color: "#F9FAFB",
                fontSize: "13px",
              }}
              labelFormatter={(label) => new Date(label as number).toLocaleString()}
              formatter={(value: any, name: any) => [`${fmtAmount(Number(value))} ${name}`, name]}
            />
            {assets.length > 1 && (
              <Legend
                wrapperStyle={{ fontSize: "12px", color: "#9CA3AF" }}
              />
            )}
            {assets.map((asset) => (
              <Line
                key={asset}
                type="monotone"
                dataKey={asset}
                stroke={ASSET_COLORS[asset] ?? "#A855F7"}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: ASSET_COLORS[asset] ?? "#A855F7" }}
                name={asset}
              />
            ))}
            {filteredPoints.length > 0 && (
              <ReferenceDot
                x={filteredPoints[filteredPoints.length - 1].time}
                y={filteredPoints[filteredPoints.length - 1][assets[0]] as number}
                r={6}
                fill={ASSET_COLORS[assets[0]] ?? "#22C55E"}
                stroke="#F9FAFB"
                strokeWidth={2}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
      <p className="text-xs text-gray-400 mt-2 text-center">
        &#x25CF; Current balance &mdash; Snapshots stored in IndexedDB, expires after 90 days
      </p>
    </section>
  );
}

"use client";

import { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceDot,
} from "recharts";
import type { BalanceSnapshot, PeriodChange } from "@/src/lib/balanceHistory";
import {
  filterByTimeRange,
  calculatePeriodChange,
  generateMockBalanceHistory,
} from "@/src/lib/balanceHistory";

type TimeRange = "1D" | "7D" | "30D" | "90D" | "ALL";

interface PortfolioChartProps {
  snapshots?: BalanceSnapshot[];
  streamEvents?: Array<{ timestamp: number; type: "creation" | "cancellation" }>;
}

interface ChartPoint {
  time: number;
  balance: number;
  timestamp: string;
}

export default function PortfolioChart({
  snapshots: initialSnapshots,
  streamEvents = [],
}: PortfolioChartProps) {
  const [selectedRange, setSelectedRange] = useState<TimeRange>("30D");
  const [snapshots, setSnapshots] = useState<BalanceSnapshot[]>([]);

  // Initialize with mock data if no snapshots provided
  useEffect(() => {
    if (initialSnapshots && initialSnapshots.length > 0) {
      setSnapshots(initialSnapshots);
    } else {
      setSnapshots(generateMockBalanceHistory(90));
    }
  }, [initialSnapshots]);

  // Filter snapshots by selected time range
  const filteredSnapshots = useMemo(
    () => filterByTimeRange(snapshots, selectedRange),
    [snapshots, selectedRange]
  );

  // Calculate period change
  const periodChange = useMemo(
    () => calculatePeriodChange(filteredSnapshots),
    [filteredSnapshots]
  );

  // Transform data for chart
  const chartData = useMemo(() => {
    return filteredSnapshots
      .map((s) => ({
        time: s.timestamp,
        balance: s.totalBalance / 10_000_000, // Convert stroops to USDC
        timestamp: new Date(s.timestamp).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
      }))
      .sort((a, b) => a.time - b.time);
  }, [filteredSnapshots]);

  // Format functions
  const formatDate = (ms: number) =>
    new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  const formatAmount = (value: number) => `$${value.toFixed(2)}`;

  const formatTooltip = (label: any, payload: any[]) => {
    if (payload && payload.length > 0) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
          <p className="text-gray-400 text-xs">{data.timestamp}</p>
          <p className="text-white font-semibold">${data.balance.toFixed(2)} USDC</p>
        </div>
      );
    }
    return null;
  };

  // Get current balance
  const currentBalance = chartData.length > 0 ? chartData[chartData.length - 1].balance : 0;

  return (
    <section className="bg-gray-800 rounded-xl p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h2 className="text-lg font-semibold mb-1">Portfolio Performance</h2>
          <p className="text-2xl font-bold text-white">${currentBalance.toFixed(2)} USDC</p>
        </div>

        {/* Time range selectors */}
        <div className="flex gap-2">
          {(["1D", "7D", "30D", "90D", "ALL"] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setSelectedRange(range)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                selectedRange === range
                  ? "bg-green-700 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
              aria-pressed={selectedRange === range}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Period summary */}
      {periodChange && (
        <div className="flex gap-6 mb-6 text-sm">
          <div>
            <span className="text-gray-400">Period Change:</span>
            <span
              className={`ml-2 font-semibold ${
                periodChange.percentage >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {periodChange.percentage >= 0 ? "+" : ""}
              {periodChange.percentage.toFixed(2)}%
            </span>
          </div>
          <div>
            <span className="text-gray-400">Absolute:</span>
            <span
              className={`ml-2 font-semibold ${
                periodChange.absolute >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {periodChange.absolute >= 0 ? "+" : ""}
              ${(periodChange.absolute / 10_000_000).toFixed(2)} USDC
            </span>
          </div>
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 20, right: 10, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="time"
              tickFormatter={formatDate}
              stroke="#9CA3AF"
              tick={{ fill: "#9CA3AF", fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatAmount}
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
              labelFormatter={(label) => formatDate(label as number)}
              formatter={(value: any) => [formatAmount(value), "Balance"]}
            />
            <Line
              type="monotone"
              dataKey="balance"
              stroke="#22C55E"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#22C55E" }}
            />
            {/* Stream event markers */}
            {streamEvents.map((event, idx) => {
              const eventTime = event.timestamp;
              const matchingPoint = chartData.find(
                (p) => Math.abs(p.time - eventTime) < 3600000 // Within 1 hour
              );
              if (matchingPoint) {
                return (
                  <ReferenceDot
                    key={`event-${idx}`}
                    x={matchingPoint.time}
                    y={matchingPoint.balance}
                    r={5}
                    fill={event.type === "creation" ? "#3B82F6" : "#EF4444"}
                    stroke="#F9FAFB"
                    strokeWidth={2}
                  />
                );
              }
              return null;
            })}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[300px] flex items-center justify-center text-gray-400">
          No data available for selected time range
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 mt-4 text-xs text-gray-400">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>Balance</span>
        </div>
        {streamEvents.length > 0 && (
          <>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span>Stream Created</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>Stream Cancelled</span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

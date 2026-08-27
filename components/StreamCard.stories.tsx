import type { Meta, StoryObj } from "@storybook/react";
import StreamCard from "@/components/StreamCard";
import { BookmarksProvider } from "@/src/context/BookmarksContext";

// StreamCard uses useBookmarks, which requires BookmarksProvider.
// We wrap it here since the global preview only includes
// ThemeProvider, SettingsProvider, and WalletProvider.
const meta: Meta<typeof StreamCard> = {
  title: "UI/StreamCard",
  component: StreamCard,
  decorators: [
    (Story) => (
      <BookmarksProvider>
        <Story />
      </BookmarksProvider>
    ),
  ],
  args: {
    id: "stream-001",
    sender: "GAHJJJKMOKYE4RVPZEWZTKH5FVI4PA3VL7GK2LFNUBSGBV3UN3IXYNEP",
    recipient: "GDRXE2BQUC3AZNPVFSCEZ76NJ3WWL25FYFK6RGZGIEKWE4SOOHSUJUJ6",
    flowRate: 11574,      // ~0.0000011574 XLM/sec ≈ 0.1 XLM/day
    deposit: 100_000_000, // 10 XLM
  },
};

export default meta;

type Story = StoryObj<typeof StreamCard>;

// ── Reference timestamps ──────────────────────────────────────────────────
const NOW = new Date();
const oneHourAgo = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString();
const oneDayAgo = new Date(NOW.getTime() - 24 * 60 * 60 * 1000).toISOString();
const inSevenDays = new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
const inThirtyDays = new Date(NOW.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
const scheduledInOneHour = Math.floor(NOW.getTime() / 1000) + 3600;

// ── Stories ───────────────────────────────────────────────────────────────

/** A healthy active stream currently streaming funds. */
export const Default: Story = {
  name: "Default (Active)",
  args: {
    status: "Active",
    startTime: oneDayAgo,
    endTime: inThirtyDays,
  },
};

/** Skeleton placeholder shown while stream data is loading. */
export const Loading: Story = {
  args: {
    loading: true,
  },
};

/** Stream paused by the sender — flow is frozen at the paused timestamp. */
export const Paused: Story = {
  args: {
    status: "Paused",
    startTime: oneDayAgo,
    endTime: inThirtyDays,
    pausedAt: oneHourAgo,
  },
};

/** Stream cancelled before it ended — shown in red. */
export const Cancelled: Story = {
  args: {
    status: "Cancelled",
    startTime: oneDayAgo,
    endTime: inThirtyDays,
  },
};

/** Stream that has fully completed — shown in blue. */
export const Completed: Story = {
  args: {
    status: "Completed",
    startTime: oneDayAgo,
    endTime: oneHourAgo,
  },
};

/**
 * Stream created with a future start time.
 * The "Scheduled" badge is visible when scheduledStartTime > now.
 */
export const Scheduled: Story = {
  args: {
    status: "Active",
    scheduledStartTime: scheduledInOneHour,
    startTime: inSevenDays,
    endTime: inThirtyDays,
  },
};

/** Card in its selected state — highlighted with a green border. */
export const Selected: Story = {
  args: {
    status: "Active",
    selected: true,
    startTime: oneDayAgo,
    endTime: inThirtyDays,
    onToggle: (id) => console.log("toggled", id),
  },
};

/** Shows the clone action button alongside a checkbox for bulk selection. */
export const WithClone: Story = {
  name: "With Clone Action",
  args: {
    status: "Active",
    startTime: oneDayAgo,
    endTime: inThirtyDays,
    onToggle: (id) => console.log("toggled", id),
    onClone: (id) => console.log("clone", id),
  },
};

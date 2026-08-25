/**
 * Stream webhook notifications.
 *
 * When a user has configured a webhook URL, key stream state changes are
 * delivered as HTTP POST requests to that endpoint. The POST is best-effort and
 * fire-and-forget: failures are logged but never throw, so callers in the
 * critical path (e.g. while creating a stream) are never blocked by a slow or
 * broken webhook receiver.
 */
import { getWebhookConfig } from "./notificationPrefs";

export type WebhookEventType =
  | "stream.created"
  | "stream.withdrawn"
  | "stream.cancelled"
  | "stream.paused"
  | "stream.resumed"
  | "stream.topped_up"
  | "stream.recipient_transferred";

export interface WebhookEvent {
  type: WebhookEventType;
  streamId: string;
  timestamp: string;
  /** Optional human-readable detail. */
  message?: string;
  /** Optional asset/token code this event relates to. */
  asset?: string;
}

/**
 * POST a stream event to the user-configured webhook, if one is enabled.
 * No-op (resolves immediately) when running on the server, when no webhook is
 * configured, or when the saved URL is invalid. Any network error is swallowed
 * so it can never disrupt the calling transaction flow.
 */
export async function dispatchWebhook(event: WebhookEvent): Promise<void> {
  if (typeof window === "undefined") return;

  const { enabled, url } = getWebhookConfig();
  if (!enabled || !url) return;

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-SoroStream-Event": event.type,
      },
      body: JSON.stringify(event),
      // Don't let a slow receiver hang the UI thread's async work.
      keepalive: true,
    });
  } catch (err) {
    // Best-effort only.
    console.warn("Webhook delivery failed:", err);
  }
}

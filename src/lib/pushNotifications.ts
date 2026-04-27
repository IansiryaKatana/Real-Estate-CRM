import { supabase } from "@/integrations/supabase/client";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

type SubscriptionKeys = {
  p256dh?: string;
  auth?: string;
};

export async function ensureWebPushSubscription(profileId: string): Promise<"granted" | "denied" | "unsupported" | "skipped"> {
  const publicKey = (import.meta.env.VITE_WEBPUSH_VAPID_PUBLIC_KEY as string | undefined)?.trim();
  if (!publicKey) return "skipped";
  if (typeof window === "undefined") return "unsupported";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") return "denied";

  const registration = await navigator.serviceWorker.register("/push-sw.js");
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const json = subscription.toJSON();
  const keys = (json.keys ?? {}) as SubscriptionKeys;
  if (!json.endpoint || !keys.auth || !keys.p256dh) return "unsupported";

  await supabase.from("push_subscriptions").upsert(
    {
      profile_id: profileId,
      endpoint: json.endpoint,
      auth: keys.auth,
      p256dh: keys.p256dh,
      is_active: true,
      user_agent: navigator.userAgent,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );

  return "granted";
}

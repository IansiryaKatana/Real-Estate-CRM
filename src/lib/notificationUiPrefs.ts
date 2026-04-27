export type NotificationUiPrefs = {
  sound_enabled: boolean;
  popup_enabled: boolean;
};

const STORAGE_KEY = "crm_notification_ui_prefs";

const DEFAULT_PREFS: NotificationUiPrefs = {
  sound_enabled: true,
  popup_enabled: true,
};

export function getNotificationUiPrefs(): NotificationUiPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<NotificationUiPrefs>;
    return {
      sound_enabled: parsed.sound_enabled ?? DEFAULT_PREFS.sound_enabled,
      popup_enabled: parsed.popup_enabled ?? DEFAULT_PREFS.popup_enabled,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function setNotificationUiPrefs(next: NotificationUiPrefs) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

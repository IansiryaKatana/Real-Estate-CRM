import { useNotifications, formatDateTime } from "@/hooks/useSupabaseData";
import { useCurrentProfile } from "@/hooks/useSupabaseData";
import { Bell, Check, Info, AlertTriangle, Users, DollarSign } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { ensureWebPushSubscription } from "@/lib/pushNotifications";
import { getNotificationUiPrefs } from "@/lib/notificationUiPrefs";
import { useNavigate } from "react-router-dom";

const typeIcons: Record<string, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  lead: Users,
  whatsapp: Users,
  commission: DollarSign,
};

export function NotificationPanel() {
  const { data: me } = useCurrentProfile();
  const { data: notifications = [] } = useNotifications(me?.id);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const unreadCount = notifications.filter(n => !n.is_read).length;
  const pushBootstrapped = useRef(false);
  const handledNotificationIds = useRef<Set<string>>(new Set());
  const didInitHandledIds = useRef(false);
  const dismissedPopupIds = useRef<Set<string>>(new Set());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [popupNotification, setPopupNotification] = useState<{
    id: string;
    title: string;
    message: string;
    entity_type?: string | null;
    entity_id?: string | null;
    type?: string | null;
  } | null>(null);

  const dismissPopup = (id?: string) => {
    if (id) dismissedPopupIds.current.add(id);
    setPopupNotification(null);
  };

  const playNotificationSound = () => {
    try {
      const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      const ctx = audioCtxRef.current;
      void ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } catch {
      // no-op: sound should never block notifications
    }
  };

  const openNotificationTarget = (n: { entity_type?: string | null; entity_id?: string | null; type?: string | null }) => {
    if (n.entity_type === "lead" && n.entity_id) {
      navigate(`/communications?tab=whatsapp&lead=${n.entity_id}`);
      return;
    }
    if (n.type === "whatsapp") {
      navigate("/communications?tab=whatsapp");
      return;
    }
    navigate("/settings?tab=notifications");
  };

  const handleNotificationClick = async (n: {
    id: string;
    is_read?: boolean | null;
    entity_type?: string | null;
    entity_id?: string | null;
    type?: string | null;
  }) => {
    if (!n.is_read) await markRead(n.id);
    openNotificationTarget(n);
  };

  useEffect(() => {
    if (!me?.id || pushBootstrapped.current) return;
    pushBootstrapped.current = true;
    ensureWebPushSubscription(me.id).catch((err) => {
      console.error("Web push subscription failed", err);
    });

    const unlockAudio = () => {
      const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      void audioCtxRef.current.resume();
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
    window.addEventListener("pointerdown", unlockAudio, { once: true });
    window.addEventListener("keydown", unlockAudio, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, [me?.id]);

  useEffect(() => {
    if (!me?.id) return;
    const channel = supabase
      .channel(`notifications-live-${me.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${me.id}`,
        },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["notifications"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [me?.id, qc]);

  useEffect(() => {
    if (!didInitHandledIds.current && notifications.length > 0) {
      // Don't popup historical unread notifications on first load.
      for (const n of notifications) handledNotificationIds.current.add(n.id);
      didInitHandledIds.current = true;
      return;
    }
    for (const n of notifications) {
      if (handledNotificationIds.current.has(n.id)) continue;
      handledNotificationIds.current.add(n.id);
      if (n.is_read) continue;

      const prefs = getNotificationUiPrefs();
      if (prefs.sound_enabled) playNotificationSound();
      if (prefs.popup_enabled && n.type === "whatsapp" && !dismissedPopupIds.current.has(n.id)) {
        setPopupNotification({
          id: n.id,
          title: n.title,
          message: n.message,
          entity_id: n.entity_id,
          entity_type: n.entity_type,
          type: n.type,
        });
      }

      if (typeof window !== "undefined" && "Notification" in window && document.visibilityState !== "visible") {
        if (Notification.permission === "granted") {
          new Notification(n.title, { body: n.message, tag: `crm-notif-${n.id}` });
        } else if (Notification.permission === "default") {
          Notification.requestPermission().catch(() => {});
        }
      }
    }
  }, [notifications]);

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <button className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="font-heading text-sm font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllRead}>
                <Check className="mr-1 h-3 w-3" /> Mark all read
              </Button>
            )}
          </div>
          <ScrollArea className="max-h-80">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No notifications</div>
            ) : (
              notifications.slice(0, 20).map(n => {
                const Icon = typeIcons[n.type] || Info;
                return (
                  <div
                    key={n.id}
                    className={cn("flex gap-3 px-4 py-3 border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 transition-colors", !n.is_read && "bg-primary/5")}
                    onClick={() => void handleNotificationClick(n)}
                  >
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", !n.is_read ? "bg-primary/10" : "bg-muted")}>
                      <Icon className={cn("h-4 w-4", !n.is_read ? "text-primary" : "text-muted-foreground")} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm truncate", !n.is_read && "font-medium")}>{n.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{formatDateTime(n.created_at)}</p>
                    </div>
                    {!n.is_read && <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                  </div>
                );
              })
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      <Dialog open={!!popupNotification} onOpenChange={(o) => !o && dismissPopup(popupNotification?.id)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{popupNotification?.title ?? "New notification"}</DialogTitle>
            <DialogDescription>{popupNotification?.message ?? ""}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => dismissPopup(popupNotification?.id)}>Dismiss</Button>
            <Button
              onClick={() => {
                if (popupNotification) {
                  void handleNotificationClick({ ...popupNotification, is_read: false });
                }
                dismissPopup(popupNotification?.id);
              }}
            >
              Open
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

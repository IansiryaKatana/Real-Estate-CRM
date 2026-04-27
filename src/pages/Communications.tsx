import { useState, useMemo, useEffect, useRef } from "react";
import { PageShell } from "@/components/layout/PageShell";
import {
  useEmailThreads,
  useLeads,
  useWhatsAppMessages,
  useCurrentProfile,
  useNotifications,
  formatDateTime,
} from "@/hooks/useSupabaseData";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Mail, Send, FileText, Plus, Search, ArrowLeft, MessageCircle, Paperclip, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";

export default function CommunicationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "whatsapp" ? "whatsapp" : "email";
  const { data: threads = [] } = useEmailThreads();
  const { data: leads = [] } = useLeads();
  const { data: me } = useCurrentProfile();
  const { data: notifications = [] } = useNotifications(me?.id);

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedWaLeadId, setSelectedWaLeadId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [emailLeadPage, setEmailLeadPage] = useState(1);
  const [waSearch, setWaSearch] = useState("");
  const [waLeadPage, setWaLeadPage] = useState(1);
  const [reply, setReply] = useState("");
  const [replyHtml, setReplyHtml] = useState("");
  const [emailAttachments, setEmailAttachments] = useState<Array<{ name: string; type: string; size: number; content: string }>>([]);
  const [emailSending, setEmailSending] = useState(false);
  const [waReply, setWaReply] = useState("");
  const [waSending, setWaSending] = useState(false);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"email" | "whatsapp">(initialTab);
  const [templateForm, setTemplateForm] = useState({ name: "", subject: "", body: "", category: "Follow-up" });
  const [templates, setTemplates] = useState([
    {
      id: "t1",
      name: "Initial Follow-Up",
      subject: "Thank you for your inquiry",
      category: "Follow-up",
      body: "Hi {lead_name},\n\nThank you for your interest in {property}. I would be happy to answer your questions and guide you on the next steps.\n\nBest regards,\n{agent_name}",
    },
    {
      id: "t2",
      name: "Viewing Confirmation",
      subject: "Viewing Confirmed - {property}",
      category: "Viewing",
      body: "Hi {lead_name},\n\nYour viewing for {property} is confirmed for {date} at {time}.\n\nPlease let me know if you need location details.\n\nBest regards,\n{agent_name}",
    },
    {
      id: "t3",
      name: "Price Offer",
      subject: "Exclusive Offer - {property}",
      category: "Offer",
      body: "Hi {lead_name},\n\nWe are pleased to share an offer for {property} at {price}.\n\nIf you are interested, I can walk you through the full terms.\n\nBest regards,\n{agent_name}",
    },
    {
      id: "t4",
      name: "Post-Viewing",
      subject: "Following up on your viewing",
      category: "Follow-up",
      body: "Hi {lead_name},\n\nIt was great meeting you at the viewing. I would love to hear your feedback and discuss possible next steps.\n\nBest regards,\n{agent_name}",
    },
  ]);
  const isMobile = useIsMobile();
  const qc = useQueryClient();
  const waMessagesContainerRef = useRef<HTMLDivElement | null>(null);
  const emailEditorRef = useRef<HTMLDivElement | null>(null);
  const emailAttachmentInputRef = useRef<HTMLInputElement | null>(null);
  const selectedWaLead = leads.find((l) => l.id === selectedWaLeadId);

  const { data: waMessages = [], isLoading: waLoading } = useWhatsAppMessages(selectedWaLeadId, selectedWaLead?.phone ?? null);

  /** Dedupe by id — useLeads() pagination can occasionally repeat a row; keys must be unique. */
  const whatsappLeads = useMemo(() => {
    const withPhone = leads.filter((l) => (l.phone ?? "").trim().length >= 8);
    const seen = new Set<string>();
    return withPhone.filter((l) => {
      if (seen.has(l.id)) return false;
      seen.add(l.id);
      return true;
    });
  }, [leads]);

  const selectedThread = threads.find((t) => t.id === selectedThreadId);
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;

  const emailLeads = useMemo(() => {
    return leads.filter((l) => {
      const em = l.email?.trim() ?? "";
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em);
    });
  }, [leads]);

  const latestThreadByLeadId = useMemo(() => {
    const map = new Map<string, (typeof threads)[number]>();
    for (const thread of threads) {
      const leadId = (thread as { lead_id?: string | null }).lead_id;
      if (leadId && !map.has(leadId)) {
        map.set(leadId, thread);
      }
    }
    return map;
  }, [threads]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return emailLeads;
    return emailLeads.filter((lead) => {
      const thread = latestThreadByLeadId.get(lead.id);
      const leadName = lead.name?.toLowerCase() ?? "";
      const leadEmail = lead.email?.toLowerCase() ?? "";
      const threadSubject = thread?.subject?.toLowerCase() ?? "";
      return leadName.includes(q) || leadEmail.includes(q) || threadSubject.includes(q);
    });
  }, [emailLeads, latestThreadByLeadId, search]);
  const EMAIL_LEADS_PER_PAGE = 8;
  const emailLeadTotalPages = Math.max(1, Math.ceil(filtered.length / EMAIL_LEADS_PER_PAGE));
  const pagedEmailLeads = filtered.slice((emailLeadPage - 1) * EMAIL_LEADS_PER_PAGE, emailLeadPage * EMAIL_LEADS_PER_PAGE);

  const unreadWaByLeadId = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of notifications) {
      if (n.type !== "whatsapp" || n.is_read || n.entity_type !== "lead" || !n.entity_id) continue;
      map.set(n.entity_id, (map.get(n.entity_id) ?? 0) + 1);
    }
    return map;
  }, [notifications]);

  const latestWaActivityByLeadId = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of notifications) {
      if (n.type !== "whatsapp" || n.entity_type !== "lead" || !n.entity_id) continue;
      const ts = new Date(n.created_at).getTime();
      const prev = map.get(n.entity_id) ?? 0;
      if (ts > prev) map.set(n.entity_id, ts);
    }
    return map;
  }, [notifications]);

  const filteredWaLeads = useMemo(() => {
    const q = waSearch.toLowerCase();
    const base = whatsappLeads.filter((l) => l.name.toLowerCase().includes(q) || (l.phone ?? "").includes(q));
    return [...base].sort((a, b) => {
      const unreadDiff = (unreadWaByLeadId.get(b.id) ?? 0) - (unreadWaByLeadId.get(a.id) ?? 0);
      if (unreadDiff !== 0) return unreadDiff;
      const lastDiff = (latestWaActivityByLeadId.get(b.id) ?? 0) - (latestWaActivityByLeadId.get(a.id) ?? 0);
      if (lastDiff !== 0) return lastDiff;
      return a.name.localeCompare(b.name);
    });
  }, [waSearch, whatsappLeads, unreadWaByLeadId, latestWaActivityByLeadId]);
  const WA_LEADS_PER_PAGE = 10;
  const waLeadTotalPages = Math.max(1, Math.ceil(filteredWaLeads.length / WA_LEADS_PER_PAGE));
  const pagedWaLeads = filteredWaLeads.slice((waLeadPage - 1) * WA_LEADS_PER_PAGE, waLeadPage * WA_LEADS_PER_PAGE);

  const markLeadWhatsAppNotificationsRead = async (leadId: string) => {
    const unreadIds = notifications
      .filter((n) => n.type === "whatsapp" && !n.is_read && n.entity_type === "lead" && n.entity_id === leadId)
      .map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  useEffect(() => {
    const channel = supabase
      .channel("whatsapp-live-updates")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "whatsapp_messages" }, () => {
        qc.invalidateQueries({ queryKey: ["whatsapp_messages"] });
        qc.invalidateQueries({ queryKey: ["notifications"] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "whatsapp_messages" }, () => {
        qc.invalidateQueries({ queryKey: ["whatsapp_messages"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "email" || tab === "whatsapp") {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    const leadFromParam = searchParams.get("lead");
    if (!leadFromParam || leads.length === 0) return;
    const exists = leads.some((l) => l.id === leadFromParam);
    if (!exists) return;
    setSelectedWaLeadId(leadFromParam);
    setActiveTab("whatsapp");
    void markLeadWhatsAppNotificationsRead(leadFromParam);
  }, [searchParams, leads, notifications]);

  useEffect(() => {
    if (!selectedWaLeadId || !waMessagesContainerRef.current) return;
    waMessagesContainerRef.current.scrollTo({
      top: waMessagesContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [selectedWaLeadId, waMessages.length]);

  useEffect(() => {
    setEmailLeadPage(1);
  }, [search, emailLeads.length, threads.length]);

  useEffect(() => {
    if (emailLeadPage > emailLeadTotalPages) setEmailLeadPage(emailLeadTotalPages);
  }, [emailLeadPage, emailLeadTotalPages]);

  useEffect(() => {
    setWaLeadPage(1);
  }, [waSearch, unreadWaByLeadId, latestWaActivityByLeadId]);

  useEffect(() => {
    if (waLeadPage > waLeadTotalPages) setWaLeadPage(waLeadTotalPages);
  }, [waLeadPage, waLeadTotalPages]);

  const formatWaStatus = (status?: string | null) => {
    if (!status) return "";
    const s = status.trim().toLowerCase();
    if (s === "sent") return "Sent";
    if (s === "delivered") return "Delivered";
    if (s === "read") return "Read";
    if (s === "failed") return "Failed";
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const handleSendReply = async () => {
    if (!selectedThreadId || (!reply.trim() && !replyHtml.trim()) || emailSending) return;
    setEmailSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("email-send", {
        body: {
          thread_id: selectedThreadId,
          message: reply.trim(),
          html: replyHtml.trim() || undefined,
          attachments: emailAttachments,
        },
      });
      if (error) {
        toast.error(error.message ?? "Email send failed");
        return;
      }
      if (data && typeof data === "object" && "error" in data) {
        toast.error(String((data as { error?: string }).error ?? "Email send failed"));
        return;
      }
      toast.success("Email sent");
      setReply("");
      setReplyHtml("");
      if (emailEditorRef.current) emailEditorRef.current.innerHTML = "";
      setEmailAttachments([]);
      qc.invalidateQueries({ queryKey: ["email_threads"] });
      qc.invalidateQueries({ queryKey: ["lead_activities"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Email send failed");
    } finally {
      setEmailSending(false);
    }
  };

  const handleEditorInput = () => {
    const html = emailEditorRef.current?.innerHTML ?? "";
    const text = emailEditorRef.current?.innerText ?? "";
    setReplyHtml(html);
    setReply(text.trim());
  };

  const runEditorCommand = (command: "bold" | "italic" | "underline" | "insertUnorderedList" | "insertOrderedList") => {
    if (!emailEditorRef.current) return;
    emailEditorRef.current.focus();
    document.execCommand(command, false);
    handleEditorInput();
  };

  const handlePickAttachments = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;

    const maxFileSize = 10 * 1024 * 1024;
    const converted: Array<{ name: string; type: string; size: number; content: string }> = [];
    for (const file of files) {
      if (file.size > maxFileSize) {
        toast.error(`${file.name} is larger than 10MB`);
        continue;
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result ?? ""));
        r.onerror = () => reject(new Error(`Failed to read ${file.name}`));
        r.readAsDataURL(file);
      });
      const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
      converted.push({
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        content: base64,
      });
    }
    if (!converted.length) return;
    setEmailAttachments((prev) => [...prev, ...converted]);
  };

  const selectOrCreateThreadForLead = async (leadId: string) => {
    const existing = latestThreadByLeadId.get(leadId);
    if (existing) {
      setSelectedThreadId(existing.id);
      if (existing.is_unread) void handleMarkRead(existing.id);
      return;
    }
    const lead = leads.find((l) => l.id === leadId);
    const subject = `Conversation with ${lead?.name?.trim() || "Lead"}`;
    const { data, error } = await supabase
      .from("email_threads")
      .insert({
        lead_id: leadId,
        subject,
        is_unread: false,
        last_message_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setSelectedThreadId(data.id);
    qc.invalidateQueries({ queryKey: ["email_threads"] });
  };

  const handleSendWhatsApp = async () => {
    if (!selectedWaLeadId || !waReply.trim()) return;
    setWaSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-send", {
        body: { lead_id: selectedWaLeadId, message: waReply.trim() },
      });
      if (error) {
        toast.error(error.message ?? "Send failed");
        return;
      }
      if (data && typeof data === "object" && "error" in data) {
        toast.error(String((data as { error?: string }).error ?? "Send failed"));
        return;
      }
      toast.success("WhatsApp sent");
      setWaReply("");
      qc.invalidateQueries({ queryKey: ["whatsapp_messages", selectedWaLeadId] });
      qc.invalidateQueries({ queryKey: ["lead_activities"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setWaSending(false);
    }
  };

  const handleMarkRead = async (threadId: string) => {
    await supabase.from("email_threads").update({ is_unread: false }).eq("id", threadId);
    qc.invalidateQueries({ queryKey: ["email_threads"] });
  };

  const handleAddTemplate = () => {
    if (!templateForm.name) return;
    setTemplates((prev) => [
      ...prev,
      {
        id: `t${Date.now()}`,
        name: templateForm.name,
        subject: templateForm.subject,
        category: templateForm.category,
        body: templateForm.body,
      },
    ]);
    toast.success("Template created");
    setShowNewTemplate(false);
    setTemplateForm({ name: "", subject: "", body: "", category: "Follow-up" });
  };

  const ThreadList = () => (
    <div className="space-y-2 md:space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>
      {pagedEmailLeads.map((lead) => {
        const thread = latestThreadByLeadId.get(lead.id);
        const leadName = lead.name ?? "Unknown";
        const messages = (thread as { email_messages?: { body?: string }[] } | undefined)?.email_messages ?? [];
        const lastMsg = messages.length > 0 ? messages[messages.length - 1]?.body : "";
        const isSelected = thread?.id ? selectedThreadId === thread.id : false;
        return (
          <Card
            key={lead.id}
            className={cn(
              "cursor-pointer p-3 transition-all hover:shadow-sm",
              isSelected && "border-primary ring-1 ring-primary/20",
            )}
            onClick={() => void selectOrCreateThreadForLead(lead.id)}
          >
            <div className="flex items-center gap-2 md:gap-3">
              {thread?.is_unread && <div className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-sm", thread?.is_unread ? "font-semibold" : "font-medium")}>{leadName}</p>
                <p className="truncate text-xs text-muted-foreground">{lead.email}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {lastMsg || "No messages yet. Click to start emailing this lead."}
                </p>
              </div>
              {thread?.last_message_at && (
                <span className="shrink-0 text-[10px] text-muted-foreground">{formatDateTime(thread.last_message_at)}</span>
              )}
            </div>
          </Card>
        );
      })}
      {filtered.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No leads with valid emails found</p>}
      {filtered.length > EMAIL_LEADS_PER_PAGE && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-muted-foreground">
            Page {emailLeadPage} of {emailLeadTotalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={emailLeadPage <= 1}
              onClick={() => setEmailLeadPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={emailLeadPage >= emailLeadTotalPages}
              onClick={() => setEmailLeadPage((p) => Math.min(emailLeadTotalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const ThreadDetail = () =>
    selectedThread ? (
      <Card className="p-4 md:p-5">
        {isMobile && (
          <button type="button" onClick={() => setSelectedThreadId(null)} className="mb-3 flex items-center gap-1 text-sm text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        )}
        <div className="mb-4 border-b border-border pb-3">
          <h3 className="font-heading text-sm font-semibold md:text-base">{selectedThread.subject}</h3>
          <p className="text-xs text-muted-foreground md:text-sm">
            Conversation with {(selectedThread as { leads?: { name?: string } }).leads?.name ?? "Unknown"}
          </p>
        </div>
        <div className="max-h-[50vh] space-y-3 overflow-y-auto md:max-h-[400px]">
          {((selectedThread as { email_messages?: { id?: string; body?: string; direction?: string; created_at?: string }[] }).email_messages ?? []).map(
            (msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn("flex gap-2 md:gap-3", msg.direction === "outbound" && "flex-row-reverse")}
              >
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback
                    className={cn(
                      "text-[10px] font-semibold",
                      msg.direction === "outbound" ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground",
                    )}
                  >
                    {msg.direction === "outbound"
                      ? "ME"
                      : ((selectedThread as { leads?: { name?: string } }).leads?.name ?? "?")
                          .split(" ")
                          .map((n: string) => n[0])
                          .join("")}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg p-2.5 text-sm md:max-w-[70%] md:p-3",
                    msg.direction === "outbound" ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  <p className="text-xs md:text-sm">{msg.body}</p>
                  <p className={cn("mt-1 text-[10px]", msg.direction === "outbound" ? "text-primary-foreground/60" : "text-muted-foreground")}>
                    {msg.created_at ? formatDateTime(msg.created_at) : ""}
                  </p>
                </div>
              </motion.div>
            ),
          )}
        </div>
        <div className="mt-3 space-y-2 md:mt-4">
          <div className="flex items-center gap-2 rounded-md border p-2">
            <Button type="button" size="sm" variant="outline" onClick={() => runEditorCommand("bold")} disabled={emailSending}>
              B
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => runEditorCommand("italic")} disabled={emailSending}>
              I
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => runEditorCommand("underline")} disabled={emailSending}>
              U
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => runEditorCommand("insertUnorderedList")} disabled={emailSending}>
              • List
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => runEditorCommand("insertOrderedList")} disabled={emailSending}>
              1. List
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="ml-auto"
              onClick={() => emailAttachmentInputRef.current?.click()}
              disabled={emailSending}
            >
              <Paperclip className="mr-1 h-4 w-4" /> Attach
            </Button>
            <input
              ref={emailAttachmentInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handlePickAttachments}
            />
          </div>
          <div
            ref={emailEditorRef}
            contentEditable={!emailSending}
            onInput={handleEditorInput}
            className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            data-placeholder="Type your reply…"
            suppressContentEditableWarning
          />
          {emailAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {emailAttachments.map((a, idx) => (
                <div key={`${a.name}-${idx}`} className="flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
                  <span className="max-w-[220px] truncate">{a.name}</span>
                  <button
                    type="button"
                    onClick={() => setEmailAttachments((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={`Remove ${a.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleSendReply}
              disabled={(!reply.trim() && !replyHtml.trim()) || emailSending}
            >
              <Send className="mr-1 h-4 w-4" /> Send
            </Button>
          </div>
        </div>
      </Card>
    ) : (
      <Card className="flex h-48 items-center justify-center p-5 md:h-64">
        <div className="text-center">
          <Mail className="mx-auto h-8 w-8 text-muted-foreground/30 md:h-10 md:w-10" />
          <p className="mt-2 text-sm text-muted-foreground">Select a conversation</p>
        </div>
      </Card>
    );

  const WaLeadList = () => (
    <div className="space-y-2 md:space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search leads…" value={waSearch} onChange={(e) => setWaSearch(e.target.value)} className="pl-10" />
      </div>
      {pagedWaLeads.map((l) => (
        <Card
          key={l.id}
          className={cn(
            "cursor-pointer p-3 transition-all hover:shadow-sm",
            selectedWaLeadId === l.id && "border-primary ring-1 ring-primary/20",
          )}
          onClick={() => {
            setSelectedWaLeadId(l.id);
            void markLeadWhatsAppNotificationsRead(l.id);
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 flex-1 truncate text-sm font-medium">{l.name || "Unnamed lead"}</p>
            {(unreadWaByLeadId.get(l.id) ?? 0) > 0 && (
              <Badge variant="destructive" className="h-5 min-w-5 justify-center px-1.5 text-[10px]">
                {unreadWaByLeadId.get(l.id)}
              </Badge>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">{l.phone}</p>
        </Card>
      ))}
      {filteredWaLeads.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">No leads with a valid phone number in your access scope.</p>
      )}
      {filteredWaLeads.length > WA_LEADS_PER_PAGE && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-muted-foreground">
            Page {waLeadPage} of {waLeadTotalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={waLeadPage <= 1}
              onClick={() => setWaLeadPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={waLeadPage >= waLeadTotalPages}
              onClick={() => setWaLeadPage((p) => Math.min(waLeadTotalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const WaDetail = () =>
    selectedWaLead ? (
      <Card className="p-4 md:p-5">
        {isMobile && (
          <button type="button" onClick={() => setSelectedWaLeadId(null)} className="mb-3 flex items-center gap-1 text-sm text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        )}
        <div className="mb-4 border-b border-border pb-3">
          <h3 className="font-heading text-sm font-semibold md:text-base">WhatsApp · {selectedWaLead.name}</h3>
          <p className="text-xs text-muted-foreground md:text-sm">{selectedWaLead.phone}</p>
        </div>
        <div ref={waMessagesContainerRef} className="max-h-[50vh] space-y-3 overflow-y-auto md:max-h-[400px]">
          {waLoading && <p className="text-sm text-muted-foreground">Loading messages…</p>}
          {!waLoading &&
            waMessages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn("flex gap-2 md:gap-3", msg.direction === "outbound" && "flex-row-reverse")}
              >
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback
                    className={cn(
                      "text-[10px] font-semibold",
                      msg.direction === "outbound" ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground",
                    )}
                  >
                    {msg.direction === "outbound" ? "ME" : "WA"}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg p-2.5 text-sm md:max-w-[70%] md:p-3",
                    msg.direction === "outbound" ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  <p className="text-xs md:text-sm">{msg.body}</p>
                  <p className={cn("mt-1 text-[10px]", msg.direction === "outbound" ? "text-primary-foreground/60" : "text-muted-foreground")}>
                    {formatDateTime(msg.created_at)}
                    {msg.direction === "outbound" && msg.provider_status ? ` · ${formatWaStatus(msg.provider_status)}` : ""}
                  </p>
                </div>
              </motion.div>
            ))}
          {!waLoading && waMessages.length === 0 && (
            <p className="text-sm text-muted-foreground">No messages yet. Send below or wait for the lead to reply on WhatsApp.</p>
          )}
        </div>
        <div className="mt-3 flex gap-2 md:mt-4">
          <Textarea
            placeholder="Type a WhatsApp message…"
            value={waReply}
            onChange={(e) => setWaReply(e.target.value)}
            className="flex-1"
            disabled={waSending}
          />
          <Button size="sm" onClick={handleSendWhatsApp} disabled={!waReply.trim() || waSending}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    ) : (
      <Card className="flex h-48 items-center justify-center p-5 md:h-64">
        <div className="text-center">
          <MessageCircle className="mx-auto h-8 w-8 text-muted-foreground/30 md:h-10 md:w-10" />
          <p className="mt-2 text-sm text-muted-foreground">Select a lead with a phone number</p>
        </div>
      </Card>
    );

  return (
    <PageShell title="Communications" subtitle="Email threads and company WhatsApp (one business number)">
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          const nextTab = value === "whatsapp" ? "whatsapp" : "email";
          setActiveTab(nextTab);
          const next = new URLSearchParams(searchParams);
          next.set("tab", nextTab);
          setSearchParams(next, { replace: true });
        }}
      >
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-1.5">
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="mt-4">
          <Tabs defaultValue="inbox">
            <TabsList>
              <TabsTrigger value="inbox">Inbox</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
            </TabsList>
            <TabsContent value="inbox" className="mt-4">
              {isMobile ? (
                selectedThread ? (
                  ThreadDetail()
                ) : (
                  ThreadList()
                )
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <div>{ThreadList()}</div>
                  <div className="lg:col-span-2">{ThreadDetail()}</div>
                </div>
              )}
            </TabsContent>
            <TabsContent value="templates" className="mt-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-heading text-sm font-semibold md:text-base">Email Templates</h3>
                <Button size="sm" onClick={() => setShowNewTemplate(true)}>
                  <Plus className="mr-1.5 h-4 w-4" /> New Template
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {templates.map((template) => (
                  <Card
                    key={template.id}
                    className="flex cursor-pointer items-center justify-between gap-2 p-3 transition-shadow hover:shadow-sm md:p-4"
                    onClick={() => {
                      setSelectedTemplateId(template.id);
                      setShowTemplatePreview(true);
                    }}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent">
                        <FileText className="h-5 w-5 text-accent-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{template.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{template.subject}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {template.category}
                    </Badge>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="whatsapp" className="mt-4">
          {isMobile ? (
            selectedWaLeadId ? (
              WaDetail()
            ) : (
              WaLeadList()
            )
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div>{WaLeadList()}</div>
              <div className="lg:col-span-2">{WaDetail()}</div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showNewTemplate} onOpenChange={setShowNewTemplate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Email Template</DialogTitle>
            <DialogDescription>
              Define a reusable email template with subject, category, and body.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label>Template Name</Label>
              <Input
                placeholder="e.g. Welcome Email"
                value={templateForm.name}
                onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Subject Line</Label>
              <Input placeholder="Subject…" value={templateForm.subject} onChange={(e) => setTemplateForm((f) => ({ ...f, subject: e.target.value }))} />
            </div>
            <div>
              <Label>Category</Label>
              <Input placeholder="Follow-up" value={templateForm.category} onChange={(e) => setTemplateForm((f) => ({ ...f, category: e.target.value }))} />
            </div>
            <div>
              <Label>Body</Label>
              <Textarea
                placeholder="Email body…"
                value={templateForm.body}
                onChange={(e) => setTemplateForm((f) => ({ ...f, body: e.target.value }))}
                className="min-h-[100px]"
              />
            </div>
            <Button className="w-full" onClick={handleAddTemplate} disabled={!templateForm.name}>
              Create Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={showTemplatePreview} onOpenChange={setShowTemplatePreview}>
        <SheetContent side="right" className="w-full p-0 sm:max-w-xl">
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b px-4 py-4 md:px-6">
              <SheetTitle>{selectedTemplate?.name ?? "Template Preview"}</SheetTitle>
              <SheetDescription>Preview of the selected email template</SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
              <Card className="space-y-3 p-4 md:p-5">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Category</p>
                  <p className="mt-1 text-sm font-medium">{selectedTemplate?.category ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Subject</p>
                  <p className="mt-1 text-sm font-medium">{selectedTemplate?.subject || "No subject provided"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Body</p>
                  <div className="mt-1 rounded-md border bg-muted/20 p-3">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {selectedTemplate?.body?.trim() || "No body content provided for this template."}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </PageShell>
  );
}

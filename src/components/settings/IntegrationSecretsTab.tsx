import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, KeyRound } from "lucide-react";

type SecretRow = Tables<"integration_secrets">;

const SLUG_PATTERN = /^[a-z][a-z0-9_]*$/;

const SUGGESTED_SLUGS = [
  { slug: "whatsapp_verify_token", label: "WhatsApp verify token" },
  { slug: "whatsapp_access_token", label: "WhatsApp access token" },
  { slug: "whatsapp_phone_number_id", label: "WhatsApp phone number ID" },
  { slug: "whatsapp_app_secret", label: "WhatsApp app secret" },
  { slug: "webpush_vapid_public_jwk", label: "Web push VAPID public JWK (JSON)" },
  { slug: "webpush_vapid_private_jwk", label: "Web push VAPID private JWK (JSON)" },
  { slug: "webpush_vapid_contact", label: "Web push contact (mailto:...)" },
  { slug: "pf_client_id", label: "Property Finder client ID" },
  { slug: "pf_client_secret", label: "Property Finder client secret" },
  { slug: "pf_sync_cron_secret", label: "Property Finder sync cron secret" },
  { slug: "resend_api_key", label: "Resend API key" },
  { slug: "resend_from_domain", label: "Resend verified sending domain (example: yourdomain.com)" },
  { slug: "resend_reply_inbox", label: "Inbound reply mailbox (example: inbox@yourdomain.com)" },
  { slug: "resend_inbound_token", label: "Resend inbound webhook token" },
];

function maskValue(v: string): string {
  const t = v.trim();
  if (!t) return "—";
  if (t.length <= 4) return "••••";
  return `••••••••${t.slice(-4)}`;
}

export function IntegrationSecretsTab() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["integration_secrets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("integration_secrets").select("*").order("label");
      if (error) throw error;
      return data as SecretRow[];
    },
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SecretRow | null>(null);
  const [form, setForm] = useState({ slug: "", label: "", description: "", value: "" });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm({ slug: "", label: "", description: "", value: "" });
    setDialogOpen(true);
  };

  const openEdit = (row: SecretRow) => {
    setEditing(row);
    setForm({
      slug: row.slug,
      label: row.label,
      description: row.description ?? "",
      value: row.value,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const slug = form.slug.trim();
    if (!slug || !SLUG_PATTERN.test(slug)) {
      toast.error("Slug must be lowercase letters, numbers, underscores (e.g. my_api_key)");
      return;
    }
    if (!form.label.trim()) {
      toast.error("Label is required");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from("integration_secrets")
          .update({
            label: form.label.trim(),
            description: form.description.trim() || null,
            value: form.value,
          })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Secret updated");
      } else {
        const { error } = await supabase.from("integration_secrets").insert({
          slug,
          label: form.label.trim(),
          description: form.description.trim() || null,
          value: form.value,
        });
        if (error) throw error;
        toast.success("Secret created");
      }
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["integration_secrets"] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("integration_secrets").delete().eq("id", deleteId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Secret removed");
    setDeleteId(null);
    qc.invalidateQueries({ queryKey: ["integration_secrets"] });
  };

  const existingSlugs = new Set(rows.map((r) => r.slug));

  return (
    <div className="space-y-4">
      <Card className="p-4 md:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-heading text-sm md:text-base font-semibold flex items-center gap-2">
              <KeyRound className="h-4 w-4" /> Integration secrets
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Stored in Supabase (management roles only). Edge Functions use project env vars first, then these values. After changes, redeploy is not required — functions read the table at runtime.
            </p>
          </div>
          <Button size="sm" className="shrink-0 self-end sm:self-start" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" /> Add secret
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead className="hidden md:table-cell">Slug</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <p className="font-medium text-sm">{row.label}</p>
                    {row.description && <p className="text-xs text-muted-foreground line-clamp-2">{row.description}</p>}
                    <code className="text-[10px] text-muted-foreground md:hidden">{row.slug}</code>
                  </TableCell>
                  <TableCell className="hidden md:table-cell font-mono text-xs">{row.slug}</TableCell>
                  <TableCell className="font-mono text-xs">{maskValue(row.value)}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(row)} aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(row.id)} aria-label="Delete">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!isLoading && rows.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No secrets yet. Add one or run the latest database migration to seed defaults.</p>
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit secret" : "Add secret"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            {!editing && (
              <div>
                <Label>Suggested keys</Label>
                <select
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value=""
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return;
                    const s = SUGGESTED_SLUGS.find((x) => x.slug === v);
                    setForm((f) => ({ ...f, slug: v, label: s?.label ?? f.label }));
                    e.target.value = "";
                  }}
                >
                  <option value="">Pick a preset (optional)…</option>
                  {SUGGESTED_SLUGS.filter((s) => !existingSlugs.has(s.slug)).map((s) => (
                    <option key={s.slug} value={s.slug}>
                      {s.label} ({s.slug})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <Label>Slug</Label>
              <Input
                className="mt-1 font-mono text-sm"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                disabled={!!editing}
                placeholder="e.g. whatsapp_access_token"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Lowercase, numbers, underscores. Cannot change after create.</p>
            </div>
            <div>
              <Label>Label</Label>
              <Input className="mt-1" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="Display name" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea className="mt-1 min-h-[60px]" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional" />
            </div>
            <div>
              <Label>Value</Label>
              <Input
                className="mt-1 font-mono text-sm"
                type="password"
                autoComplete="off"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                placeholder="Secret value"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Close
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this secret?</AlertDialogTitle>
            <AlertDialogDescription>Integrations that rely on this key may stop working until you add it again.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

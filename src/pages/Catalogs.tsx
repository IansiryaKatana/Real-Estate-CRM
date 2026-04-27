import { useState, useRef, useMemo } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { useProperties, useCatalogTemplates, formatCurrency } from "@/hooks/useSupabaseData";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Download, Share2, Eye, Home, MapPin, Loader2, Trash2, Copy, LayoutTemplate, FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CATALOG_PF_FIELDS,
  CATALOG_LAYOUTS,
  CATALOG_PRESETS,
  parseTemplateFields,
  serializeTemplateFields,
  type CatalogLayoutId,
} from "@/lib/catalogFields";

function PropertyThumb({ images }: { images: string[] | null }) {
  const [err, setErr] = useState(false);
  const src = images?.[0];
  if (!src || err) {
    return <div className="h-10 w-10 rounded-md bg-muted shrink-0 flex items-center justify-center"><Home className="h-4 w-4 text-muted-foreground/40" /></div>;
  }
  return <img src={src} alt="" className="h-10 w-10 rounded-md object-cover shrink-0" loading="lazy" onError={() => setErr(true)} />;
}

export default function CatalogsPage() {
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [catalogLayout, setCatalogLayout] = useState<CatalogLayoutId>("brochure");
  const [selectedFields, setSelectedFields] = useState<string[]>(() => CATALOG_PRESETS.find((p) => p.id === "pf-photos-first")?.fieldKeys ?? ["photos", "price_aed", "location", "property_type", "bedrooms", "bathrooms", "area_sqft", "description"]);
  const [templateName, setTemplateName] = useState("");
  const [templateType, setTemplateType] = useState("buyer");
  const [generating, setGenerating] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const qc = useQueryClient();

  const { data: properties = [] } = useProperties();
  const { data: templates = [] } = useCatalogTemplates();

  const available = useMemo(() => properties.filter((p) => p.status === "available"), [properties]);

  const toggleProperty = (id: string) => setSelectedProperties((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  const toggleField = (id: string) => setSelectedFields((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));

  type CatalogOutput = "html" | "pdf" | "docx";

  function base64ToBlob(base64: string, mime: string): Blob {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  const invokeCatalog = async (output: CatalogOutput) => {
    if (selectedProperties.length === 0) {
      toast.error("Select at least one property first.");
      throw new Error("No properties selected");
    }
    const rawFields = selectedFields as unknown;
    const fieldsPayload = Array.isArray(rawFields)
      ? rawFields
      : rawFields && typeof rawFields === "object" && rawFields !== null && "fieldKeys" in rawFields
        ? (rawFields as { fieldKeys: string[] }).fieldKeys
        : [];
    const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
    const { data, error } = await supabase.functions.invoke("generate-catalog", {
      body: {
        propertyIds: selectedProperties,
        fields: fieldsPayload,
        templateName: templateName || "Property Catalog",
        templateType,
        layout: catalogLayout,
        output,
      },
      headers: publishableKey ? { Authorization: `Bearer ${publishableKey}` } : undefined,
    });
    if (error) throw error;
    const payload = data as {
      ok?: boolean;
      error?: string;
      html?: string;
      pdfBase64?: string;
      docxBase64?: string;
      propertyCount?: number;
      layout?: string;
    };
    if (payload?.ok === false && payload?.error) {
      throw new Error(payload.error);
    }
    if (payload?.error && !payload.html && !payload.pdfBase64 && !payload.docxBase64) {
      throw new Error(payload.error);
    }
    return payload;
  };

  /** Loads HTML for preview and caches it in state. */
  const generateCatalogHtml = async (): Promise<string | null> => {
    setGenerating(true);
    try {
      const data = await invokeCatalog("html");
      if (!data?.html) throw new Error("No catalog HTML returned");
      setPreviewHtml(data.html);
      toast.success(`Catalog ready (${data.propertyCount ?? 0} properties)`);
      return data.html;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate catalog";
      toast.error(msg);
      return null;
    } finally {
      setGenerating(false);
    }
  };

  const downloadPdf = async () => {
    setGenerating(true);
    try {
      const data = await invokeCatalog("pdf");
      if (!data?.pdfBase64) throw new Error("No PDF returned");
      const blob = base64ToBlob(data.pdfBase64, "application/pdf");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(templateName || "catalog").replace(/\s+/g, "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to download PDF");
    } finally {
      setGenerating(false);
    }
  };

  const downloadDocx = async () => {
    setGenerating(true);
    try {
      const data = await invokeCatalog("docx");
      if (!data?.docxBase64) throw new Error("No Word document returned");
      const blob = base64ToBlob(data.docxBase64, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(templateName || "catalog").replace(/\s+/g, "-")}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Word document downloaded");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to download document");
    } finally {
      setGenerating(false);
    }
  };

  const handlePreview = async () => {
    const html = await generateCatalogHtml();
    if (html) setShowPreview(true);
  };

  const handleShare = async () => {
    setGenerating(true);
    try {
      const data = await invokeCatalog("pdf");
      if (!data?.pdfBase64) throw new Error("Could not generate PDF to share");
      const blob = base64ToBlob(data.pdfBase64, "application/pdf");
      const name = `${(templateName || "catalog").replace(/\s+/g, "-")}.pdf`;
      const file = new File([blob], name, { type: "application/pdf" });
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({ title: templateName || "Property Catalog", files: [file] });
          toast.success("Shared successfully");
          return;
        } catch (e) {
          if ((e as Error).name === "AbortError") return;
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded (use system share from your files if needed)");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Sharing failed");
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    iframeRef.current?.contentWindow?.print();
  };

  const applyPreset = (presetId: string) => {
    const p = CATALOG_PRESETS.find((x) => x.id === presetId);
    if (!p) return;
    setCatalogLayout(p.layout);
    setSelectedFields([...p.fieldKeys]);
    setTemplateType(p.template_type);
    setTemplateName((n) => n || p.name);
    toast.success(`Applied: ${p.name}`);
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast.error("Enter a template name");
      return;
    }
    const { error } = await supabase.from("catalog_templates").insert({
      name: templateName.trim(),
      template_type: templateType,
      fields: serializeTemplateFields(selectedFields, catalogLayout) as import("@/integrations/supabase/types").Json,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Template saved");
    qc.invalidateQueries({ queryKey: ["catalog_templates"] });
  };

  const handleDeleteTemplate = async (id: string) => {
    const { error } = await supabase.from("catalog_templates").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Template deleted");
    qc.invalidateQueries({ queryKey: ["catalog_templates"] });
  };

  const handleLoadTemplate = (template: { name: string; template_type: string; fields: unknown }) => {
    const { fieldKeys, layout } = parseTemplateFields(template.fields);
    setTemplateName(template.name);
    setTemplateType(template.template_type);
    setCatalogLayout(layout);
    setSelectedFields(fieldKeys.length ? fieldKeys : selectedFields);
    toast.success(`Loaded: ${template.name}`);
  };

  const selectAll = () => setSelectedProperties(available.map((p) => p.id));
  const clearAll = () => setSelectedProperties([]);

  return (
    <PageShell title="Catalog exports" subtitle="Inter Tight layout — PDF & Word; preview uses HTML with listing photos">
      <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4 md:p-5">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <h3 className="font-heading text-sm md:text-base font-semibold">Starter templates</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Pre-filled field sets from synced PF columns. Adjust below after applying.</p>
            <div className="flex flex-wrap gap-2">
              {CATALOG_PRESETS.map((p) => (
                <Button key={p.id} variant="outline" size="sm" className="text-xs h-8" onClick={() => applyPreset(p.id)}>
                  <LayoutTemplate className="mr-1 h-3.5 w-3.5 shrink-0" />
                  {p.name}
                </Button>
              ))}
            </div>
          </Card>

          <Card className="p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading text-sm md:text-base font-semibold">Select properties</h3>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={selectAll}>
                  Select all
                </Button>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={clearAll}>
                  Clear
                </Button>
              </div>
            </div>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {available.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No available properties</p>}
              {available.map((property) => (
                <label
                  key={property.id}
                  className="flex items-center gap-2 md:gap-3 rounded-lg border border-border p-2.5 md:p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <Checkbox checked={selectedProperties.includes(property.id)} onCheckedChange={() => toggleProperty(property.id)} />
                  <PropertyThumb images={property.images} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{property.title}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{property.location}</span>
                      {property.emirate ? <span className="text-muted-foreground/80">· {property.emirate}</span> : null}
                    </p>
                  </div>
                  <p className="text-sm font-semibold shrink-0">{formatCurrency(Number(property.price))}</p>
                </label>
              ))}
            </div>
          </Card>

          <Card className="p-4 md:p-5">
            <h3 className="font-heading text-sm md:text-base font-semibold mb-1">Fields (from Property Finder / database)</h3>
            <p className="text-xs text-muted-foreground mb-3">Only data that exists on the property row is shown. Photos use the <code className="text-[10px]">images</code> array from sync.</p>
            <div className="flex flex-wrap gap-2">
              {CATALOG_PF_FIELDS.map((f) => (
                <Badge
                  key={f.id}
                  variant={selectedFields.includes(f.id) ? "default" : "outline"}
                  className="cursor-pointer transition-colors text-xs font-normal"
                  title={f.hint}
                  onClick={() => toggleField(f.id)}
                >
                  {f.label}
                </Badge>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4 md:p-5">
            <h3 className="font-heading text-sm md:text-base font-semibold mb-2">Generate catalog</h3>
            <p className="text-xs md:text-sm text-muted-foreground mb-3">
              {selectedProperties.length} properties · {selectedFields.length} fields · layout: {catalogLayout}
            </p>
            <div className="space-y-3">
              <div>
                <Label>Catalog title</Label>
                <Input placeholder="My catalog" className="mt-1" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
              </div>
              <div>
                <Label>Audience</Label>
                <Select value={templateType} onValueChange={setTemplateType}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="investor">Investor</SelectItem>
                    <SelectItem value="buyer">Buyer</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Layout</Label>
                <Select value={catalogLayout} onValueChange={(v) => setCatalogLayout(v as CatalogLayoutId)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATALOG_LAYOUTS.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.label} — {l.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button className="w-full" disabled={selectedProperties.length === 0 || generating} onClick={downloadPdf}>
                  {generating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileDown className="mr-1.5 h-4 w-4" />}
                  Download PDF
                </Button>
                <Button className="w-full" variant="secondary" disabled={selectedProperties.length === 0 || generating} onClick={downloadDocx}>
                  {generating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileText className="mr-1.5 h-4 w-4" />}
                  Download Word
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" size="sm" disabled={selectedProperties.length === 0 || generating} onClick={handlePreview}>
                  <Eye className="mr-1 h-4 w-4" /> Preview
                </Button>
                <Button variant="outline" className="flex-1" size="sm" disabled={selectedProperties.length === 0 || generating} onClick={handleShare}>
                  <Share2 className="mr-1 h-4 w-4" /> Share PDF
                </Button>
              </div>
              <Button variant="secondary" className="w-full" size="sm" onClick={handleSaveTemplate} disabled={!templateName.trim()}>
                <Copy className="mr-1 h-4 w-4" /> Save as template
              </Button>
            </div>
          </Card>

          <Card className="p-4 md:p-5">
            <h3 className="font-heading text-sm md:text-base font-semibold mb-3">Saved templates</h3>
            <div className="space-y-2">
              {templates.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No saved templates</p>}
              {templates.map((template) => {
                const parsed = parseTemplateFields(template.fields);
                return (
                  <div key={template.id} className="flex items-center gap-2 rounded-lg border border-border p-2.5 md:p-3 hover:shadow-sm transition-shadow">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleLoadTemplate(template)}>
                      <p className="text-sm font-medium truncate">{template.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {template.template_type} · {parsed.fieldKeys.length} fields · {parsed.layout}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive" onClick={() => handleDeleteTemplate(template.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </Card>

          <p className="text-[11px] text-muted-foreground px-1">
            If generation returns 401, deploy <code className="text-[10px]">generate-catalog</code> and set{" "}
            <code className="text-[10px]">verify_jwt = false</code> in Supabase config (included in repo <code className="text-[10px]">config.toml</code>).
          </p>
        </div>
      </div>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0 sm:rounded-lg">
          <DialogHeader className="px-4 pt-4 pb-2 flex-row items-center justify-between space-y-0 border-b border-border">
            <div className="space-y-1.5 text-left">
              <DialogTitle className="font-heading">Catalog preview</DialogTitle>
              <DialogDescription className="sr-only">
                On-screen preview of the catalog layout. Download PDF or Word from the main panel for client-ready files.
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handlePrint}>
                <Download className="mr-1 h-4 w-4" /> Print
              </Button>
              <Button size="sm" onClick={handleShare}>
                <Share2 className="mr-1 h-4 w-4" /> Share PDF
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden px-4 pb-4 pt-2">
            {previewHtml && (
              <iframe ref={iframeRef} srcDoc={previewHtml} className="w-full h-full min-h-[60vh] rounded-lg border border-border bg-white" title="Catalog preview" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

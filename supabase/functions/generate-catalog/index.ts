import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import {
  buildCatalogDocx,
  buildCatalogHtml,
  buildCatalogPdf,
  normalizeFieldKeysOrdered,
  uint8ToBase64,
} from "./catalogBuild.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export type CatalogOutput = "html" | "pdf" | "docx";

function parsePropertyIds(body: Record<string, unknown>): string[] {
  const raw = body.propertyIds ?? body.property_ids;
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw.split(/[\s,]+/).filter((s) => s.length > 0);
  }
  return [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      fields: rawFields,
      templateName,
      templateType,
      layout: layoutRaw,
      output: outputRaw,
    } = body;

    const output: CatalogOutput = ["html", "pdf", "docx"].includes(String(outputRaw))
      ? (outputRaw as CatalogOutput)
      : "html";

    const propertyIds = parsePropertyIds(body);
    const fieldKeysOrdered = normalizeFieldKeysOrdered(rawFields);

    /** Use 200 so supabase-js returns `data` (not FunctionsHttpError); client checks `error` field. */
    if (propertyIds.length === 0) {
      return new Response(
        JSON.stringify({
          error: "No properties selected",
          propertyCount: 0,
          ok: false,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const layout = typeof layoutRaw === "string" ? layoutRaw : "brochure";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: properties, error } = await supabase.from("properties").select("*").in("id", propertyIds);

    if (error) throw error;

    const rows = (properties || []) as Record<string, unknown>[];

    const payload: Record<string, unknown> = {
      ok: true,
      propertyCount: rows.length,
      layout,
    };

    if (output === "html" || output === "pdf" || output === "docx") {
      if (output === "html") {
        payload.html = buildCatalogHtml(rows, templateName, templateType, layout, fieldKeysOrdered);
      }
      if (output === "pdf") {
        const pdfBytes = await buildCatalogPdf(rows, templateName, templateType, layout, fieldKeysOrdered);
        payload.pdfBase64 = uint8ToBase64(pdfBytes);
      }
      if (output === "docx") {
        const docxBuf = await buildCatalogDocx(rows, templateName, templateType, layout, fieldKeysOrdered);
        payload.docxBase64 = uint8ToBase64(new Uint8Array(docxBuf));
      }
    }

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

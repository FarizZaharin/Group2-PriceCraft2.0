import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const VALID_CATEGORIES = [
  "Prelims",
  "Labour",
  "Material",
  "Equipment",
  "Subcon",
  "Other",
];

const VALID_CONFIDENCE = ["high", "medium", "low"];

const SYSTEM_PROMPT = `You are an expert quantity surveyor and cost estimator. Your job is to analyze a Scope of Work (SOW) document and generate a structured Bill of Quantities (BoQ) draft.

RULES:
- Generate realistic line items grouped by logical sections
- Use standard units of measurement: LS, m, m2, m3, unit, lot, day, hour, kg, tonne
- Categories must be one of: Prelims, Labour, Material, Equipment, Subcon, Other
- When quantities cannot be derived from the SOW, use null and note "TBC" in measurement
- Do not invent regulations or standards; flag items needing confirmation
- Avoid vendor brand names unless present in the SOW
- Include measurement basis/methodology where possible
- Include assumptions where quantities are estimated
- Prefer placeholders/ranges when quantities are not derivable
- Always consider preliminary items (mobilization, site setup, safety, etc.)

Respond with ONLY a valid JSON object in this exact format:
{
  "rows": [
    {
      "section": "Section name",
      "description": "Line item description",
      "uom": "unit of measurement",
      "qty": null,
      "measurement": "How this quantity was derived or TBC",
      "category": "One of the standard categories",
      "confidence": "high | medium | low"
    }
  ]
}`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "AI service not configured. OPENAI_API_KEY is required.",
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body = await req.json();
    const { sowText, category, duration, location, estimateClass } = body;

    if (!sowText || sowText.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "SOW text is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let userPrompt = `Analyze the following Scope of Work and generate a draft Bill of Quantities:\n\n--- SOW START ---\n${sowText}\n--- SOW END ---`;

    if (category) userPrompt += `\n\nProject Category: ${category}`;
    if (duration) userPrompt += `\nProject Duration: ${duration}`;
    if (location) userPrompt += `\nProject Location: ${location}`;
    if (estimateClass) userPrompt += `\nEstimate Class: ${estimateClass}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 8192,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({
          error: `AI service returned ${response.status}`,
          details: errorText,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ error: "Empty response from AI service" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const rows = (parsed.rows || []).map((row: Record<string, unknown>) => ({
      section: String(row.section || ""),
      description: String(row.description || ""),
      uom: String(row.uom || "LS"),
      qty: typeof row.qty === "number" ? row.qty : null,
      measurement: String(row.measurement || ""),
      category: VALID_CATEGORIES.includes(row.category as string)
        ? row.category
        : "Other",
      confidence: VALID_CONFIDENCE.includes(row.confidence as string)
        ? row.confidence
        : "medium",
    }));

    return new Response(
      JSON.stringify({
        rows,
        model: aiResponse.model || "gpt-4o",
        usage: aiResponse.usage || {},
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: String(err),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

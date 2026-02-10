import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SYSTEM_PROMPT = `You are an expert quantity surveyor and cost estimator reviewing a Scope of Work (SOW) document. Your job is to identify gaps, ambiguities, and suggest improvements.

Analyze the SOW and provide:

1. MISSING ITEMS: Components or work items that are commonly required but appear to be missing from the SOW. Be specific about what is missing and why it matters.

2. CLARIFICATION QUESTIONS: Questions the estimator should ask the client to resolve ambiguities or missing information in the SOW.

3. SUGGESTED ASSUMPTIONS & EXCLUSIONS: Reasonable assumptions that should be documented, and items that should be explicitly excluded to protect the estimator.

RULES:
- Be practical and specific, not generic
- Reference specific parts of the SOW where relevant
- Do not invent regulations; flag areas where regulatory compliance may need verification
- Focus on items that would materially affect the estimate

Respond with ONLY a valid JSON object in this exact format:
{
  "missingItems": [
    { "item": "Description of missing item", "severity": "high | medium | low", "rationale": "Why this matters" }
  ],
  "clarificationQuestions": [
    { "question": "The question to ask", "context": "Which part of SOW this relates to" }
  ],
  "suggestedAssumptions": [
    { "assumption": "The assumption text", "type": "assumption | exclusion" }
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
    const { sowText, category } = body;

    if (!sowText || sowText.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "SOW text is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let userPrompt = `Analyze the following Scope of Work for gaps, ambiguities, and suggest assumptions/exclusions:\n\n--- SOW START ---\n${sowText}\n--- SOW END ---`;

    if (category) userPrompt += `\n\nProject Category: ${category}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 4096,
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

    const result = {
      missingItems: (parsed.missingItems || []).map(
        (item: Record<string, unknown>) => ({
          item: String(item.item || ""),
          severity: ["high", "medium", "low"].includes(
            item.severity as string
          )
            ? item.severity
            : "medium",
          rationale: String(item.rationale || ""),
        })
      ),
      clarificationQuestions: (parsed.clarificationQuestions || []).map(
        (q: Record<string, unknown>) => ({
          question: String(q.question || ""),
          context: String(q.context || ""),
        })
      ),
      suggestedAssumptions: (parsed.suggestedAssumptions || []).map(
        (a: Record<string, unknown>) => ({
          assumption: String(a.assumption || ""),
          type: a.type === "exclusion" ? "exclusion" : "assumption",
        })
      ),
      model: aiResponse.model || "gpt-4o",
      usage: aiResponse.usage || {},
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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

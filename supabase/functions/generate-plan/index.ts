// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Subject {
  name: string;
  syllabus: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { subjects, days, hoursPerDay } = (await req.json()) as {
      subjects: Subject[];
      days: number;
      hoursPerDay?: number;
    };

    if (!subjects?.length || !days || days < 1) {
      return new Response(
        JSON.stringify({ error: "Provide subjects and a valid number of days." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const subjectBlock = subjects
      .map(
        (s, i) =>
          `Subject ${i + 1}: ${s.name}\nSyllabus:\n${s.syllabus.slice(0, 4000)}`
      )
      .join("\n\n---\n\n");

    const systemPrompt = `You are an elite study coach for exam preparation. Build disciplined, realistic, day-wise study timetables. Rules:
- Break each subject's syllabus into logical, granular topic chunks.
- Distribute topics evenly across the available days, rotating subjects so the student doesn't burn out on one.
- Schedule REVISION blocks every 3-4 days and dedicate the LAST 1-2 days entirely to revision + mock practice.
- Include short buffer/rest blocks where appropriate.
- Keep daily total durations close to the user's hours_per_day target if provided.
- Topics must be specific (not "Chapter 1") — derive them from the syllabus text.`;

    const userPrompt = `Create a study plan.
Days available: ${days}
Hours per day: ${hoursPerDay ?? "flexible (assume 4-5)"}

${subjectBlock}

Return the plan via the create_study_plan tool.`;

    const aiResp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "create_study_plan",
                description: "Return a structured day-wise study timetable.",
                parameters: {
                  type: "object",
                  properties: {
                    summary: {
                      type: "string",
                      description: "1-2 sentence strategy summary.",
                    },
                    days: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          day: { type: "number" },
                          label: {
                            type: "string",
                            description: "e.g. 'Day 1', 'Revision Day'",
                          },
                          tasks: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                subject: { type: "string" },
                                topics: {
                                  type: "array",
                                  items: { type: "string" },
                                },
                                duration_hours: { type: "number" },
                                type: {
                                  type: "string",
                                  enum: ["study", "revision", "practice", "buffer"],
                                },
                              },
                              required: [
                                "subject",
                                "topics",
                                "duration_hours",
                                "type",
                              ],
                              additionalProperties: false,
                            },
                          },
                        },
                        required: ["day", "label", "tasks"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["summary", "days"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "create_study_plan" },
          },
        }),
      }
    );

    if (!aiResp.ok) {
      if (aiResp.status === 429)
        return new Response(
          JSON.stringify({ error: "Rate limit hit. Try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      if (aiResp.status === 402)
        return new Response(
          JSON.stringify({
            error: "AI credits exhausted. Add credits in Workspace → Usage.",
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call:", JSON.stringify(data).slice(0, 500));
      return new Response(JSON.stringify({ error: "AI returned no plan." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const plan = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ plan }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-plan error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

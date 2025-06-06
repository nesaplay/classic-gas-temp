import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { DB_TABLES } from "@/lib/constants";
import { getDbAssistantConfig, DbAssistantConfig } from "@/lib/assistant/assistant-service";

// This is the UUID of the assistant configuration in the 'assistants' DB table
const EMAIL_PRIORITIZER_DB_ASSISTANT_CONFIG_ID = "52844d43-da0d-4588-a423-4c93c62281a0";
const DEFAULT_CHAT_MODEL = "gpt-4o"; // Using gpt-4o as a default, ensure it supports JSON mode for your OpenAI plan.

interface EmailPayload {
  id: string;
  content: string; // This is expected to be bodyText from the caller
}

interface RequestPayload {
  emails: EmailPayload[];
  jobId?: string; // Make jobId optional
}

// Expected AI response structure
interface AiResponseJson {
  email_id: string | null;
  priority: "High" | "Medium" | "Low" | string; // AI might return slightly different casing
}

// DB Priority Enum values
type DbPriority = "HIGH" | "MID" | "LOW";

const mapAiPriorityToDbPriority = (aiPriority: string): DbPriority | null => {
  if (!aiPriority) return null;
  const upperPriority = aiPriority.toUpperCase();
  switch (upperPriority) {
    case "HIGH":
      return "HIGH";
    case "MEDIUM": // Assuming "Medium" from AI maps to "MID" in DB
      return "MID";
    case "LOW":
      return "LOW";
    default:
      console.warn(`[AI Prioritize Route] Unknown AI priority value: "${aiPriority}"`);
      return null;
  }
};

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("[AI Prioritize Route] Auth Error:", authError?.message || "User not found");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let dbAssistantConfig: DbAssistantConfig;
  try {
    // Fetch the assistant configuration (instructions, model, etc.) from our database
    dbAssistantConfig = await getDbAssistantConfig(supabase, EMAIL_PRIORITIZER_DB_ASSISTANT_CONFIG_ID);
  } catch (configError: any) {
    console.error("[AI Prioritize Route] Failed to get assistant DB config:", configError);
    return NextResponse.json(
      { error: "Failed to initialize AI assistant configuration", details: configError.message },
      { status: 500 },
    );
  }

  let requestBody: RequestPayload;
  try {
    requestBody = await req.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { emails, jobId } = requestBody; // Destructure jobId

  if (!Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: "Missing or invalid 'emails' array in request body" }, { status: 400 });
  }

  if (!jobId) {
    console.warn(`[AI Prioritize Route] User ${user.id}: No jobId provided. Progress won't be tracked.`);
  }

  // Fire and forget background processing
  processEmailsInBackground(dbAssistantConfig, emails, user.id, supabase, jobId).catch((error) => {
    console.error(
      `[AI Prioritize Route] Unhandled error in background processing for user ${user.id}, job ${jobId || "N/A"}:`,
      error,
    );
    // Optionally, update job status to failed here if a global error occurs in the orchestrator
  });

  // Return 202 Accepted immediately
  return NextResponse.json(
    { message: `AI prioritization initiated for ${emails.length} emails. Processing in background.` },
    { status: 202 },
  );
}

async function processEmailsInBackground(
  assistantConfig: DbAssistantConfig,
  emails: EmailPayload[],
  userId: string,
  supabase: ReturnType<typeof createClient>,
  jobId?: string,
) {
  console.log(
    `[AI Prioritize Background] User ${userId}, Job ${jobId || "N/A"}: Processing ${
      emails.length
    } emails with model ${DEFAULT_CHAT_MODEL}.`,
  );
  const openai = new OpenAI({ timeout: 10 * 60 * 1000 }); // 10 minutes timeout
  const results = [];

  // System prompt from DB assistant configuration
  const systemPrompt = assistantConfig.system_prompt || "";

  const userPromptTemplate = `Original Email ID: {EMAIL_ID}\nEmail Content:\n{EMAIL_CONTENT}`;

  for (const email of emails) {
    if (!email.id || !email.content) {
      console.error(`[AI Prioritize Background] Skipping email due to missing id/content:`, email.id);
      results.push({ email_id: email.id, status: "skipped", error: "Missing id or content" });
      continue;
    }

    try {
      const userMessageContent = userPromptTemplate
        .replace("{EMAIL_ID}", email.id)
        .replace("{EMAIL_CONTENT}", email.content);

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessageContent },
      ];

      console.log(`[AI Prioritize Background] Sending to OpenAI for email ${email.id}. Model: ${DEFAULT_CHAT_MODEL}`);
      console.log(`[AI Prioritize Background] System prompt: ${systemPrompt}`);

      const completion = await openai.chat.completions.create({
        model: DEFAULT_CHAT_MODEL,
        messages: messages,
        response_format: { type: "json_object" },
        // temperature: assistantConfig.temperature ?? 0.7, // Example if temperature is added to config
        // top_p: assistantConfig.top_p ?? 1.0, // Example if top_p is added to config
      });

      const rawResponse = completion.choices[0]?.message?.content;
      // console.log(`[AI Prioritize Background] Raw OpenAI response for ${email.id}: ${rawResponse}`);

      if (!rawResponse) {
        console.error(
          `[AI Prioritize Background] No response content from assistant for email ${email.id}. Full completion:`,
          completion,
        );
        results.push({ email_id: email.id, status: "failed", error: "No response content from assistant" });
        continue;
      }

      let aiResponse: AiResponseJson;
      try {
        aiResponse = JSON.parse(rawResponse);
      } catch (parseError) {
        console.error(
          `[AI Prioritize Background] Failed to parse JSON for ${email.id}: "${rawResponse}"`,
          parseError,
        );
        results.push({ email_id: email.id, status: "failed", error: "Failed to parse JSON response" });
        continue;
      }

      if (
        !aiResponse.email_id ||
        typeof aiResponse.email_id !== "string" ||
        !aiResponse.priority ||
        typeof aiResponse.priority !== "string"
      ) {
        console.error(`[AI Prioritize Background] Invalid JSON structure or type for ${email.id}. Parsed:`, aiResponse);
        results.push({
          email_id: email.id,
          status: "failed",
          error: `Invalid JSON structure or type. Expected email_id: string, priority: string. Got: ${JSON.stringify(
            aiResponse,
          )}`,
        });
        continue;
      }
      if (aiResponse.email_id !== email.id) {
        console.error(
          `[AI Prioritize Background] Mismatched email_id in JSON for ${email.id}. Expected: ${email.id}, Got: ${aiResponse.email_id}`,
        );
        results.push({
          email_id: email.id,
          status: "failed",
          error: `Mismatched email_id in JSON. Expected: ${email.id}, Got: ${aiResponse.email_id}`,
        });
        continue;
      }

      const targetEmailId = aiResponse.email_id; // Already validated as string and matching email.id
      const dbPriority = mapAiPriorityToDbPriority(aiResponse.priority); // mapAiPriorityToDbPriority handles casing

      if (!dbPriority) {
        // mapAiPriorityToDbPriority already logs a warning for unknown values
        console.error(
          `[AI Prioritize Background] Could not map AI priority "${aiResponse.priority}" to DB enum for email ${targetEmailId}.`,
        );
        results.push({
          email_id: targetEmailId,
          status: "failed",
          error: `Invalid priority value received: ${aiResponse.priority}`,
        });
        continue;
      }

      if (jobId) {
        try {
          const { error: rpcError } = await supabase.rpc("increment_job_processed_emails", {
            p_job_id: jobId,
            p_increment_amount: 1,
          });
          if (rpcError) {
            console.error(
              `[AI Prioritize Background] Failed to increment processed count for job ${jobId}, email ${targetEmailId}:`,
              rpcError,
            );
            // Continue processing other emails, but log this error.
          }
        } catch (e) {
          console.error(
            `[AI Prioritize Background] Exception calling RPC increment_job_processed_emails for job ${jobId}, email ${targetEmailId}:`,
            e,
          );
        }
      }

      const upsertData = {
        email_id: targetEmailId,
        user_id: userId,
        priority: dbPriority,
        updated_at: new Date().toISOString(),
      };

      const { data: upsertResultData, error: dbError } = await supabase
        .from(DB_TABLES.EMAIL_METADATA)
        .upsert(upsertData, { onConflict: "email_id, user_id" })
        .select("email_id"); // Only select one field to confirm upsert

      if (dbError) {
        console.error(`[AI Prioritize Background] Database UPSERT FAILED for email ${targetEmailId}. Error:`, dbError);
        results.push({ email_id: targetEmailId, status: "db_error", error: dbError.message });
      } else {
        // console.log(`[AI Prioritize Background] Successfully upserted metadata for email: ${targetEmailId}`, upsertResultData);
        results.push({ email_id: targetEmailId, status: "success", priority: dbPriority });
      }
    } catch (error: any) {
      console.error(`[AI Prioritize Background] General error processing email ${email.id}:`, error);
      results.push({ email_id: email.id, status: "error", error: error.message || "Unknown error during processing" });
      if (error.response) {
        console.error("[AI Prioritize Background] OpenAI API Error Response:", error.response?.data);
      }
      // Decide if job should be marked as failed based on error type or frequency
    }
  }
  console.log(
    `[AI Prioritize Background] User ${userId}, Job ${jobId || "N/A"}: Finished processing batch of ${
      emails.length
    } emails. Results summary:`,
    results.map((r) => ({ id: r.email_id, status: r.status, error: r.error ? String(r.error) : undefined })),
  );
  // Further job status updates (e.g., to 'completed' if all successful) would typically be handled
  // by checking counts against total, or by a separate mechanism after all batches for a job ID are done.
  // The current frontend polling checks counts against totalToProcess.
}

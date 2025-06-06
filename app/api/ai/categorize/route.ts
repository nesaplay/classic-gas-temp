import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { DB_TABLES } from "@/lib/constants";
import { getDbAssistantConfig, DbAssistantConfig } from "@/lib/assistant/assistant-service";
import { EMAIL_TOPICS } from "@/lib/store/use-email-store";

// This is the UUID of the assistant configuration in the 'assistants' DB table
const EMAIL_CATEGORIZER_DB_ASSISTANT_CONFIG_ID = "00bed48c-895e-4096-876d-6a33dc9d5792";
const DEFAULT_CHAT_MODEL = "gpt-4o"; // Default model, ensure it supports JSON mode.

interface EmailPayload {
  id: string;
  content: string; // This is expected to be bodyText from the caller
}

interface RequestPayload {
  emails: EmailPayload[];
  jobId?: string; // Make jobId optional for now, but log if missing when expected
}

// Expected AI response structure
interface AiResponseJson {
  email_id: string | null;
  category: string; // This will be mapped to 'topic' in the database
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("[AI Categorize Route] Auth Error:", authError?.message || "User not found");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // console.log(`[AI Categorize Route] User ${user.id} authenticated successfully.`); // Less verbose for background

  let dbAssistantConfig: DbAssistantConfig;
  try {
    dbAssistantConfig = await getDbAssistantConfig(supabase, EMAIL_CATEGORIZER_DB_ASSISTANT_CONFIG_ID);
  } catch (configError: any) {
    console.error("[AI Categorize Route] Failed to get assistant DB config:", configError);
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
    console.warn(`[AI Categorize Route] User ${user.id}: No jobId provided. Progress won't be tracked.`);
  }

  // Function to process emails in the background
  const processEmailsInBackground = async () => {
    console.log(
      `[AI Categorize Background] User ${user.id}, Job ${jobId || "N/A"}: Processing ${
        emails.length
      } emails with model ${DEFAULT_CHAT_MODEL} using Chat Completions.`,
    );
    const openai = new OpenAI({
      timeout: 10 * 60 * 1000, // 10 minutes timeout for OpenAI client, can be adjusted
    });
    const results = []; // For logging/tracking purposes within the background task

    const categoryListString = EMAIL_TOPICS.join(", ");
    const systemPrompt = dbAssistantConfig.system_prompt + `\nCATEGORIES: ${categoryListString}`;

    const userPromptTemplate = `Original Email ID: {EMAIL_ID}\nEmail Content:\n{EMAIL_CONTENT}`;

    for (const email of emails) {
      if (!email.id || !email.content) {
        console.error(
          `[AI Categorize Background] Skipping email due to missing id or content:`,
          email.id || "ID unknown",
        );
        results.push({ email_id: email.id, status: "skipped", error: "Missing id or content" });
        continue;
      }

      try {
        const userMessageContent = userPromptTemplate
          .replace("{EMAIL_ID}", email.id)
          .replace("{EMAIL_CONTENT}", email.content);

        const completion = await openai.chat.completions.create({
          model: DEFAULT_CHAT_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessageContent },
          ],
          response_format: { type: "json_object" },
        });

        const rawResponse = completion.choices[0]?.message?.content;

        if (!rawResponse) {
          console.error(`[AI Categorize Background] No response content from assistant for email ${email.id}`);
          results.push({ email_id: email.id, status: "failed", error: "No response content from assistant" });
          continue;
        }

        let aiResponse: AiResponseJson;
        try {
          aiResponse = JSON.parse(rawResponse);
        } catch (parseError) {
          console.error(
            `[AI Categorize Background] Failed to parse JSON response for email ${email.id}. Raw: ${rawResponse}`,
            parseError,
          );
          results.push({ email_id: email.id, status: "failed", error: "Failed to parse JSON response" });
          continue;
        }

        if (!aiResponse.email_id || aiResponse.email_id !== email.id || typeof aiResponse.category !== "string") {
          console.error(
            `[AI Categorize Background] Invalid JSON or mismatched email_id for ${email.id}. Expected: ${email.id}, Got:`,
            aiResponse,
          );
          results.push({
            email_id: email.id,
            status: "failed",
            error: `Invalid JSON structure or mismatched email_id. Expected: ${email.id}, Got: ${aiResponse.email_id}`,
          });
          continue;
        }

        const targetEmailId = aiResponse.email_id;
        const topicValueFromAI = aiResponse.category;

        if (jobId && targetEmailId) {
          // targetEmailId comes from validated aiResponse.email_id
          try {
            // Increment count in ai_processing_jobs table
            const { error: rpcError } = await supabase.rpc("increment_job_processed_emails", {
              p_job_id: jobId,
              p_increment_amount: 1,
            });
            if (rpcError) {
              console.error(
                `[AI Categorize Background] Failed to increment processed count for job ${jobId}, email ${targetEmailId}:`,
                rpcError,
              );
              // Decide if this should be a hard failure for the email or just a logging concern
            }
          } catch (e) {
            console.error(
              `[AI Categorize Background] Exception during RPC call to increment processed count for job ${jobId}, email ${targetEmailId}:`,
              e,
            );
          }
        }

        const upsertData = {
          email_id: targetEmailId,
          user_id: user.id,
          topic: topicValueFromAI,
          updated_at: new Date().toISOString(),
        };

        const { data: upsertResultData, error: dbError } = await supabase
          .from(DB_TABLES.EMAIL_METADATA)
          .upsert(upsertData, { onConflict: "email_id, user_id" })
          .select();

        if (dbError) {
          console.error(
            `[AI Categorize Background] Database UPSERT FAILED for email ${targetEmailId}. Error:`,
            dbError,
          );
          results.push({ email_id: targetEmailId, status: "db_error", error: dbError.message, details: dbError });
        } else {
          if (upsertResultData && upsertResultData.length > 0) {
            results.push({ email_id: targetEmailId, status: "success", topic: topicValueFromAI, operation: "upsert" });
            // console.log(`[AI Categorize Background] Successfully upserted metadata for email: ${targetEmailId}`);
          } else {
            console.warn(
              `[AI Categorize Background] DB upsert for email ${targetEmailId} returned no data (no error). RLS/identical data?`,
            );
            results.push({
              email_id: targetEmailId,
              status: "success_no_data_returned",
              topic: topicValueFromAI,
              message: "Upsert successful but no data returned from select.",
            });
          }
        }
      } catch (error: any) {
        console.error(`[AI Categorize Background] Error processing email ${email.id}:`, error);
        results.push({
          email_id: email.id,
          status: "error",
          error: error.message || "Unknown error during processing",
        });
      }
    }
    console.log(
      `[AI Categorize Background] User ${user.id}, Job ${jobId || "N/A"}: Finished processing ${
        emails.length
      } emails. Results summary (logged for background task):`,
      results.map((r) => ({ id: r.email_id, status: r.status, error: r.error ? String(r.error) : undefined })),
    );
  };

  // Start processing in the background, do not await
  processEmailsInBackground().catch((error) => {
    // This catch is for unexpected errors in the processEmailsInBackground function itself
    console.error(
      `[AI Categorize Route] Unhandled error in background processing orchestrator for user ${user.id}, job ${
        jobId || "N/A"
      }:`,
      error,
    );
  });

  // Return 202 Accepted immediately
  return NextResponse.json(
    { message: `AI categorization initiated for ${emails.length} emails. Processing will continue in the background.` },
    { status: 202 },
  );
}

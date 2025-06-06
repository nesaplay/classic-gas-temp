import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import { getOpenaiAssistantByDbId } from "@/lib/assistant/assistant-service";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getOpenAIAssistantResponse } from "@/lib/openai/chat-stream-handler";

export async function POST(request: Request) {
  const startTime = performance.now();
  console.log("[DraftResponse API] Starting request...");

  try {
    const requestData = await request.json();
    const { message, context, assistantId: dbAssistantId } = requestData;

    if (!message || !dbAssistantId) {
      return NextResponse.json({ error: "Missing required fields: message, dbAssistantId" }, { status: 400 });
    }

    // --- Authentication ---
    const cookieStore = await cookies();
    const supabaseAuth = createClient(cookieStore);
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      console.error("[DraftResponse API] Auth Error:", authError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // --- End Authentication ---

    // --- Get Actual OpenAI Assistant ID ---
    const assistant = await getOpenaiAssistantByDbId(dbAssistantId);
    const openaiActualAssistantId = assistant.id;
    console.log(`[DraftResponse API] Using OpenAI Assistant ID: ${openaiActualAssistantId}`);
    // --- End Get Actual OpenAI Assistant ID ---

    // --- Prepare message for OpenAI (including context if any) ---
    // You might want to fetch assistant.user_prompt here if needed for drafts too
    let userMessageForOpenAI = message;
    if (context) {
      // Basic context stringification. Adjust as needed for your context structure.
      userMessageForOpenAI += `\\n\\nContext:\\n${typeof context === 'string' ? context : JSON.stringify(context, null, 2)}`;
    }
    // --- End Prepare message ---

    // --- Create a temporary OpenAI Thread for this draft --- 
    // It's generally cleaner to use a new thread for one-off requests like drafts.
    // The thread can be deleted in the finally block of getOpenAIAssistantResponse if desired.
    const tempOpenaiThread = await openai.beta.threads.create();
    const openaiThreadId = tempOpenaiThread.id;
    console.log(`[DraftResponse API] Created temporary OpenAI thread: ${openaiThreadId}`);
    // --- End Create temporary OpenAI Thread ---

    const assistantResponse = await getOpenAIAssistantResponse({
      openai,
      openaiThreadId,
      openaiAssistantId: openaiActualAssistantId,
      userMessageContentForOpenai: userMessageForOpenAI,
    });

    console.log(`[DraftResponse API] Received response from assistant. Length: ${assistantResponse.length}`);

    // Optionally, delete the temporary thread after use
    try {
        await openai.beta.threads.del(openaiThreadId);
        console.log(`[DraftResponse API] Deleted temporary OpenAI thread: ${openaiThreadId}`);
    } catch (delError) {
        console.error(`[DraftResponse API] Failed to delete temporary OpenAI thread ${openaiThreadId}:`, delError);
    }

    return NextResponse.json({ draft: assistantResponse });

  } catch (error: any) {
    console.error("[DraftResponse API] Error processing draft request:", error);
    const errorMessage = error.message || "Failed to generate draft response.";
    // Ensure a 500 error is returned for unhandled issues
    const status = error.status || 500; 
    return NextResponse.json({ error: errorMessage }, { status });
  } finally {
    console.log(`[DraftResponse API] Request finished. Total execution time: ${(performance.now() - startTime).toFixed(2)}ms`);
  }
} 
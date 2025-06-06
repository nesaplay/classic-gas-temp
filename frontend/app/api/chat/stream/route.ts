import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import { getOpenaiAssistantByDbId } from "@/lib/assistant/assistant-service";
import { cookies } from "next/headers";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";
import { handleOpenAIChatStream } from "@/lib/openai/chat-stream-handler";
import { handleOpenAIChatCompletionsStream } from "@/lib/openai/chat-completions-stream-handler"; 
import { Assistant } from "openai/resources/beta/assistants";
import { User } from "@supabase/supabase-js";

type MessageInsert = Database["public"]["Tables"]["messages"]["Insert"];
type ThreadInsert = Database["public"]["Tables"]["threads"]["Insert"];

// Configuration for Chat Completions path
const GPT_4O_MODEL = "gpt-4o";
const GPT_4O_CONTEXT_LIMIT = 128000; // Tokens
// Simple token estimation: average 3.5 chars per token. Adjust as needed.
const estimateTokenCount = (text: string): number => Math.ceil((text || "").length / 3.5);

// Simple in-memory cache for OpenAI Assistant objects
interface CacheEntry {
  assistant: Assistant;
  timestamp: number;
}
const assistantCache = new Map<string, CacheEntry>();
const ASSISTANT_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function POST(request: Request) {
  const startTime = performance.now();
  console.log("Starting chat stream processing...");
  const cookieStore = await cookies();

  let requestData;
  let request_thread_id: string | undefined;
  let db_thread_id: string | undefined;
  let openai_thread_id: string | undefined; // Only used for Assistants API path
  let dbAssistantId: string; // UUID from our DB
  let openaiActualAssistantId: string; // OpenAI's actual assistant ID, only for Assistants API path
  let newThreadCreated = false;

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();
  const supabaseService: SupabaseClient<Database> = createServiceRoleClient();

  try {
    requestData = await request.json();
    const { message, filename, hiddenMessage, context } = requestData;
    request_thread_id = requestData.thread_id;
    dbAssistantId = requestData.assistantId; // This is our DB assistant UUID

    if (!message || !dbAssistantId) {
      return NextResponse.json({ error: "Missing required fields: message, assistantId" }, { status: 400 });
    }

    // Initialize Supabase auth client
    const supabaseAuth = createClient(cookieStore);

    // Prepare promises for parallel execution
    const promisesToAwait: any[] = [
      supabaseAuth.auth.getUser(),
      supabaseService
        .from("assistants")
        .select("user_prompt, name")
        .eq("id", dbAssistantId)
        .single(),
    ];

    if (request_thread_id) {
      promisesToAwait.push(
        supabaseService
          .from("threads")
          .select("id, user_id, metadata, assistant_id")
          .eq("id", request_thread_id)
          .single()
      );
    }

    const results = await Promise.all(promisesToAwait);

    // Process user authentication result
    const userAuthResult = results[0] as { data: { user: User | null }; error: any };
    if (userAuthResult.error || !userAuthResult.data.user) {
      console.error("Auth Error in POST /api/chat/stream:", userAuthResult.error);
      if (!writer.closed) await writer.abort("Unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = userAuthResult.data.user;
    const userId = user.id;

    // Process assistant configuration result
    const assistantConfigResult = results[1] as { data: { user_prompt: string | null; name: string | null } | null; error: any };
    if (assistantConfigResult.error || !assistantConfigResult.data) {
      console.error(`Error fetching assistant config for DB ID ${dbAssistantId}:`, assistantConfigResult.error);
      const errorDetail = assistantConfigResult.error?.code === 'PGRST116' ? "not found" : "database error";
      if (!writer.closed) await writer.abort(`Failed to fetch assistant configuration (${errorDetail})`);
      return NextResponse.json({ error: `Failed to load assistant configuration: ${errorDetail}.` }, { status: 500 });
    }
    const assistantConfig = assistantConfigResult.data;
    const userPrompt = assistantConfig.user_prompt;
    const assistantName = assistantConfig.name || "Default Assistant";

    // Process thread data result (if fetched)
    let dbFetchedThreadData: { id: string; user_id: string; metadata: any; assistant_id: string | null } | null = null;
    if (request_thread_id) {
      const threadResult = results[2] as { data: { id: string; user_id: string; metadata: any; assistant_id: string | null } | null; error: any } | undefined;
      if (!threadResult || threadResult.error || !threadResult.data) {
        console.error(`Error fetching provided thread ${request_thread_id} for user ${userId}:`, threadResult?.error);
        if (!writer.closed) await writer.abort("Provided thread not found or failed to load.");
        return NextResponse.json({ error: "Provided thread not found or access denied." }, { status: 404 });
      }
      dbFetchedThreadData = threadResult.data;
      if (dbFetchedThreadData.user_id !== userId) {
        console.error(`User ${userId} attempted to access thread ${request_thread_id} owned by ${dbFetchedThreadData.user_id}. Access denied.`);
        if (!writer.closed) await writer.abort("Thread access denied");
        return NextResponse.json({ error: "Provided thread not found or access denied." }, { status: 403 });
      }
      db_thread_id = dbFetchedThreadData.id;
    }

    // Determine whether to use Chat Completions or Assistants API
    let useChatCompletions = false;
    const effectiveMessage = context ? `${message}\n\nCONTEXT:${JSON.stringify(context)}` : message;
    const estimatedTokens = estimateTokenCount(effectiveMessage) + estimateTokenCount(userPrompt || "");

    if (!filename && estimatedTokens < GPT_4O_CONTEXT_LIMIT) {
      useChatCompletions = true;
    }

    console.log(`Decision: Use Chat Completions? ${useChatCompletions}. Estimated tokens: ${estimatedTokens}. File provided: ${!!filename}`);

    if (useChatCompletions) {
      // --- CHAT COMPLETIONS API PATH ---
      console.log(`PATH: Chat Completions API. Model: ${GPT_4O_MODEL}. DB Assistant ID: ${dbAssistantId}. Estimated Tokens: ${estimatedTokens}`);
      console.log(`Using Chat Completions API for user ${userId}, DB Assistant ID ${dbAssistantId}`);

      if (request_thread_id) {
        if (!db_thread_id) { 
            console.error(`ChatCompletions: request_thread_id ${request_thread_id} was provided but db_thread_id is not set. This indicates an issue in prior fetch/validation.`);
            if (!writer.closed) await writer.abort("Error with provided thread for ChatCompletions.");
            return NextResponse.json({ error: "Error processing provided thread for ChatCompletions." }, { status: 500 });
        }
        console.log(`Using existing DB thread ID: ${db_thread_id} for Chat Completions (validated).`);
      } else {
        newThreadCreated = true;
        console.log(`No thread_id provided for Chat Completions. Creating new DB thread for user ${userId}.`);
        const newDbThreadData: ThreadInsert = {
          user_id: userId,
          assistant_id: dbAssistantId,
          metadata: { chat_api: "completions", model: GPT_4O_MODEL },
        };
        const { data: createdDbThread, error: dbCreateError } = await supabaseService
          .from("threads")
          .insert(newDbThreadData)
          .select("id")
          .single();

        if (dbCreateError || !createdDbThread) {
          console.error(`Failed to create new DB thread for Chat Completions (user ${userId}):`, dbCreateError);
          if (!writer.closed) await writer.abort("Failed to create thread in database for Chat Completions");
          return NextResponse.json({ error: "Failed to create new thread in database for Chat Completions." }, { status: 500 });
        }
        db_thread_id = createdDbThread.id;
        console.log(`Created new DB thread ${db_thread_id} for Chat Completions.`);
      }

      // Construct messages for Chat Completions API, including history
      const chatCompletionsMessages: { role: "system" | "user" | "assistant"; content: string }[] = [];

      if (userPrompt) {
        chatCompletionsMessages.push({ role: "system", content: userPrompt });
      }

      // Fetch and prepend history if db_thread_id is available
      if (db_thread_id) {
        const { data: historicalMessages, error: historyError } = await supabaseService
          .from("messages")
          .select("role, content")
          .eq("thread_id", db_thread_id)
          .in("role", ["user", "assistant"])
          .order("created_at", { ascending: true });

        if (historyError) {
          console.error(`Error fetching message history for thread ${db_thread_id}:`, historyError);
          // Decide if this is a fatal error or if we can proceed without history
          if (!writer.closed) await writer.abort("Failed to load message history.");
          return NextResponse.json({ error: "Failed to load message history." }, { status: 500 });
        }

        if (historicalMessages) {
          for (const msg of historicalMessages) {
            if (msg.content && (msg.role === 'user' || msg.role === 'assistant')) {
              chatCompletionsMessages.push({ role: msg.role, content: msg.content });
            }
          }
        }
      }
      
      chatCompletionsMessages.push({ role: "user", content: effectiveMessage });

      console.log("Final prompt being sent to OpenAI Chat Completions handler:", effectiveMessage);
      
      handleOpenAIChatCompletionsStream({
        openai,
        supabaseService,
        writer,
        encoder,
        messages: chatCompletionsMessages,
        dbThreadId: db_thread_id!,
        dbAssistantId, // For saving messages with correct assistant association
        userId, // For saving messages
        model: GPT_4O_MODEL,
      }).catch((handlerError: any) => {
        console.error("[RouteStream] Unhandled error from handleOpenAIChatCompletionsStream promise:", handlerError);
        if (!writer.closed) {
          const abortReason = handlerError instanceof Error ? handlerError.message : "Unknown error in Chat Completions stream handler";
          writer.abort(abortReason).catch(e => console.error("[RouteStream] Error aborting writer after Chat Completions handler failure:", e));
        }
      });

    } else {
      // --- ASSISTANTS API PATH ---
      console.log(`Using Assistants API for user ${userId}, DB Assistant ID ${dbAssistantId}`);
      
      let assistant: Assistant | undefined = undefined; 

      // 1. Check cache for OpenAI Assistant object
      const cachedEntry = assistantCache.get(dbAssistantId);
      if (cachedEntry && (Date.now() - cachedEntry.timestamp < ASSISTANT_CACHE_TTL_MS)) {
        assistant = cachedEntry.assistant;
        openaiActualAssistantId = assistant.id;
        console.log(`Retrieved OpenAI Assistant ${openaiActualAssistantId} for DB ID ${dbAssistantId} from cache.`);
      } else {
        // Not in cache or expired, fetch and cache
        const assistantFetchStartTime = performance.now();
        try {
          console.log(`Fetching OpenAI Assistant for DB ID ${dbAssistantId} (cache miss or expired).`);
          assistant = await getOpenaiAssistantByDbId(dbAssistantId); 
          openaiActualAssistantId = assistant.id;
          assistantCache.set(dbAssistantId, { assistant, timestamp: Date.now() });
          console.log(`Fetched and cached OpenAI Assistant ${openaiActualAssistantId}. Lookup/sync took: ${(performance.now() - assistantFetchStartTime).toFixed(2)}ms`);
        } catch (getAssistantError: any) {
          console.error(`Failed to get/sync OpenAI Assistant for DB ID ${dbAssistantId}:`, getAssistantError);
          if (!writer.closed) await writer.abort("Failed to initialize AI assistant.");
          return NextResponse.json({ error: `Failed to initialize AI assistant: ${getAssistantError.message}` }, { status: 500 });
        }
      }
      
      // Ensure assistant is defined before proceeding (should be, due to error handling above)
      if (!assistant) {
        console.error(`Critical error: Assistant object is undefined for DB ID ${dbAssistantId} after cache/fetch logic.`);
        if (!writer.closed) await writer.abort("Failed to initialize AI assistant due to an unexpected error.");
        return NextResponse.json({ error: "Failed to initialize AI assistant due to an unexpected error." }, { status: 500 });
      }

      console.log(`PATH: Assistants API. OpenAI Assistant ID: ${openaiActualAssistantId}. Model: ${assistant.model || 'N/A'}. DB Assistant ID: ${dbAssistantId}. Estimated Tokens: ${estimatedTokens}`);
      
      // 2. Handle DB Thread and OpenAI Thread ID
      if (request_thread_id) {
        // db_thread_id is already set if dbFetchedThreadData was processed and valid.
        // dbFetchedThreadData contains metadata and assistant_id.
        if (!db_thread_id || !dbFetchedThreadData) {
             console.error(`Assistants API: request_thread_id ${request_thread_id} was provided but db_thread_id or dbFetchedThreadData is not set. This indicates an issue in prior fetch/validation.`);
            if (!writer.closed) await writer.abort("Error with provided thread for Assistants API.");
            return NextResponse.json({ error: "Error processing provided thread for Assistants API." }, { status: 500 });
        }
        console.log(`Assistants API: Using provided DB thread ID: ${db_thread_id} (validated).`);
        
        // Check if assistant matches - if not, this might be an issue or require new OpenAI thread.
        if (dbFetchedThreadData.assistant_id !== dbAssistantId) {
            console.warn(`DB Thread ${db_thread_id} was associated with assistant ${dbFetchedThreadData.assistant_id}, but current request is for ${dbAssistantId}. Proceeding with new OpenAI thread logic.`);
            // Treat as if new OpenAI thread is needed, but keep existing db_thread_id
            const newOpenaiThread = await openai.beta.threads.create();
            openai_thread_id = newOpenaiThread.id;
            const currentMetadata = typeof dbFetchedThreadData?.metadata === "object" && dbFetchedThreadData.metadata !== null ? dbFetchedThreadData.metadata : {};
            const newMetadata = { ...currentMetadata, openai_thread_id: openai_thread_id, chat_api: "assistants", model: assistant?.model || "gpt-4o" }; 
            const { error: updateError } = await supabaseService.from("threads").update({ metadata: newMetadata, assistant_id: dbAssistantId }).eq("id", db_thread_id!);
            if (updateError) { console.error(`Assistants API: Failed to update thread ${db_thread_id} metadata/assistant after mismatch:`, updateError); }

        } else {
            openai_thread_id = (dbFetchedThreadData?.metadata as any)?.openai_thread_id as string | undefined;
            if (!openai_thread_id) {
                console.log(`No OpenAI thread ID found for existing DB thread ${db_thread_id}. Creating new OpenAI thread.`);
                const newOpenaiThread = await openai.beta.threads.create();
                openai_thread_id = newOpenaiThread.id;
                const currentMetadata = typeof dbFetchedThreadData?.metadata === "object" && dbFetchedThreadData.metadata !== null ? dbFetchedThreadData.metadata : {};
                const newMetadata = { ...currentMetadata, openai_thread_id: openai_thread_id, chat_api: "assistants", model: assistant?.model || "gpt-4o" }; 
                const { error: updateError } = await supabaseService.from("threads").update({ metadata: newMetadata }).eq("id", db_thread_id!);
                if (updateError) { console.error(`Assistants API: Failed to update thread ${db_thread_id} with new OpenAI thread ID:`, updateError); }
            } else {
                 console.log(`Using existing OpenAI thread ${openai_thread_id} for DB thread ${db_thread_id}`);
            }
        }
      } else {
      newThreadCreated = true;
        console.log(`Assistants API: No thread_id provided. Creating new DB and OpenAI threads for user ${userId}.`);
      const newOpenaiThread = await openai.beta.threads.create();
      openai_thread_id = newOpenaiThread.id;
      console.log(`Created new OpenAI thread: ${openai_thread_id}`);

      const newDbThreadData: ThreadInsert = {
        user_id: userId,
          assistant_id: dbAssistantId,
          metadata: { openai_thread_id: openai_thread_id, chat_api: "assistants", model: assistant?.model || "gpt-4o" }, // Use assistant.model safely
      };
      const { data: createdDbThread, error: dbCreateError } = await supabaseService
        .from("threads")
        .insert(newDbThreadData)
        .select("id")
        .single();

      if (dbCreateError || !createdDbThread) {
          console.error(`Failed to create new DB thread for Assistants API (user ${userId}):`, dbCreateError);
          await openai.beta.threads.del(openai_thread_id).catch(e => console.error("Failed to delete orphaned OpenAI thread", e));
          if (!writer.closed) await writer.abort("Failed to create thread in database for Assistants API");
        return NextResponse.json({ error: "Failed to create new thread in database." }, { status: 500 });
      }
      db_thread_id = createdDbThread.id;
      console.log(`Created new DB thread ${db_thread_id} associated with OpenAI thread ${openai_thread_id}`);
      }

      // 3. File Processing (if filename is present)
    let openaiFileId: string | undefined = undefined;
    let processedFileName: string | undefined = undefined;
    if (filename) {
        // This logic was already present and seems correct for Assistants API path
        console.log(`Processing request with DB file ID (local): ${filename}`);
      const { data: fileRecord, error: fileFetchError } = await supabaseService
        .from("files")
        .select("filename, openai_file_id, mime_type") 
          .eq("id", filename) // filename is the file's DB ID
          .eq("user_id", userId)
        .single();

      if (fileFetchError || !fileRecord) {
          console.error(`Failed to fetch file record for DB file ID ${filename} or file not found:`, fileFetchError);
          if (!writer.closed) await writer.abort("File not found");
        return NextResponse.json({ error: "Failed to retrieve file details for chat context." }, { status: 404 });
      }
      if (!fileRecord.openai_file_id) {
          console.error(`File record ${filename} is missing its OpenAI File ID.`);
          if (!writer.closed) await writer.abort("File not processed for AI");
        return NextResponse.json({ error: "File has not been processed for AI use. OpenAI File ID missing." }, { status: 400 });
        }
        openaiFileId = fileRecord.openai_file_id;
        processedFileName = fileRecord.filename;
        console.log(`Retrieved OpenAI File ID: ${openaiFileId} and Filename: ${processedFileName} for DB file ${filename}.`);
      }

      // 4. Construct Final Message for Assistants API
      let userMessageForOpenAI = message; // Original user message
        if (processedFileName) {
        // Prepend file acknowledgment prompt if a file is involved
          userMessageForOpenAI = `Please acknowledge that you received the file named "${processedFileName}", and then immediately begin summarizing its contents without waiting. Always read the file first. Address the original query if it's different from summarization after you are done with the summary.\n\nOriginal query: ${message}`;
        }
      // Add context if present
        const messageWithContext = context ? `${userMessageForOpenAI}\n\nCONTEXT:${JSON.stringify(context)}` : userMessageForOpenAI;
      // Add OpenAI file reference if applicable
      const fileContextOpenAI = openaiFileId ? `\n(Referenced File ID: ${openaiFileId})` : "";
      const messageWithFileContext = `${messageWithContext}${fileContextOpenAI}`;
      // Prepend the assistant's system prompt (userPrompt)
      const finalMessageToOpenAI = userPrompt ? `${userPrompt}\n\n${messageWithFileContext}` : messageWithFileContext;
      console.log("Final message being sent to OpenAI Assistants handler:", finalMessageToOpenAI.substring(0, 200) + "...");


      // Call the existing handler for Assistants API
      handleOpenAIChatStream({
        openai: openai,
        supabaseService,
        writer,
        encoder,
        openaiThreadId: openai_thread_id!,
        openaiAssistantId: openaiActualAssistantId,
        userMessageContentForOpenai: finalMessageToOpenAI,
        dbThreadId: db_thread_id!,
        dbAssistantId: dbAssistantId, // dbAssistantId from request
        // userId: userId, // Temporarily removed to resolve linter error, will revisit when editing chat-stream-handler.ts
      }).catch(handlerError => {
        console.error("[RouteStream] Unhandled error from handleOpenAIChatStream promise:", handlerError);
        if (!writer.closed) {
          const abortReason = handlerError instanceof Error ? handlerError.message : "Unknown error in Assistants stream handler";
          writer.abort(abortReason).catch(e => console.error("[RouteStream] Error aborting writer after Assistants handler failure:", e));
        }
      });
    }

    // Common logic: Save user message to DB if not hidden
    if (!hiddenMessage && db_thread_id) { // Ensure db_thread_id is set
      const userMessageToInsert: MessageInsert = {
        thread_id: db_thread_id!,
        user_id: userId,
        role: "user",
        content: message, // Original message, not the potentially modified one
        completed: true,
        assistant_id: useChatCompletions ? dbAssistantId : null, // For chat completions, associate with dbAssistantId. For assistants, handled by stream handler.
        // If associating with dbAssistantId for chat completions, ensure `assistant_id` column in `messages` can take it or is nullable.
      };
      supabaseService.from("messages").insert(userMessageToInsert)
        .then(({ error: insertUserMsgError }: { error: any | null }) => {
          if (insertUserMsgError) console.error("Supabase background user message insert error:", insertUserMsgError);
          else console.log(`User message saved to DB for thread ${db_thread_id}.`);
        });
    } else if (!hiddenMessage && !db_thread_id) {
        console.error("CRITICAL: db_thread_id was not set before attempting to save user message. This should not happen.");
    }

    const responseHeaders = new Headers({
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    });
    if (newThreadCreated && db_thread_id) { // Ensure db_thread_id is set
      responseHeaders.set("X-Thread-ID", db_thread_id!);
      console.log(`Responding with new thread ID in header: ${db_thread_id}`);
    }

    return new Response(stream.readable, {
      headers: responseHeaders,
    });

  } catch (error: any) {
    console.error("Error in POST /api/chat/stream (outer catch):", error);
    if (!writer.closed) {
        try { await writer.abort(error.message || "Outer catch error"); } 
        catch (e) { console.error("Error aborting writer in outer catch:", e); }
    }
    if (error instanceof SyntaxError && 'bodyUsed' in request && !request.bodyUsed) { 
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    console.log(`Failed execution time: ${(performance.now() - startTime).toFixed(2)}ms`);
    return NextResponse.json(
      { error: `Failed to process streaming message: ${error.message || "Unknown error"}` },
      { status: 500 },
    );
  } finally {
    // Common logic: Update thread timestamp
    if (supabaseService && db_thread_id) { // Ensure db_thread_id is set
       supabaseService.from('threads').update({ updated_at: new Date().toISOString() }).eq('id', db_thread_id)
       .then(({error}: {error: any | null}) => {
          if(error) console.error("BG Thread Timestamp Update Error:", error);
          else console.log(`Thread ${db_thread_id} timestamp updated.`);
       });
    }
    console.log(`Main route processing finished. Total execution time: ${(performance.now() - startTime).toFixed(2)}ms`);
  }
}

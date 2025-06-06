import { OpenAI } from "openai";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";

type MessageInsert = Database["public"]["Tables"]["messages"]["Insert"];

interface HandleOpenAIChatStreamParams {
  openai: OpenAI;
  supabaseService: SupabaseClient<Database>;
  writer: WritableStreamDefaultWriter<Uint8Array>;
  encoder: TextEncoder;
  openaiThreadId: string;
  openaiAssistantId: string; // OpenAI's actual assistant ID
  userMessageContentForOpenai: string;
  dbThreadId: string;
  dbAssistantId: string; // Your internal assistant ID from DB (for linking message)
}

export async function handleOpenAIChatStream({
  openai,
  supabaseService,
  writer,
  encoder,
  openaiThreadId,
  openaiAssistantId,
  userMessageContentForOpenai,
  dbThreadId,
  dbAssistantId,
}: HandleOpenAIChatStreamParams): Promise<void> {
  let accumulatedAssistantContent = "";
  let runIdForMetadata: string | undefined = undefined;
  let openaiThreadIdForMetadata: string | undefined = openaiThreadId;

  const streamStartTime = performance.now();
  console.log(`[ChatStreamHandler] Starting stream. OpenAI Thread: ${openaiThreadId}, OpenAI Assistant: ${openaiAssistantId}, DB Thread: ${dbThreadId}, DB Assistant: ${dbAssistantId}`);

  try {
    const addUserMsgStartTime = performance.now();
    await openai.beta.threads.messages.create(openaiThreadId, {
      role: "user",
      content: userMessageContentForOpenai,
    });
    console.log(`[ChatStreamHandler] Added user message to OpenAI thread. Took: ${(performance.now() - addUserMsgStartTime).toFixed(2)}ms`);

    const createRunStartTime = performance.now();
    const runStream = await openai.beta.threads.runs.create(openaiThreadId, {
      assistant_id: openaiAssistantId,
      stream: true,
    });
    console.log(`[ChatStreamHandler] Created OpenAI run. Took: ${(performance.now() - createRunStartTime).toFixed(2)}ms`);

    const responseStartTime = performance.now();
    let firstChunkReceived = false;

    for await (const event of runStream) {
      if (event.event === "thread.run.created") {
        runIdForMetadata = event.data.id;
        openaiThreadIdForMetadata = event.data.thread_id;
        console.log(`[ChatStreamHandler] OpenAI Run created: ${runIdForMetadata} on thread ${openaiThreadIdForMetadata}`);
      }

      if (event.event === "thread.message.delta") {
        const contentBlock = event.data.delta.content?.[0];
        if (contentBlock && contentBlock.type === "text" && contentBlock.text) {
          const chunk = contentBlock.text.value;
          if (chunk) {
            if (!firstChunkReceived) {
              console.log(`[ChatStreamHandler] First chunk received. Latency: ${(performance.now() - responseStartTime).toFixed(2)}ms`);
              firstChunkReceived = true;
            }
            accumulatedAssistantContent += chunk;
            try {
              await writer.write(encoder.encode(chunk));
            } catch (writeError) {
              console.error("[ChatStreamHandler] Error writing data chunk to stream:", writeError);
              if (!writer.closed) {
                console.log("[ChatStreamHandler] Aborting writer due to failure in writing data chunk.");
                await writer.abort(writeError);
              }
              throw writeError;
            }
          }
        }
      }

      if (event.event === "thread.run.failed") {
        console.error("[ChatStreamHandler] OpenAI run failed:", event.data);
        const failureReason = event.data.last_error?.message || "Assistant encountered an error.";
        if (!writer.closed) {
            try {
                await writer.write(encoder.encode(`Sorry, ${failureReason}`));
            } catch (writeError_RunFailed) {
                console.error("[ChatStreamHandler] Error writing run failure message to stream:", writeError_RunFailed);
                if (!writer.closed) {
                    console.log("[ChatStreamHandler] Aborting writer due to failure writing run failure message.");
                    await writer.abort(writeError_RunFailed);
                }
            }
        }
        throw new Error(`OpenAI run failed: ${failureReason}`);
      }

      if (event.event === "thread.run.completed") {
        console.log("[ChatStreamHandler] OpenAI run completed.");
        if (!runIdForMetadata) runIdForMetadata = event.data.id;
        if (!openaiThreadIdForMetadata) openaiThreadIdForMetadata = event.data.thread_id;
      }
    }

    console.log(`[ChatStreamHandler] Response streaming finished. Took: ${(performance.now() - responseStartTime).toFixed(2)}ms`);

    if (!accumulatedAssistantContent && runIdForMetadata) {
      console.warn(`[ChatStreamHandler] Stream ended, no text content. OpenAI Run ID: ${runIdForMetadata}`);
    } else if (!runIdForMetadata && !accumulatedAssistantContent && !writer.closed) {
       console.error("[ChatStreamHandler] Stream ended with no run ID and no content, and writer is open.");
    }

  } catch (caughtError: any) {
    console.error("[ChatStreamHandler] Error during OpenAI interaction or stream processing:", caughtError);
    if (!writer.closed) {
      try {
        let errorMessage = "Sorry, an unexpected error occurred while processing your request.";
        if (caughtError?.message && typeof caughtError.message === 'string') {
          errorMessage = `Sorry, an error occurred: ${caughtError.message}`;
        }
        if (!(caughtError.message && 
            (caughtError.message.includes("writing data chunk to stream") || 
             caughtError.message.includes("writing run failure message to stream") ||
             caughtError.message.includes("Aborting writer due to failure")))) {
            await writer.write(encoder.encode(errorMessage));
        }
      } catch (writeErrorInCatch) {
        console.error("[ChatStreamHandler] Error writing final error message to stream in main catch:", writeErrorInCatch);
        if (!writer.closed) {
          try {
            console.log("[ChatStreamHandler] Aborting writer due to failure in writing error message (main catch).");
            await writer.abort(writeErrorInCatch);
          } catch (abortErrorInCatch) {
            console.error("[ChatStreamHandler] Failed to abort writer in main catch block after write error:", abortErrorInCatch);
          }
        }
      }
    }
    throw caughtError;
  } finally {
    console.log("[ChatStreamHandler] Entering finally block.");

    if (accumulatedAssistantContent && dbThreadId) {
      const assistantMessageToInsert: MessageInsert = {
        thread_id: dbThreadId,
        user_id: null,
        assistant_id: dbAssistantId,
        role: "assistant",
        content: accumulatedAssistantContent,
        completed: true,
        metadata: {
          openai_message_id: null,
          openai_run_id: runIdForMetadata,
          openai_thread_id: openaiThreadIdForMetadata,
        },
      };
      (async () => {
        try {
          const { error } = await supabaseService.from("messages").insert(assistantMessageToInsert);
          if (error) console.error("[ChatStreamHandler] DB Save Error (Assistant Message):", error);
          else console.log("[ChatStreamHandler] DB Save OK (Assistant Message)");
        } catch (dbError: any) {
          console.error("[ChatStreamHandler] Unhandled exception during DB Save (Assistant Message):", dbError);
        }
      })();
    }

    try {
      console.log('[ChatStreamHandler] Attempting to close writer in finally block...');
      await writer.close();
      console.log('[ChatStreamHandler] Writer closed successfully in finally block.');
    } catch (closeError: any) {
      console.error('[ChatStreamHandler] Failed to close writer in finally block, attempting abort:', closeError);
      try {
        console.log('[ChatStreamHandler] Attempting to abort writer in finally block after close failed...');
        await writer.abort(closeError.message || "Abort due to close error in finally");
        console.log('[ChatStreamHandler] Writer aborted successfully in finally block after close failed.');
      } catch (abortErrorInFinally) {
        console.error('[ChatStreamHandler] Failed to abort writer in finally block after close failed:', abortErrorInFinally);
      }
    }
    console.log(`[ChatStreamHandler] Finished. Total execution time for handler: ${(performance.now() - streamStartTime).toFixed(2)}ms`);
  }
}

// New function to get a full response without streaming to a writer
interface GetOpenAIAssistantResponseParams {
  openai: OpenAI;
  // supabaseService: SupabaseClient<Database>; // Optional: if we decide to log or use DB features
  openaiThreadId: string;
  openaiAssistantId: string; // OpenAI's actual assistant ID
  userMessageContentForOpenai: string;
  // dbThreadId?: string; // Optional, if we need to link to a DB thread for some reason
  // dbAssistantId?: string; // Optional, for logging or other specific uses
}

export async function getOpenAIAssistantResponse({
  openai,
  openaiThreadId,
  openaiAssistantId,
  userMessageContentForOpenai,
}: GetOpenAIAssistantResponseParams): Promise<string> {
  let accumulatedAssistantContent = "";
  let runIdForMetadata: string | undefined = undefined;

  const operationStartTime = performance.now();
  console.log(`[GetAssistantResponse] Starting operation. OpenAI Thread: ${openaiThreadId}, Assistant: ${openaiAssistantId}`);

  try {
    await openai.beta.threads.messages.create(openaiThreadId, {
      role: "user",
      content: userMessageContentForOpenai,
    });
    console.log(`[GetAssistantResponse] Added user message to OpenAI thread.`);

    const runStream = await openai.beta.threads.runs.create(openaiThreadId, {
      assistant_id: openaiAssistantId,
      stream: true, // Still stream to process events correctly
    });
    console.log(`[GetAssistantResponse] Created OpenAI run.`);

    for await (const event of runStream) {
      if (event.event === "thread.run.created") {
        runIdForMetadata = event.data.id;
        console.log(`[GetAssistantResponse] OpenAI Run created: ${runIdForMetadata}`);
      }

      if (event.event === "thread.message.delta") {
        const contentBlock = event.data.delta.content?.[0];
        if (contentBlock && contentBlock.type === "text" && contentBlock.text) {
          const chunk = contentBlock.text.value;
          if (chunk) {
            accumulatedAssistantContent += chunk;
          }
        }
      }

      if (event.event === "thread.run.failed") {
        console.error("[GetAssistantResponse] OpenAI run failed:", event.data);
        const failureReason = event.data.last_error?.message || "Assistant encountered an error.";
        // Unlike streaming to client, here we throw to indicate failure to the caller
        throw new Error(`OpenAI run failed: ${failureReason}`);
      }

      if (event.event === "thread.run.completed") {
        console.log("[GetAssistantResponse] OpenAI run completed.");
        if (!runIdForMetadata) runIdForMetadata = event.data.id;
      }
    }

    if (!accumulatedAssistantContent && runIdForMetadata) {
      console.warn(`[GetAssistantResponse] Operation ended, no text content. OpenAI Run ID: ${runIdForMetadata}`);
      // Return empty string or handle as an error depending on desired behavior for no content
      return ""; 
    } else if (!runIdForMetadata && !accumulatedAssistantContent) {
       console.error("[GetAssistantResponse] Operation ended with no run ID and no content.");
       throw new Error("Failed to get a response from the assistant: No run ID and no content.");
    }

    console.log(`[GetAssistantResponse] Accumulated content. Length: ${accumulatedAssistantContent.length}`);
    return accumulatedAssistantContent;

  } catch (caughtError: any) {
    console.error("[GetAssistantResponse] Error during OpenAI interaction:", caughtError);
    // Re-throw the error so the calling API endpoint can handle it and return an appropriate HTTP error
    throw caughtError; 
  } finally {
    console.log(`[GetAssistantResponse] Finished. Total execution time: ${(performance.now() - operationStartTime).toFixed(2)}ms`);
    // Optionally, delete the temporary OpenAI thread here if it was created solely for this operation
    // This requires passing the threadId and a flag indicating it's temporary.
    // e.g., if (isTemporaryThread && openaiThreadId) { await openai.beta.threads.del(openaiThreadId); }
  }
} 
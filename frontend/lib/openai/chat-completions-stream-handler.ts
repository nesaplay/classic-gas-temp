import { SupabaseClient } from "@supabase/supabase-js";
import { OpenAI } from "openai";
import { Database } from "@/types/supabase";
import { TextEncoder } from "util"; // Or use the global TextEncoder if available

type MessageInsert = Database["public"]["Tables"]["messages"]["Insert"];

export interface HandleOpenAIChatCompletionsStreamParams {
  openai: OpenAI;
  supabaseService: SupabaseClient<Database>;
  writer: WritableStreamDefaultWriter<Uint8Array>;
  encoder: TextEncoder;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  dbThreadId: string;
  dbAssistantId: string; // The ID of the assistant config from our database
  userId: string;
  model: string;
}

export async function handleOpenAIChatCompletionsStream({
  openai,
  supabaseService,
  writer,
  encoder,
  messages,
  dbThreadId,
  dbAssistantId,
  userId,
  model,
}: HandleOpenAIChatCompletionsStreamParams): Promise<void> {
  let accumulatedResponse = "";
  let streamStartTime = performance.now();
  console.log(`[ChatCompletionsHandler] Starting stream for thread ${dbThreadId}, model ${model}`);

  try {
    const stream = await openai.chat.completions.create({
      model: model,
      messages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        accumulatedResponse += content;
        await writer.write(encoder.encode(content));
      }
      // Handle potential finish_reason (e.g., length, content_filter)
      if (chunk.choices[0]?.finish_reason) {
        console.log(`[ChatCompletionsHandler] Stream finished. Reason: ${chunk.choices[0].finish_reason}`);
        await writer.close();
        break; 
      }
    }
    console.log(`[ChatCompletionsHandler] Stream ended. Accumulation took: ${(performance.now() - streamStartTime).toFixed(2)}ms. Total length: ${accumulatedResponse.length}`);

  } catch (error: any) {
    console.error("[ChatCompletionsHandler] Error during OpenAI stream:", error);
    if (!writer.closed) {
      try {
        const errorMessage = JSON.stringify({ type: "error", error: error.message || "Stream failed" });
        await writer.write(encoder.encode(errorMessage));
      } catch (writeError) {
        console.error("[ChatCompletionsHandler] Failed to write error to stream:", writeError);
      }
    }
    throw error; // Re-throw to be caught by the route handler
  } finally {
    if (!writer.closed) {
      try {
        await writer.close();
        console.log("[ChatCompletionsHandler] Writer closed.");
      } catch (e) {
        console.error("[ChatCompletionsHandler] Error closing writer:", e);
      }
    }
  }

  if (accumulatedResponse.trim()) {
    const assistantMessageToInsert: MessageInsert = {
      thread_id: dbThreadId,
      user_id: userId,
      role: "assistant",
      content: accumulatedResponse,
      completed: true, 
      assistant_id: dbAssistantId, // Link to our internal assistant config ID
      // model: model, // Optional: if you add a model column to messages table
    };

    const { error: insertError } = await supabaseService
      .from("messages")
      .insert(assistantMessageToInsert);

    if (insertError) {
      console.error("[ChatCompletionsHandler] Supabase assistant message insert error:", insertError);
      // Not throwing here as the client already received the message. Log and monitor.
    } else {
      console.log(`[ChatCompletionsHandler] Assistant message saved to DB for thread ${dbThreadId}.`);
    }
  } else {
    console.log("[ChatCompletionsHandler] No response content from assistant to save.");
  }
} 
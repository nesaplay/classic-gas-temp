"use client";

import type React from "react";
import { cn } from "@/lib/utils";
import { Database } from "@/types/supabase";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import StructuredMessage from "./StructuredMessage";

type Message = Database["public"]["Tables"]["messages"]["Row"];

interface StreamingWord {
  id: number;
  text: string;
}

interface ChatMessageListProps {
  messages: Message[];
  isWaiting: boolean;
  isStreaming: boolean;
  streamingWords: StreamingWord[];
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

const THINKING_MSG_ID = "system-thinking-placeholder"; // Added for consistency with ChatContainer

const ThinkingBubbles = () => (
  <div className="flex items-end space-x-1 text-gray-500 dark:text-gray-400">
    <span className="w-2 h-2 bg-current rounded-full animate-thinking"></span>
    <span className="w-2 h-2 bg-current rounded-full animate-thinking" style={{ animationDelay: "0.2s" }}></span>
    <span className="w-2 h-2 bg-current rounded-full animate-thinking" style={{ animationDelay: "0.4s" }}></span>
  </div>
);

// Rename function to check if content matches the structured format
const isStructuredFormat = (content: string | null): boolean => {
    if (!content) return false;
    // Simple check for keywords - might need refinement
    return content.includes("- **paragraph_summary**:") && content.includes("- **entries**: [");
};

const renderMessage = (message: Message) => {
  // Check if it's the special thinking indicator message
  const isThinkingIndicator = 
    message.id === THINKING_MSG_ID || 
    (typeof message.metadata === 'object' && 
     message.metadata !== null && 
     'type' in message.metadata && 
     (message.metadata as { type: string }).type === "thinking_indicator");

  if (isThinkingIndicator) {
    return (
      <div key={message.id} className={cn("flex mb-4 justify-start")}>
        <div
          className={cn(
            "max-w-[80%] px-4 py-2 rounded-2xl text-sm min-h-[36px] flex items-center",
            "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-none",
          )}
        >
          <ThinkingBubbles />
        </div>
      </div>
    );
  }

  const isUser = message.role === "user";
  // Use renamed checker function
  const useStructuredComponent = !isUser && isStructuredFormat(message.content);

  return (
    <div key={message.id} className={cn("flex mb-4", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "prose dark:prose-invert max-w-[80%] px-4 py-2 rounded-2xl text-sm min-h-[36px] flex flex-col items-start",
          isUser
            ? "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-br-none text-gray-900 dark:text-gray-100"
            : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-none",
        )}
      >
        {useStructuredComponent ? (
          <StructuredMessage content={message.content || ''} />
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content || ''}</ReactMarkdown>
        )}
      </div>
    </div>
  );
};

const ChatMessageList = ({
  messages,
  isWaiting,
  isStreaming,
  streamingWords,
  messagesEndRef,
}: ChatMessageListProps) => {
  const renderStreamingIndicator = () => {
    if (isWaiting && !messages.find(msg => msg.id === THINKING_MSG_ID)) {
      return (
        <div className="flex justify-start mb-4">
          <div
            className={cn(
              "max-w-[80%] px-4 py-2 rounded-2xl text-sm min-h-[36px] flex items-center",
              "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-none",
            )}
          >
            <ThinkingBubbles />
          </div>
        </div>
      );
    }
    if (isStreaming && !isWaiting) {
      return (
        <div className="flex justify-start mb-4">
          <div
            className={cn(
              "prose dark:prose-invert max-w-[80%] px-4 py-2 rounded-2xl text-sm min-h-[36px]",
              "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-none",
            )}
          >
            {streamingWords.length === 0 ? (
              <ThinkingBubbles />
            ) : (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {streamingWords.map((word) => word.text).join("")}
              </ReactMarkdown>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map(renderMessage)}
      {renderStreamingIndicator()}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatMessageList;

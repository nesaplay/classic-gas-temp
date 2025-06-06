"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NavigationBar } from "./views/navigation-bar";
import { useChatStore } from "@/lib/store/use-chat-store";
import Image from "next/image";
import { PROJECT_CONFIG } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { FileService } from "@/lib/services/file-service";
import { Database } from "@/types/supabase";
import { MessagesScreen } from "./views/messages";
import { HomeScreen } from "./views/home";
import Chat from "./views/chat";
import { Email, useEmailStore } from "@/lib/store/use-email-store";

type Message = Database["public"]["Tables"]["messages"]["Row"];
type Thread = Pick<
  Database["public"]["Tables"]["threads"]["Row"],
  "id" | "title" | "updated_at" | "assistant_id" | "created_at"
>;
type UploadedFile = {
  id: string;
  filename: string;
};
type Screen = "home" | "messages" | "chat";

const THINKING_MSG_ID = "system-thinking-placeholder"; // Unique ID for the thinking message

// Helper function for generating title (fallback)
const generateFallbackTitleFromResponse = (text: string, maxLength = 70) => {
  if (!text || text.trim().length === 0) return "New Chat";
  let title = text.split("\\n")[0].trim();
  if (title.length > maxLength) {
    title = title.substring(0, maxLength).trim();
    const lastSpace = title.lastIndexOf(" ");
    if (lastSpace > maxLength / 2 && lastSpace > 0) {
      title = title.substring(0, lastSpace);
    }
    title += "...";
  }
  return title.trim() || "New Chat";
};

export default function ChatContainer() {
  const { isOpen, setIsOpen, activeSection, setLoading, loading, context } = useChatStore();
  const { toast } = useToast();
  const { activeEmail, draftEmailResponse } = useEmailStore();

  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(false);
  const [isDrafting, setIsDrafting] = useState<boolean>(false);

  const [currentScreen, setCurrentScreen] = useState<Screen>("home");
  const [messageRead, setMessageRead] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [firstWordHasBeenReceived, setFirstWordHasBeenReceived] = useState(false);

  const loadInitialChatData = useCallback(
    async (assistantId: string) => {
      if (!assistantId) return;
      setIsInitialLoading(true);
      setLoading(true);
      try {
        const response = await fetch(`/api/chat/init?assistantId=${assistantId}`);
        if (!response.ok) throw new Error("Failed to load initial chat data");
        const data: { threads: Thread[]; messages: Message[] } = await response.json();

        // Check if threads are empty and activeSection exists
        if ((!data.threads || data.threads.length === 0) && activeSection?.assistantId) {
          console.log("No threads found, creating welcome thread...");
          try {
            const welcomeResponse = await fetch(`/api/chat/welcome`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ assistantId: activeSection.assistantId }),
            });
            if (!welcomeResponse.ok) {
              const errorData = await welcomeResponse.json().catch(() => ({}));
              throw new Error(errorData.error || "Failed to create welcome thread");
            }
            const welcomeData: { thread: Thread; message: Message } = await welcomeResponse.json();

            // Update state with the new thread and welcome message
            setThreads([welcomeData.thread]);
            setMessages([welcomeData.message]);
            // setActiveThreadId(welcomeData.thread.id);
            // setCurrentScreen("chat"); // Go directly to chat screen
          } catch (welcomeError: any) {
            console.error("Error creating welcome thread:", welcomeError);
            toast({
              title: "Error",
              description: welcomeError.message || "Failed to start chat with welcome message",
              variant: "destructive",
            });
            // Fallback: set empty state
            setThreads([]);
            setMessages([]);
            setActiveThreadId(null);
          }
        } else {
          // Existing threads found, open the first one in chat view
          setThreads(data.threads || []);
          setMessages(data.messages || []);
          setActiveThreadId(data.threads && data.threads.length > 0 ? data.threads[0].id : null);
          setCurrentScreen("chat"); // Go directly to chat screen
        }
      } catch (error: any) {
        console.error("Error loading initial chat data:", error);
        toast({ title: "Error", description: error.message || "Failed to load chat history", variant: "destructive" });
        setThreads([]);
        setMessages([]);
        setActiveThreadId(null);
      } finally {
        setLoading(false);
        setIsInitialLoading(false);
      }
    },
    [setLoading, toast],
  );

  const loadMessagesForThread = useCallback(
    async (threadId: string | null) => {
      if (!threadId) {
        setMessages([]);
        setActiveThreadId(null);
        return;
      }
      setLoading(true);
      try {
        const response = await fetch(`/api/chat/messages?thread_id=${threadId}`);
        if (!response.ok) throw new Error("Failed to load messages for thread");
        const data: { messages: Message[] } = await response.json();
        setMessages(data.messages || []);
        setActiveThreadId(threadId);
      } catch (error: any) {
        console.error(`Error loading messages for thread ${threadId}:`, error);
        toast({ title: "Error", description: error.message || "Failed to load messages", variant: "destructive" });
        setMessages([]);
      } finally {
        setLoading(false);
      }
    },
    [setLoading, toast],
  );

  const getUploadedFilesList = useCallback(async () => {
    try {
      const files = await FileService.listFiles();
      setUploadedFiles(files.map((f) => ({ id: f.id, filename: f.filename })));
    } catch (error: any) {
      console.error("Failed to get uploaded file list:", error);
      toast({
        title: "Error fetching files",
        description: error.message || "Could not retrieve file list.",
        variant: "destructive",
      });
      setUploadedFiles([]);
    }
  }, [toast]);

  useEffect(() => {
    if (isOpen) {
      setCurrentScreen("home");
      setIsExpanded(false);

      if (activeSection?.assistantId) {
        loadInitialChatData(activeSection.assistantId);
        getUploadedFilesList();
      } else {
        setThreads([]);
        setMessages([]);
        setActiveThreadId(null);
        setUploadedFiles([]);
      }
    } else {
      setThreads([]);
      setMessages([]);
      setActiveThreadId(null);
      setUploadedFiles([]);
    }
  }, [isOpen, activeSection, loadInitialChatData, getUploadedFilesList]);

  useEffect(() => {
    const handleFileUploaded = () => {
      getUploadedFilesList();
    };
    window.addEventListener("fileUploaded", handleFileUploaded);
    return () => window.removeEventListener("fileUploaded", handleFileUploaded);
  }, [getUploadedFilesList]);

  const handleSelectThread = (threadId: string) => {
    if (threadId !== activeThreadId) {
      setMessages([]);
      loadMessagesForThread(threadId);
    }

    setCurrentScreen("chat");
  };

  const handleNewThread = async () => {
    if (!activeSection?.assistantId) {
      toast({
        title: "Error",
        description: "Cannot start new chat without an active assistant.",
        variant: "destructive",
      });
      return;
    }
    console.log("Creating new chat with welcome message...");
    setLoading(true); // Show loading indicator
    setIsInitialLoading(true);

    try {
      const welcomeResponse = await fetch(`/api/chat/welcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assistantId: activeSection.assistantId }),
      });

      if (!welcomeResponse.ok) {
        const errorData = await welcomeResponse.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create welcome thread");
      }

      const welcomeData: { thread: Thread; message: Message } = await welcomeResponse.json();

      // Add the new thread to the *beginning* of the list
      setThreads((prevThreads) => [welcomeData.thread, ...prevThreads]);
      setMessages([welcomeData.message]);
      setActiveThreadId(welcomeData.thread.id);
      setCurrentScreen("chat");
    } catch (error: any) {
      console.error("Error creating new welcome thread:", error);
      toast({ title: "Error", description: error.message || "Failed to start new chat", variant: "destructive" });
    } finally {
      setLoading(false);
      setIsInitialLoading(false);
    }
  };

  const handleUpdateThreadTitle = useCallback(
    async (threadId: string, newTitle: string) => {
      if (!threadId || !newTitle) return;

      // Optimistic UI update
      const previousThreads = [...threads];
      setThreads(
        (prevThreads) =>
          prevThreads
            .map((thread) =>
              thread.id === threadId ? { ...thread, title: newTitle, updated_at: new Date().toISOString() } : thread,
            )
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()), // Re-sort after update
      );

      try {
        const response = await fetch(`/api/chat/threads/${threadId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newTitle }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Failed to update title" }));
          throw new Error(errorData.error || "Server error updating title");
        }

        toast({ title: "Success", description: "Thread title updated." });
      } catch (error: any) {
        console.error("Failed to update thread title:", error);
        toast({
          title: "Error updating title",
          description: error.message || "Could not update thread title.",
          variant: "destructive",
        });
        // Rollback optimistic update on error
        setThreads(previousThreads);
      }
    },
    [threads, setThreads, toast],
  );

  const getFilteredContext = useCallback(() => {
    // Early return if context or data is missing
    if (!context?.data || typeof context.data !== "object") {
      return { data: null, filters: context?.filters || null }; // Return the whole context structure
    }

    const dataKeys = Object.keys(context.data);
    const isEmailList = dataKeys.length > 1;
    const filters = context.filters;
    const hasFilters =
      filters &&
      ((Array.isArray(filters.priorities) && filters.priorities.length > 0) ||
        (Array.isArray(filters.topics) && filters.topics.length > 0));

    let filteredData: Record<string, unknown> | null = context.data;

    // Apply filters only if data is a list and filters exist
    if (isEmailList && hasFilters) {
      const filterPriorities = (filters?.priorities as string[] | undefined) || [];
      const filterTopics = (filters?.topics as string[] | undefined) || [];

      filteredData = Object.entries(context.data)
        .filter(([_, emailValue]) => {
          // Ensure emailValue is treated as Email type for filtering
          const email = emailValue as Email;
          const priorityMatch = email.priority && filterPriorities.includes(email.priority);
          const topicMatch = email.topic && filterTopics.includes(email.topic);
          return priorityMatch || topicMatch;
        })
        .slice(0, 20)
        .reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {} as Record<string, unknown>)

      // If filtering results in an empty object, set data to null
      if (Object.keys(filteredData).length === 0) {
        filteredData = null;
      }
    }

    delete filteredData?.body;
    delete filteredData?.bodyPlain;

    return {
      data: filteredData,
      filters: context.filters,
    };
  }, [context]);

  const handleFirstWordReceived = useCallback(() => {
    setMessages(prevMessages => prevMessages.filter(msg => msg.id !== THINKING_MSG_ID));
    setFirstWordHasBeenReceived(true);
  }, [setMessages]);

  const generateDraftFromAPI = useCallback(async (messageForAIDraft: string): Promise<string | null> => {
    if (!activeSection?.assistantId) {
      toast({ title: "No active assistant", description: "Cannot draft response without an active assistant.", variant: "destructive" });
      return null;
    }
    if (!activeEmail) {
      toast({ title: "No active email", description: "Cannot generate draft without an active email.", variant: "destructive" });
      return null;
    }

    setIsDrafting(true);

    try {
      const { data: contextForApi } = getFilteredContext();

      const response = await fetch("/api/chat/draft-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageForAIDraft, 
          context: contextForApi, 
          assistantId: activeSection.assistantId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to generate draft" }));
        throw new Error(errorData.error || "Server error generating draft");
      }

      const result = await response.json();
      if (result.draft) {
        return result.draft;
      } else {
        throw new Error("No draft content received from server.");
      }
    } catch (e: any) {
      console.error("Failed to generate draft via API:", e);
      toast({ title: "Error generating draft", description: e.message || "An error occurred.", variant: "destructive" });
      return null;
    } finally {
      setIsDrafting(false);
    }
  }, [activeSection, activeEmail, getFilteredContext, toast]);

  const handleStreamMessage = useCallback(
    async (
      messageContent: string,
      originalOnWord: (word: string) => void,
      options?: {
        fileId?: string;
        hiddenMessage?: boolean;
        assistantId?: string;
      },
    ) => {
      if (!activeSection?.assistantId) {
        toast({ title: "Error", description: "No active assistant selected.", variant: "destructive" });
        return;
      }
      
      setFirstWordHasBeenReceived(false);

      let currentActiveThreadId = activeThreadId;
      let newThreadJustCreatedByStreamAPI = false;
      const { data: contextToSend } = getFilteredContext();
      let wasError = false;

      const fetchStreamPromise = fetch(`/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageContent,
          thread_id: currentActiveThreadId,
          assistantId: options?.assistantId || activeSection.assistantId,
          filename: options?.fileId,
          hiddenMessage: options?.hiddenMessage,
          context: contextToSend,
        }),
      });

      setTimeout(() => {
        setLoading(true);
        if (currentActiveThreadId && activeSection?.assistantId) {
          const thinkingMessage: Message = {
            id: THINKING_MSG_ID,
            thread_id: currentActiveThreadId,
            role: "assistant",
            content: "[[ASSISTANT_THINKING]]",
            created_at: new Date().toISOString(),
            user_id: null,
            assistant_id: activeSection.assistantId,
            completed: false,
            metadata: { type: "thinking_indicator" }
          };
          setMessages(prevMessages => {
            if (prevMessages.find(msg => msg.id === THINKING_MSG_ID)) {
              return prevMessages;
            }
            return [...prevMessages, thinkingMessage];
          });
        }
      }, 1500);

      try {
        const response = await fetchStreamPromise;
        const newThreadIdHeader = response.headers.get("X-Thread-ID");
        if (newThreadIdHeader && newThreadIdHeader !== currentActiveThreadId) {
          console.log("[ChatContainer] New thread ID from header:", newThreadIdHeader);
          setActiveThreadId(newThreadIdHeader);
          currentActiveThreadId = newThreadIdHeader;
          newThreadJustCreatedByStreamAPI = true;
          loadInitialChatData(activeSection.assistantId);
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Streaming failed" }));
          throw new Error(errorData.error || "Failed to stream message");
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No reader available");

        let assistantFullResponse = "";
        const textDecoder = new TextDecoder();
        let internalFirstWordHandled = false;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = textDecoder.decode(value, { stream: true });
            assistantFullResponse += chunk;
            originalOnWord(chunk);


            if (!internalFirstWordHandled && chunk.trim().length > 0) {
              handleFirstWordReceived();
              internalFirstWordHandled = true;
            }
          }
          const finalChunk = textDecoder.decode();
          if (finalChunk) {
            assistantFullResponse += finalChunk;
            originalOnWord(finalChunk);
            if (!internalFirstWordHandled && finalChunk.trim().length > 0) {
              handleFirstWordReceived();
            }
          }
        } finally {
          console.log("[ChatContainer] Releasing reader lock");
          reader.releaseLock();
          setLoading(false);
        }

        // ---- NEW TITLE UPDATE LOGIC ----
        if (currentActiveThreadId && assistantFullResponse.trim().length > 0) {
          const threadToUpdate = threads.find((t) => t.id === currentActiveThreadId);

          const needsTitleUpdate =
            newThreadJustCreatedByStreamAPI || threadToUpdate?.title === "Email Management" || !threadToUpdate?.title;

          if (needsTitleUpdate) {
            let newTitle = generateFallbackTitleFromResponse(assistantFullResponse);

            try {
              console.log(
                `[ChatContainer] Attempting to summarize response for title, length: ${assistantFullResponse.length}`,
              );
              const summarizeResponse = await fetch("/api/chat/summarize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: assistantFullResponse }),
              });

              if (summarizeResponse.ok) {
                const summaryData = await summarizeResponse.json();
                if (summaryData.summary && summaryData.summary.trim().length > 0) {
                  newTitle = summaryData.summary.trim();
                  console.log(`[ChatContainer] Summary successful, new title: "${newTitle}"`);
                } else {
                  console.warn("[ChatContainer] Summarization API returned empty summary, using fallback title.");
                }
              } else {
                const errorText = await summarizeResponse.text();
                console.warn(
                  `[ChatContainer] Summarization API call failed (status: ${summarizeResponse.status}, error: ${errorText}), using fallback title.`,
                );
              }
            } catch (summaryError) {
              console.error("[ChatContainer] Error calling summarization API, using fallback title:", summaryError);
            }

            if (
              newTitle &&
              newTitle !== threadToUpdate?.title &&
              (newTitle !== "New Chat" || assistantFullResponse.trim().length > 10) &&
              newTitle.length > 0
            ) {
              console.log(
                `[ChatContainer] Updating title for thread ${currentActiveThreadId} to: "${newTitle}" (after summary/fallback)`,
              );
              try {
                const patchResponse = await fetch(`/api/chat/threads/${currentActiveThreadId}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ title: newTitle }),
                });

                if (patchResponse.ok) {
                  setThreads((prevThreads) =>
                    prevThreads
                      .map((thread) =>
                        thread.id === currentActiveThreadId
                          ? { ...thread, title: newTitle, updated_at: new Date().toISOString() }
                          : thread,
                      )
                      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
                  );
                } else {
                  console.error("[ChatContainer] Failed to update thread title via API:", await patchResponse.text());
                  toast({ title: "Error", description: "Could not update chat title.", variant: "destructive" });
                }
              } catch (error) {
                console.error("[ChatContainer] Error calling update thread title API:", error);
                toast({
                  title: "Error",
                  description: "Failed to update chat title due to a network error.",
                  variant: "destructive",
                });
              }
            }
          }
        }
        // ---- END NEW TITLE UPDATE LOGIC ----

        if (currentActiveThreadId) {
          if (!internalFirstWordHandled) {
             setMessages(prevMessages => prevMessages.filter(msg => msg.id !== THINKING_MSG_ID));
          }
          await loadMessagesForThread(currentActiveThreadId);

          setThreads((prevThreads) => {
            const threadExists = prevThreads.some((thread) => thread.id === currentActiveThreadId);

            if (
              !threadExists &&
              newThreadJustCreatedByStreamAPI &&
              currentActiveThreadId &&
              activeSection?.assistantId
            ) {
              const titleToSet =
                threads.find((t) => t.id === currentActiveThreadId)?.title ||
                generateFallbackTitleFromResponse(assistantFullResponse);

              return [
                {
                  id: currentActiveThreadId,
                  title: titleToSet,
                  updated_at: new Date().toISOString(),
                  assistant_id: activeSection.assistantId,
                  created_at: new Date().toISOString(),
                } as Thread,
                ...prevThreads,
              ].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
            }
            return prevThreads
              .map((thread) =>
                thread.id === currentActiveThreadId ? { ...thread, updated_at: new Date().toISOString() } : thread,
              )
              .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
          });
        }
      } catch (error: any) {
        console.error("Streaming error:", error);
        toast({
          title: "Streaming Error",
          description: error.message || "Failed to get response.",
          variant: "destructive",
        });
        wasError = true;
      } finally {
        setLoading(false);
        if (!firstWordHasBeenReceived) {
           setMessages(prevMessages => prevMessages.filter(msg => msg.id !== THINKING_MSG_ID));
        }
        
        if (newThreadJustCreatedByStreamAPI && !wasError && activeSection?.assistantId) {
          loadInitialChatData(activeSection.assistantId).catch((e) =>
            console.error("Background reload failed after new thread creation:", e),
          );
        }
      }
    },
    [
      activeSection,
      activeThreadId,
      loadInitialChatData,
      loadMessagesForThread,
      setLoading,
      setThreads,
      threads,
      toast,
      context,
      getFilteredContext,
      handleFirstWordReceived,
      firstWordHasBeenReceived,
    ],
  );

  const handleExpandClick = () => {
    setIsExpanded(!isExpanded);
  };

  const handleHomeClick = () => {
    setCurrentScreen("home");
  };
  const handleMessagesClick = () => {
    setCurrentScreen("messages");
    setMessageRead(true);
  };
  const handleBackClick = () => {
    setCurrentScreen("messages");
  };

  const handleAddUserMessage = useCallback(
    (message: Message) => {
      // Delay adding the user message to the UI by 0.5 seconds
      setTimeout(() => {
        setMessages((prevMessages) => [...prevMessages, message]);
      }, 500);
    },
    [setMessages],
  );

  const screenVariants: Variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0,
    }),
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <div className="absolute bottom-16 right-0">
            <motion.div
              animate={{ width: isExpanded ? 640 : 320 }}
              transition={{
                width: {
                  type: "spring",
                  bounce: 0,
                  duration: 0.3,
                },
              }}
            >
              <Card className="overflow-hidden rounded-2xl shadow-chat dark:bg-gray-950 dark:border-gray-800">
                <div className="relative h-[500px]">
                  <AnimatePresence mode="wait" initial={false}>
                    {currentScreen === "home" && (
                      <HomeScreen onNewThread={handleNewThread} screenVariants={screenVariants} loading={loading} />
                    )}

                    {currentScreen === "chat" && (
                      <Chat
                        messages={messages}
                        onStreamMessage={handleStreamMessage}
                        uploadedFiles={uploadedFiles}
                        loading={loading}
                        isDrafting={isDrafting}
                        activeThreadId={activeThreadId}
                        handleBackClick={handleBackClick}
                        handleExpandClick={handleExpandClick}
                        isExpanded={isExpanded}
                        screenVariants={screenVariants}
                        onAddUserMessage={handleAddUserMessage}
                        threads={threads}
                        onGenerateDraft={generateDraftFromAPI}
                      />
                    )}

                    {currentScreen === "messages" && (
                      <MessagesScreen
                        threads={threads}
                        activeThreadId={activeThreadId}
                        onSelectThread={handleSelectThread}
                        onNewThread={handleNewThread}
                        onUpdateThreadTitle={handleUpdateThreadTitle}
                        messages={messages}
                        uploadedFiles={uploadedFiles}
                        onStreamMessage={handleStreamMessage}
                        loading={loading}
                        isInitialLoading={isInitialLoading}
                        handleAskQuestion={handleNewThread}
                        handleExpandClick={handleExpandClick}
                        isExpanded={isExpanded}
                        screenVariants={screenVariants}
                      />
                    )}
                  </AnimatePresence>
                </div>

                <NavigationBar
                  handleHomeClick={handleHomeClick}
                  handleMessagesClick={handleMessagesClick}
                  messageRead={messageRead}
                />
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {isOpen ? (
        <Button
          onClick={() => setIsOpen(!isOpen)}
          className="relative flex items-center justify-center w-14 h-14  text-white rounded-full bg-slate-600 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 shadow-lg"
          asChild
        >
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <ChevronDown className="!w-6 !h-6" />
          </motion.button>
        </Button>
      ) : (
        <Button
          onClick={() => setIsOpen(!isOpen)}
          className="relative flex items-center justify-center w-14 h-14  text-white shadow-none rounded-none bg-transparent p-0 hover:bg-transparent dark:hover:bg-transparent dark:bg-transparent"
        >
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Image
              src={PROJECT_CONFIG.chatIconUrl}
              alt="Chat Bubble"
              width={48}
              height={48}
              className="min-w-14 h-14 z-5"
            />
            {!messageRead && (
              <div className="absolute -top-1 -right-1 z-10 flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full">
                1
              </div>
            )}
          </motion.button>
        </Button>
      )}
    </div>
  );
}

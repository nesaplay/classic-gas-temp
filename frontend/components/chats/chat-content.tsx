"use client";

import type React from "react";
import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";
import { useEmailStore, EMAIL_PRIORITIES, EMAIL_TOPICS } from "@/lib/store/use-email-store";
import { useToast } from "@/hooks/use-toast";
import { PROJECT_CONFIG } from "@/lib/constants";
import { useChatStore } from "@/lib/store/use-chat-store";
import { ScrollArea } from "@/components/ui/scroll-area";

import ChatMessageList from "./components/ChatMessageList";
import ChatActionButtons from "./components/ChatActionButtons";
import TaggedElements from "./components/TaggedElements";
import ChatInputArea from "./components/ChatInputArea";

type Message = Database["public"]["Tables"]["messages"]["Row"];
type UploadedFile = {
  id: string;
  filename: string;
};

interface StreamingWord {
  id: number;
  text: string;
}

interface ActiveTag {
  type: 'file' | 'priority' | 'topic';
  value: string;
}

interface ChatContentProps {
  messages: Message[];
  onClearChat: () => void;
  onStreamMessage: (
    messageContent: string,
    onWordForContainer: (word: string) => void,
    options?: {
      fileId?: string;
      hiddenMessage?: boolean;
      assistantId?: string;
    }
  ) => Promise<void>;
  taggedFiles: UploadedFile[];
  loading: boolean;
  isDrafting: boolean;
  activeThreadId: string | null;
  onAddUserMessage: (message: Message) => void;
  onFirstWordReceived?: () => void;
  onGenerateDraft: (messageToDraftAbout: string) => Promise<string | null>;
}

const ChatContent = ({
  messages,
  onClearChat,
  onStreamMessage,
  taggedFiles,
  loading,
  isDrafting,
  activeThreadId,
  onAddUserMessage,
  onFirstWordReceived,
  onGenerateDraft,
}: ChatContentProps) => {
  const [inputValue, setInputValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingWords, setStreamingWords] = useState<StreamingWord[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const [isWaiting, setIsWaiting] = useState(false);
  const shouldFocusAfterStreamingRef = useRef(false);
  const [user, setUser] = useState<User | null>(null);
  const supabase = createClient();
  const { activeSection, setContext } = useChatStore();

  const [isSending, setIsSending] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const [mentionPopoverOpen, setMentionPopoverOpen] = useState(false);
  const commandRef = useRef<HTMLDivElement>(null);
  const [activeTags, setActiveTags] = useState<ActiveTag[]>([]);
  const { activeEmail, deleteEmails, draftEmailResponse, summarizeEmail, sendActiveEmail, emails } = useEmailStore();
  const { toast } = useToast();

  const [isNearBottom, setIsNearBottom] = useState(true);
  const scrollViewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkMobileAndViewport = () => {
      const isMobileDevice = window.innerWidth < 768;
      setIsMobile(isMobileDevice);
      const vh = window.innerHeight;
      setViewportHeight(vh);
    };
    checkMobileAndViewport();
    window.addEventListener("resize", checkMobileAndViewport);
    return () => {
      window.removeEventListener("resize", checkMobileAndViewport);
    };
  }, [isMobile, viewportHeight]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingWords]);

  useEffect(() => {
    if (textareaRef.current && !isMobile) {
      textareaRef.current.focus();
    }
  }, [isMobile]);

  useEffect(() => {
    if (!isStreaming && shouldFocusAfterStreamingRef.current && !isMobile) {
      focusTextarea();
      shouldFocusAfterStreamingRef.current = false;
    }
  }, [isStreaming, isMobile]);

  const focusTextarea = () => {
    if (textareaRef.current && !isMobile) {
      textareaRef.current.focus();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputValue(value);
    handleTagDetection(value, textareaRef.current?.selectionStart);
  };

  const insertTag = (type: 'file' | 'priority' | 'topic', value: string) => {
    if (!textareaRef.current) return;
    const currentCursorPos = textareaRef.current.selectionStart;
    const textBeforeCursor = inputValue.substring(0, currentCursorPos);
    const atIndex = textBeforeCursor.lastIndexOf("@");
    if (atIndex === -1) return;
    const beforeAt = inputValue.substring(0, atIndex);
    const afterCursor = inputValue.substring(currentCursorPos);
    const newTag: ActiveTag = { type, value };
    if (activeTags.some(tag => tag.type === newTag.type && tag.value === newTag.value)) {
        setMentionPopoverOpen(false);
        const newValue = `${beforeAt}${afterCursor}`;
        setInputValue(newValue);
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                textareaRef.current.setSelectionRange(beforeAt.length, beforeAt.length);
            }
        }, 0);
        return;
    }
    const newValue = `${beforeAt}${afterCursor}`;
    setInputValue(newValue);
    setMentionPopoverOpen(false);
    setActiveTags(prev => [...prev, newTag]);
    setTimeout(() => {
      if (textareaRef.current) {
        const newPosition = beforeAt.length;
        textareaRef.current.setSelectionRange(newPosition, newPosition);
        textareaRef.current.focus();
      }
    }, 0);
  };

  const generateUniqueId = (prefix: string) => {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  };

  const onMessageSent = async (text: string, options?: { hiddenMessage?: boolean, assistantId?: string, fileId?: string }) => {
    const hiddenMessage = options?.hiddenMessage ?? false;
    const assistantIdOverride = options?.assistantId;
    const fileIdToSend = options?.fileId;
    if (!hiddenMessage) {
      const tempUserMessage: Message = {
        id: generateUniqueId("temp-user"),
        thread_id: activeThreadId || "",
        user_id: user?.id || "",
        assistant_id: null,
        role: "user",
        content: text,
        created_at: new Date().toISOString(),
        completed: true,
        metadata: null,
      };
      onAddUserMessage(tempUserMessage);
    }
    setTimeout(() => {
      setIsWaiting(true);
      setIsStreaming(true);
    }, 1500);
    shouldFocusAfterStreamingRef.current = true;
    setStreamingWords([]);
    let firstWordReceivedForUI = false;
    try {
      await onStreamMessage(
        text,
        (wordChunkFromContainer) => {
          if (!firstWordReceivedForUI) {
            setIsWaiting(false); 
            firstWordReceivedForUI = true;
            if (onFirstWordReceived) {
              onFirstWordReceived();
            }
          }
          setStreamingWords((prev) => [...prev, { id: Date.now() + Math.random(), text: wordChunkFromContainer }]);
        },
        {
          hiddenMessage,
          fileId: fileIdToSend,
          assistantId: assistantIdOverride
        }
      );
    } catch (error) {
      console.error("Error during streaming callback:", error);
      setIsWaiting(false); 
      setIsStreaming(false);
    } finally {
      setIsStreaming(false); 
      if (!firstWordReceivedForUI) {
        setIsWaiting(false);
      }
      setStreamingWords([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isStreaming || loading || isDrafting) return;
    const currentInput = inputValue.trim();
    setInputValue("");
    let fileIdForMessage: string | undefined = undefined;
    const fileTag = activeTags.find(tag => tag.type === 'file');
    if (fileTag && taggedFiles) {
      const matchedFile = taggedFiles.find(tf => tf.filename === fileTag.value);
      if (matchedFile) {
        fileIdForMessage = matchedFile.id;
      } else {
        console.warn(`[ChatContent] Tagged file "${fileTag.value}" not found in available taggedFiles list. Available:`, taggedFiles);
      }
    }
    setActiveTags([]);
    try {
      await onMessageSent(currentInput, { fileId: fileIdForMessage });
    } catch (error) {
      console.error("Error during streaming callback:", error);
    }
  };

  const handleTagDetection = (value: string, currentCursorPos?: number) => {
    if (currentCursorPos === undefined) return;
    const textBeforeCursor = value.substring(0, currentCursorPos);
    const atIndex = textBeforeCursor.lastIndexOf("@");
    if (atIndex !== -1) {
        const query = value.substring(atIndex + 1, currentCursorPos);
        setMentionPopoverOpen(true); 
    } else {
        setMentionPopoverOpen(false);
    }
  };

  const removeTag = (tagToRemove: ActiveTag) => {
    setActiveTags(prev => prev.filter(tag => 
        !(tag.type === tagToRemove.type && tag.value === tagToRemove.value)
    ));
    let tagString = "";
    if (tagToRemove.type === 'file') tagString = `@${tagToRemove.value}`; 
    else if (tagToRemove.type === 'priority') tagString = `@Priority:${tagToRemove.value}`; 
    else tagString = `@Topic:${tagToRemove.value}`;
    if (inputValue.includes(tagString + ' ')) tagString += ' ';
    setInputValue(prev => prev.replace(tagString, ''));
    setTimeout(() => textareaRef.current?.focus(), 0); 
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function getUserData() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (isMounted) setUser(currentUser);
    }
    getUserData();
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (isMounted) setUser(session?.user ?? null);
    });
    return () => {
      isMounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    const filters = {
      priorities: activeTags.filter(t => t.type === 'priority').map(t => t.value),
      topics: activeTags.filter(t => t.type === 'topic').map(t => t.value),
    };
    if (filters.priorities.length > 0 || filters.topics.length > 0) {
        setContext({ filters });
    } else {
        setContext({ filters: {} }); 
    }
  }, [activeTags, setContext]);

  const handleDailyDigest = async () => {
    if (isDrafting || loading || activeEmail) return;
    try {
      const dailyDigestAssistantId = PROJECT_CONFIG.sections.find(s => s.id === "executive-summary")?.assistantId;
      await onMessageSent('Generate a daily digest report for the emails in my inbox.', { 
          hiddenMessage: true, 
          assistantId: dailyDigestAssistantId 
      });
    } catch (error) {
      console.error("Error sending daily digest:", error);
    }
  }

  const handleDraft = async () => {
    if (isDrafting) return;
    if (!activeEmail) {
      toast({ title: "No active email", description: "Please select an email to draft a response.", variant: "destructive" });
      return;
    }
    if (!activeSection?.assistantId) {
      toast({ title: "No active assistant", description: "Cannot draft response without an active assistant.", variant: "destructive" });
      return;
    }


    try {
      const messageToDraftAbout = await draftEmailResponse(activeEmail); 
      const generatedDraft = await onGenerateDraft(messageToDraftAbout);

      if (generatedDraft !== null) {
        setInputValue(generatedDraft);
        toast({ title: "Draft ready", description: "The draft has been populated in the input field.", variant: "default" });
        focusTextarea();
      } else {
        console.log("[ChatContent] Draft generation returned null, possibly handled by container.");
      }
    } catch (e: any) {
      console.error("Failed to generate or set email draft in ChatContent:", e);
      toast({ 
        title: "Error generating draft", 
        description: e.message || "An unexpected error occurred.", 
        variant: "destructive" 
      });
    }
  };

  const handleSend = async () => {
    if (!activeEmail || isSending) return;
    setIsSending(true);
    const lastAssistantMessage = messages.slice().reverse().find(m => m.role === 'assistant');
    let messageToSend = inputValue.trim();
    if (!messageToSend && lastAssistantMessage?.content && typeof lastAssistantMessage.content === 'string') {
        if (lastAssistantMessage.content.startsWith('{')) {
            try {
                const parsed = JSON.parse(lastAssistantMessage.content);
                messageToSend = parsed.text || parsed.draft || lastAssistantMessage.content;
            } catch { 
                 messageToSend = lastAssistantMessage.content;
            }
        } else {
             messageToSend = lastAssistantMessage.content;
        }
    }
    if (!messageToSend) {
        console.error("Cannot send: No message content available from input or last assistant message.");
        alert("No message content to send.");
        setIsSending(false);
        return;
    }
    try {
       await sendActiveEmail(activeEmail.id, messageToSend);
       toast({ title: `Email Sent to ${activeEmail.sender}`, description: "Your email has been sent successfully." });
       setInputValue("");
    } catch (error) {
         console.error("Error sending email:", error);
         alert(`Error sending email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
         setIsSending(false);
    }
  };

  const handleDelete = async () => {
    if (!activeEmail || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteEmails([activeEmail.id]);
      toast({ title: `Email Deleted`, description: "Your email has been deleted successfully." });
    } catch (error) {
      console.error("Error deleting email:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSummarize = async () => {
    if (!activeEmail || isSummarizing || isDrafting || loading) return;
    setIsSummarizing(true); 
    const assistantId = PROJECT_CONFIG.assistants.find(a => a.id === "email-management")?.assistantId;
    try {
      const message = await summarizeEmail(activeEmail);
      await onMessageSent(message, { 
        hiddenMessage: true, 
        assistantId: assistantId
      });
    } catch (error) {
      console.error("Error summarizing email:", error);
    } finally {
      setIsSummarizing(false);
    }
  };

  useEffect(() => {
    const viewport = scrollViewportRef.current;
    if (viewport && isNearBottom) {
      setTimeout(() => {
         messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 10);
    }
  }, [messages, streamingWords]);

  const handleScroll = () => {
    const viewport = scrollViewportRef.current;
    if (viewport) {
      const threshold = 50;
      const position = viewport.scrollTop + viewport.clientHeight;
      const atOrNearBottom = viewport.scrollHeight - position <= threshold;
      if (atOrNearBottom !== isNearBottom) {
        setIsNearBottom(atOrNearBottom);
      }
    }
  };

  return (
    <div className="flex flex-col h-full relative">
      <ScrollArea ref={scrollViewportRef} onScroll={handleScroll} className="flex-1 min-h-0 pr-4">
          <ChatMessageList
            messages={messages}
            isWaiting={isWaiting}
            isStreaming={isStreaming}
            streamingWords={streamingWords}
            messagesEndRef={messagesEndRef}
          />
      </ScrollArea>

      <div ref={inputContainerRef} className="bg-white dark:bg-gray-950 border-t dark:border-gray-800 p-4">
        <ChatActionButtons
          activeEmail={activeEmail}
          handleDraft={handleDraft}
          handleSummarize={handleSummarize}
          handleSend={handleSend}
          handleDelete={handleDelete}
          handleDailyDigest={handleDailyDigest}
          isDrafting={isDrafting}
          isSummarizing={isSummarizing}
          isSending={isSending}
          isDeleting={isDeleting}
        />

        <TaggedElements activeTags={activeTags} removeTag={removeTag} />

        <ChatInputArea
          inputValue={inputValue}
          handleInputChange={handleInputChange}
          handleKeyDown={handleKeyDown}
          handleSubmit={handleSubmit}
          textareaRef={textareaRef}
          mentionPopoverOpen={mentionPopoverOpen}
          setMentionPopoverOpen={setMentionPopoverOpen}
          commandRef={commandRef}
          availableFiles={taggedFiles}
          availablePriorities={EMAIL_PRIORITIES}
          availableTopics={EMAIL_TOPICS}
          insertTag={insertTag}
          isStreaming={isStreaming}
          loading={loading || isDrafting}
        />
      </div>
    </div>
  );
};

export default ChatContent;

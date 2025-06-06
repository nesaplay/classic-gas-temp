"use client";
import { useState } from "react";
import * as React from "react";
import { Minimize2, Maximize2, PlusCircle, Pencil } from "lucide-react";
import { motion, Variants } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { List, ListItem } from "@/components/ui/list";
import { formatDistance, formatRelative } from "date-fns";
import { Database } from "@/types/supabase";
import { useUserStore } from "@/lib/store/use-user-store";

type Message = Database["public"]["Tables"]["messages"]["Row"];
type Thread = Pick<
  Database["public"]["Tables"]["threads"]["Row"],
  "id" | "title" | "updated_at" | "assistant_id" | "created_at"
>;
type UploadedFile = {
  id: string;
  filename: string;
};

interface MessagesScreenProps {
  handleAskQuestion: () => void;
  handleExpandClick: () => void;
  isExpanded: boolean;
  screenVariants: Variants;
  threads: Thread[];
  activeThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onNewThread: () => void;
  messages: Message[];
  uploadedFiles: UploadedFile[];
  onStreamMessage: (
    messageContent: string,
    onWord: (word: string) => void,
    { fileId, hiddenMessage }: { fileId?: string; hiddenMessage?: boolean },
  ) => Promise<void>;
  loading: boolean;
  isInitialLoading: boolean;
  onUpdateThreadTitle: (threadId: string, newTitle: string) => void;
}

export function MessagesScreen({
  handleExpandClick,
  isExpanded,
  threads,
  activeThreadId,
  onSelectThread,
  onNewThread,
  onUpdateThreadTitle,
}: MessagesScreenProps) {
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");

  const handleTitleUpdate = () => {
    if (editingThreadId && editingTitle.trim()) {
      // Check if the title actually changed
      const originalThread = threads.find((t) => t.id === editingThreadId);
      const originalTitle = originalThread?.title || `Chat ${editingThreadId.substring(0, 6)}...`;
      if (editingTitle.trim() !== originalTitle) {
        onUpdateThreadTitle(editingThreadId, editingTitle.trim());
      }
    }
    setEditingThreadId(null);
    setEditingTitle("");
  };

  const handleTitleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      handleTitleUpdate();
    } else if (event.key === "Escape") {
      setEditingThreadId(null);
      setEditingTitle("");
    }
  };

  const handleTitleBlur = () => {
    // Use a short timeout to allow click on the edit button of another item
    // without triggering blur first, which would cause unintended selection.
    setTimeout(() => {
      handleTitleUpdate();
    }, 100);
  };

  return (
    <motion.div key="messages-main" className="flex-1 flex flex-col relative h-full">
      <div className="border-b dark:border-gray-800 p-4 flex items-center justify-between h-[65px]">
        <div className="w-8"></div>
        <h2 className="text-xl font-medium dark:text-white">Messages</h2>
        <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800" onClick={handleExpandClick}>
          {isExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </button>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden h-full">
        <div className="flex-1 overflow-y-auto pr-1">
          <List>
            {threads.length === 0 && <ListItem className="text-sm text-muted-foreground px-2 border-b">No chats yet.</ListItem>}
            {threads.map((thread) => (
              <ListItem
                key={thread.id}
                selected={activeThreadId === thread.id}
                onClick={() => {
                  if (editingThreadId !== thread.id) {
                    onSelectThread(thread.id);
                  }
                }}
                title={thread.title || `Chat from ${formatRelative(new Date(thread.created_at), new Date())}`}
                className="justify-between h-auto py-3"
              >
                {editingThreadId === thread.id ? (
                  <Input
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onBlur={handleTitleBlur}
                    onKeyDown={handleTitleKeyDown}
                    className="h-6 mr-4 px-1 py-0"
                    autoFocus
                    onFocus={(e) => e.target.select()}
                  />
                ) : (
                  <span className="truncate flex-1 mr-2 font-medium">{thread.title || `Chat ${thread.id.substring(0, 6)}...`}</span>
                )}
                <div className="flex items-center shrink-0 space-x-1">
                  <span className="text-xs text-muted-foreground">
                    {thread.updated_at
                      ? formatDistance(new Date(thread.updated_at), new Date(), { addSuffix: true })
                      : ""}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 z-10 h-6 w-6 p-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground focus:outline-none bg-background shadow-md rounded"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingThreadId(thread.id);
                      setEditingTitle(thread.title || `Chat ${thread.id.substring(0, 6)}...`);
                    }}
                    aria-label="Edit thread title"
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                </div>
              </ListItem>
            ))}
          </List>
        </div>

        <div className="p-2 border-t dark:border-gray-800">
          <Button
            variant="default"
            className="w-full justify-center h-10 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={onNewThread}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            New Chat
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

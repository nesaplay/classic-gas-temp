"use client";

import type React from "react";
import { ArrowUp, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { PopoverAnchor } from "@radix-ui/react-popover";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EMAIL_PRIORITIES, EMAIL_TOPICS } from "@/lib/store/use-email-store";
import { useEffect } from 'react';

type UploadedFile = {
  id: string;
  filename: string;
};

type EmailPriority = typeof EMAIL_PRIORITIES[number];
type EmailTopic = typeof EMAIL_TOPICS[number];

interface ChatInputAreaProps {
  inputValue: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  mentionPopoverOpen: boolean;
  setMentionPopoverOpen: (open: boolean) => void;
  commandRef: React.RefObject<HTMLDivElement | null>;
  availableFiles: UploadedFile[];
  availablePriorities: readonly EmailPriority[];
  availableTopics: readonly EmailTopic[];
  insertTag: (type: 'file' | 'priority' | 'topic', value: string) => void;
  isStreaming: boolean;
  loading: boolean;
}

const ChatInputArea = ({
  inputValue,
  handleInputChange,
  handleKeyDown,
  handleSubmit,
  textareaRef,
  mentionPopoverOpen,
  setMentionPopoverOpen,
  commandRef,
  availableFiles,
  availablePriorities,
  availableTopics,
  insertTag,
  isStreaming,
  loading,
}: ChatInputAreaProps) => {
  const atIndex = inputValue.lastIndexOf("@");
  const query = mentionPopoverOpen && atIndex !== -1 && textareaRef.current?.selectionStart ? 
                inputValue.substring(atIndex + 1, textareaRef.current.selectionStart).toLowerCase() : '';

  const filteredFiles = availableFiles.filter(file => 
    file.filename.toLowerCase().includes(query)
  );
  const filteredPriorities = availablePriorities.filter(priority => 
    priority.toLowerCase().includes(query) || `priority:${priority.toLowerCase()}`.includes(query)
  );
  const filteredTopics = availableTopics.filter(topic => 
    topic.toLowerCase().includes(query) || `topic:${topic.toLowerCase()}`.includes(query)
  );

  const hasSuggestions = filteredFiles.length > 0 || filteredPriorities.length > 0 || filteredTopics.length > 0;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.overflowY = 'hidden';
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputValue, textareaRef]);

  return (
    <Popover open={mentionPopoverOpen && hasSuggestions} onOpenChange={setMentionPopoverOpen}>
      <PopoverContent
        className="w-64 p-0 command-popover"
        sideOffset={0}
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command ref={commandRef}>
          <CommandGroup className="text-xs max-h-60 overflow-y-auto">
            {filteredFiles.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-[13px] font-semibold text-gray-700 border-t border-gray-100 dark:border-gray-800 mt-1 pt-1">Files</div>
                {filteredFiles.map((file) => (
                  <CommandItem
                    key={`file-${file.id}`}
                    onSelect={() => insertTag('file', file.filename)}
                    className="cursor-pointer py-1.5 px-2 text-xs flex items-center gap-1"
                  >
                    <FileText className="h-3 w-3 text-gray-400" />
                    {file.filename}
                  </CommandItem>
                ))}
              </>
            )}
            {filteredPriorities.length > 0 && (
              <>
                 <div className="px-2 py-1.5 text-[13px] font-semibold text-gray-700 border-t border-gray-100 dark:border-gray-800 mt-1 pt-1">Priorities</div>
                {filteredPriorities.map((priority) => (
                  <CommandItem
                    key={`priority-${priority}`}
                    onSelect={() => insertTag('priority', priority)}
                    className="cursor-pointer py-1.5 px-2 text-xs flex items-center gap-1"
                  >
                    <Badge
                      variant="outline"
                      className={cn(
                        "capitalize text-xs px-1.5 py-0 w-fit",
                      )}
                    >
                      {priority.toLowerCase()}
                    </Badge>
                  </CommandItem>
                ))}
              </>
            )}
            {filteredTopics.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-[13px] font-semibold text-gray-700 border-t border-gray-100 dark:border-gray-800 mt-1 pt-1">Topics</div>
                {filteredTopics.map((topic) => (
                  <CommandItem
                    key={`topic-${topic}`}
                    onSelect={() => insertTag('topic', topic)}
                    className="cursor-pointer py-1.5 px-2 text-xs flex items-center gap-1"
                  >
                    <Badge
                      variant="secondary"
                      className={cn("capitalize text-xs px-1.5 py-0 w-fit")}
                    >
                      {topic}
                    </Badge>
                  </CommandItem>
                ))}
              </>
            )}
          </CommandGroup>
        </Command>
      </PopoverContent>

      <PopoverAnchor asChild>
        <form onSubmit={handleSubmit} className="relative">
          <Textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type your message or @ to mention a file, priority, or topic..."
            className="w-full pr-12 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-lg focus:ring-1 focus:ring-slate-500 transition-shadow duration-150 ease-in-out shadow-sm"
          />
          <Button
            type="submit"
            size="icon"
            className="absolute right-2 bottom-2 h-8 w-8 bg-slate-600 hover:bg-slate-700 rounded-full disabled:opacity-50"
            disabled={!inputValue.trim() || isStreaming || loading}
          >
            <ArrowUp className="h-4 w-4 text-white" />
          </Button>
        </form>
      </PopoverAnchor>
    </Popover>
  );
};

export default ChatInputArea; 
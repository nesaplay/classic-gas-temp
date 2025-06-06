"use client";

import type React from "react";
import { Button } from "@/components/ui/button";
import {
  PenLine,
  FileText,
  Send,
  Trash2,
  Loader2,
} from "lucide-react";
import { Email } from '@/types/email'

interface ChatActionButtonsProps {
  activeEmail: Email | null;
  handleDraft: () => void;
  handleSummarize: () => void;
  handleSend: () => void;
  handleDelete: () => void;
  handleDailyDigest: () => void;
  isDrafting: boolean;
  isSummarizing: boolean;
  isSending: boolean;
  isDeleting: boolean;
}

const ChatActionButtons = ({
  activeEmail,
  handleDraft,
  handleSummarize,
  handleSend,
  handleDelete,
  handleDailyDigest,
  isDrafting,
  isSummarizing,
  isSending,
  isDeleting,
}: ChatActionButtonsProps) => {
  const commonDisabled = isDrafting || isSummarizing || isSending || isDeleting;

  return (
    <div className="flex justify-start gap-2 mb-4 overflow-x-auto">
      {activeEmail ? (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDraft}
            disabled={commonDisabled}
            className="h-8 px-3 text-xs shadow-sm flex-shrink-0"
          >
            {isDrafting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <PenLine className="mr-1 h-3 w-3" />}
            Draft Response
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSummarize}
            disabled={commonDisabled}
            className="h-8 px-3 text-xs shadow-sm flex-shrink-0"
          >
            {isSummarizing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <FileText className="mr-1 h-3 w-3" />}
            Summarize
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSend}
            disabled={commonDisabled}
            className="h-8 px-3 text-xs shadow-sm flex-shrink-0"
          >
            {isSending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Send className="mr-1 h-3 w-3" />}
            Send
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={commonDisabled}
            className="h-8 px-3 text-xs shadow-sm flex-shrink-0"
          >
            {isDeleting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Trash2 className="mr-1 h-3 w-3" />}
            Delete
          </Button>
        </>
      ) : (
        null
        // <Button
        //   variant="outline"
        //   size="sm"
        //   onClick={handleDailyDigest}
        //   disabled={isDrafting || isSending || isDeleting} 
        //   className="h-8 px-3 text-xs shadow-sm flex-shrink-0"
        // >
        //   {isDrafting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <PenLine className="mr-1 h-3 w-3" />}
        //   Daily Digest Report
        // </Button>
      )}
    </div>
  );
};

export default ChatActionButtons; 
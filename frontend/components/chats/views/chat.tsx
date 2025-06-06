import { motion, Variants } from "framer-motion";
import ChatContent from "@/components/chats/chat-content";
import { ChevronLeft, Minimize2, Maximize2 } from "lucide-react";
import { PROJECT_CONFIG } from "@/lib/constants";
import { Database } from "@/types/supabase";
import { useChatStore } from "@/lib/store/use-chat-store";
import { cn } from "@/lib/utils";

type Message = Database["public"]["Tables"]["messages"]["Row"];
type UploadedFile = {
  id: string;
  filename: string;
};

// Define Thread type locally
type Thread = Pick<
  Database["public"]["Tables"]["threads"]["Row"],
  "id" | "title" | "updated_at" | "assistant_id" | "created_at"
>;

interface ChatViewProps {
  messages: Message[];
  onStreamMessage: (
    messageContent: string,
    onWordForContainer: (word: string) => void,
    options?: {
      fileId?: string;
      hiddenMessage?: boolean;
      assistantId?: string;
    }
  ) => Promise<void>;
  uploadedFiles: UploadedFile[];
  loading: boolean;
  isDrafting: boolean;
  activeThreadId: string | null;
  handleBackClick: () => void;
  handleExpandClick: () => void;
  isExpanded: boolean;
  screenVariants: Variants;
  onAddUserMessage: (message: Message) => void;
  threads: Thread[];
  onGenerateDraft: (messageToDraftAbout: string) => Promise<string | null>;
}

const Chat = ({
  messages,
  onStreamMessage,
  uploadedFiles,
  loading,
  isDrafting,
  activeThreadId,
  handleBackClick,
  handleExpandClick,
  isExpanded,
  screenVariants,
  onAddUserMessage,
  threads,
  onGenerateDraft,
}: ChatViewProps) => {
  const handleClearChat = () => {
    console.warn("Clear chat functionality not implemented for this thread.");
  };

  const { showContext, setShowContext } = useChatStore();

  return (
    <motion.div
      key="chat"
      className="absolute inset-0 flex flex-col bg-white dark:bg-gray-950"
      initial="enter"
      animate="center"
      exit="exit"
      variants={screenVariants}
      custom={1}
      transition={{ duration: 0.3 }}
    >
      <div className="border-b p-3 flex items-center bg-white dark:bg-gray-950 dark:border-gray-800 flex-shrink-0">
        <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800" onClick={handleBackClick}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center ml-2 flex-1 min-w-0">
          <div className="bg-gray-800 text-white w-10 h-10 rounded-md flex items-center justify-center text-lg font-medium mr-3 flex-shrink-0">
            {PROJECT_CONFIG.appName?.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <div className="font-medium dark:text-white truncate">{PROJECT_CONFIG.appName}</div>
            <div
              className={cn("text-purple-500 font-bold text-xs dark:text-purple-400 cursor-pointer whitespace-nowrap overflow-hidden text-ellipsis", {
                "animate-in fade-in-50 zoom-in-95 duration-300": showContext,
              })}
              onClick={() => {
                setShowContext(true);

                setTimeout(() => {
                  setShowContext(false);
                }, 1000);
              }}
            >
              {activeThreadId
                ? threads.find((t) => t.id === activeThreadId)?.title
                : "AI Assistant"}
            </div>
          </div>
        </div>
        <button
          className="ml-auto p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
          onClick={handleExpandClick}
        >
          {isExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        <ChatContent
          messages={messages}
          onClearChat={handleClearChat}
          onStreamMessage={onStreamMessage}
          taggedFiles={uploadedFiles}
          loading={loading}
          isDrafting={isDrafting}
          activeThreadId={activeThreadId}
          onAddUserMessage={onAddUserMessage}
          onGenerateDraft={onGenerateDraft}
        />
      </div>
    </motion.div>
  );
};

export default Chat;

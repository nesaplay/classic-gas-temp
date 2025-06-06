import { HomeIcon, MessageSquare } from "lucide-react";

interface NavigationBarProps {
  handleHomeClick: () => void;
  handleMessagesClick: () => void;
  messageRead: boolean;
}

export function NavigationBar({ handleHomeClick, handleMessagesClick, messageRead }: NavigationBarProps) {
  return (
    <div className="bg-white dark:bg-gray-950 grid grid-cols-2 border-t dark:border-gray-800">
      <button
        className="flex flex-col items-center text-gray-600 dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 p-2 transition-colors"
        onClick={handleHomeClick}
      >
        <HomeIcon className="w-6 h-6" />
        <div className="text-sm mt-1">Home</div>
      </button>
      <button
        className="flex flex-col items-center text-gray-600 dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 p-2 transition-colors"
        onClick={handleMessagesClick}
      >
        <div className="relative">
          <MessageSquare className="w-6 h-6" />
          {!messageRead && (
            <div className="absolute -right-2 -top-1 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center">
              1
            </div>
          )}
        </div>
        <div className="text-sm mt-1">Messages</div>
      </button>
    </div>
  );
}

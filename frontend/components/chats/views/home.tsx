"use client";
import { motion, Variants } from "framer-motion";
import { useUserStore } from "@/lib/store/use-user-store";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface HomeScreenProps {
  onNewThread: () => void;
  screenVariants: Variants;
  loading: boolean;
}

export function HomeScreen({ onNewThread, screenVariants, loading }: HomeScreenProps) {
  const user = useUserStore((state) => state.user);
  const isLoadingUser = useUserStore((state) => state.isLoadingUser);

  // if welcome message

  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0];

  return (
    <motion.div
      key="home"
      className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 flex flex-col"
      initial="enter"
      animate="center"
      exit="exit"
      variants={screenVariants}
      transition={{ duration: 0.3 }}
    >
      {isLoadingUser ? (
        <div className="flex flex-col flex-1 h-full justify-between">
          <div className="flex items-center justify-center h-full">
            <div className="text-white text-lg">Loading...</div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col flex-1 h-full justify-between">
          <div className="p-6 pb-4">
            <div className="flex justify-start mb-6">
              <div className="bg-gray-800 text-white w-10 h-10 rounded-full flex items-center justify-center text-lg font-medium">
                {userName ? userName.charAt(0).toUpperCase() : "?"}
              </div>
            </div>

            <div className="text-white text-2xl font-medium mb-1">
              Hi {userName ? userName : "there"}, welcome back.
            </div>
            <div className="text-white text-2xl font-medium">How can I help you?</div>
          </div>

          <Button
            className="bg-white rounded-xl mx-4 mb-4 p-3 flex items-center cursor-pointer hover:bg-gray-50"
            onClick={onNewThread}
            disabled={loading}
          >
            <div className="flex-grow text-gray-700 pl-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Start new chat"}
            </div>
          </Button>
        </div>
      )}
    </motion.div>
  );
}

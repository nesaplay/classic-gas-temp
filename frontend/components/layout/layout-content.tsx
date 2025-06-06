"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import ChatContainer from "@/components/chats/chat-container";

export function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    return children;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Header />
        <main className="flex-1 overflow-y-auto">{children}</main>
        <ChatContainer />
      </SidebarInset>
    </SidebarProvider>
  );
}

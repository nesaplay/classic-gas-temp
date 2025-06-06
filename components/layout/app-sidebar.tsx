"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Box,
  FileText,
  PlusSquare,
  Home,
  Mail,
  Mic,
  Car,
  MessageCircle,
  Settings,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/lib/store/use-chat-store";
import { Button } from "@/components/ui/button";
import { AccountInfo } from "./account-info";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PROJECT_CONFIG } from "@/lib/constants";

const items = [
  {
    title: "Car Upgrades",
    url: "/car-upgrades",
    icon: Car,
  },
  {
    title: "Sourcing and Planning",
    url: "/sourcing-and-planning",
    icon: FileText,
  },
  {
    title: "Talk to Experts",
    url: "/talk-to-experts",
    icon: MessageCircle,
    badge: "New!",
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const { setIsOpen, activeSection, setActiveSection } = useChatStore();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const activeSection = PROJECT_CONFIG.sections.find((section) => pathname.includes(section.id));
    if (activeSection) {
      setActiveSection(activeSection);
    } else {
      setActiveSection(null);
    }
  }, [pathname]); 

  return (
    <Sidebar>
      <SidebarHeader className="flex justify-center p-4">
        <Link href="/dashboard">
          <Image
            src="/chat/classic-gas-logo.svg"
            alt="Logo"
            width={32}
            height={32}
            className="h-8 w-8"
          />
        </Link>
      </SidebarHeader>
      <SidebarContent className="flex flex-col justify-between h-full">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem className="mb-4">
                <SidebarMenuButton asChild>
                  <Button
                    onClick={() => router.push("/community")}
                    className="relative py-6 px-3 flex items-center rounded-lg transition-all duration-200 w-full justify-start bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:text-white hover:from-purple-600 hover:to-pink-600 [&>*]:text-white [&>*]:hover:text-white"
                  >
                    <PlusSquare className="mr-4 h-7 w-7" />
                    <span className="text-lg font-medium">Community</span>
                  </Button>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {items.map((item, index) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link
                      href={item.url}
                      className={cn(
                        "relative py-6 px-3 text-lg flex items-center rounded-lg transition-all duration-200",
                        activeSection?.id === item.url.split("/")[1]
                          ? "bg-purple-500/20 dark:bg-pink-500/40 text-purple-900/80 dark:text-gray-100 hover:bg-purple-500/30 dark:hover:bg-pink-500/50"
                          : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100",
                      )}
                    >
                      <item.icon className="h-7 w-7 mr-4" />
                      <span className="text-base font-medium">{item.title}</span>
                      <div className="ml-auto flex items-center">
                        {item.badge && (
                          <Badge variant="outline" className="text-xs">
                            {item.badge}
                          </Badge>
                        )}
                      </div>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <AccountInfo className="border-t border-gray-200" />
      </SidebarContent>
    </Sidebar>
  );
}

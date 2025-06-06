"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from 'next/navigation'
import { createClient } from "@/lib/supabase/client"
import { User } from "@supabase/supabase-js"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"
import { SidebarFooter, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

export function UserNav({ isCollapsed }: { isCollapsed: boolean }) {
  const supabase = createClient()
  const router = useRouter()
  const [user, setUser] = React.useState<User | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    let isMounted = true;

    async function getUserData() {
      setIsLoading(true);
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (isMounted) {
        setUser(currentUser);
        setIsLoading(false);
      }
    }

    getUserData();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (isMounted) {
        setUser(session?.user ?? null);
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
           setIsLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (isLoading) {
    return (
      <SidebarFooter className="py-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  className={`w-full justify-start items-center gap-3 p-3 h-16 ${isCollapsed ? "flex-col" : "flex-row"}`}
                >
                  <Avatar className={`${isCollapsed ? "h-10 w-10" : "h-12 w-12"}`}>
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex flex-col items-start overflow-hidden">
                      <span className="font-medium truncate w-full">Loading...</span>
                    </div>
                  )}
                </SidebarMenuButton>
              </DropdownMenuTrigger>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    )
  }

  if (!user) {
    return null;
  }

  const userEmail = user.email
  const userName = user.user_metadata?.full_name || user.user_metadata?.name
  const userImage = user.user_metadata?.avatar_url
  const userFallback = userName ? userName.split(' ').map((n: string) => n[0]).join('') : userEmail ? userEmail[0].toUpperCase() : 'U'

  return (
    <SidebarFooter className="py-4">
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                className={`w-full justify-start items-center gap-3 p-3 h-16 ${isCollapsed ? "flex-col" : "flex-row"}`}
              >
                <Avatar className={`${isCollapsed ? "h-10 w-10" : "h-12 w-12"}`}>
                  <AvatarImage src={userImage || undefined} alt={userName || userEmail || 'User avatar'} />
                  <AvatarFallback>{userFallback}</AvatarFallback>
                </Avatar>
                {!isCollapsed && (
                  <div className="flex flex-col items-start overflow-hidden">
                    <span className="font-medium truncate w-full">{userName || userEmail}</span>
                    {userName && <span className="text-xs text-muted-foreground truncate w-full">{userEmail}</span>}
                  </div>
                )}
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{userName || userEmail}</p>
                  {userName && <p className="text-xs leading-none text-muted-foreground">{userEmail}</p>}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <Link href="/profile">
                   <DropdownMenuItem className="cursor-pointer">Profile</DropdownMenuItem>
                </Link>
                <Link href="/settings">
                   <DropdownMenuItem className="cursor-pointer">Settings</DropdownMenuItem>
                </Link>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  )
}


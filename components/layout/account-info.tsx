"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  className?: string;
}

export function AccountInfo({ className }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [user, setUser] = React.useState<User | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let isMounted = true;

    async function getUserData() {
      setIsLoading(true);
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      if (isMounted) {
        setUser(currentUser);
        setIsLoading(false);
      }
    }

    getUserData();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (isMounted) {
        setUser(session?.user ?? null);
        if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
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
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const wrapperClasses = cn("flex items-center gap-3 w-full h-auto justify-start py-4", className);

  if (isLoading) {
    return (
      <div className={wrapperClasses}> 
        <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" /> 
        <div className="grid gap-1 flex-grow min-w-0"> 
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const userEmail = user.email;
  const userName = user.user_metadata?.full_name || user.user_metadata?.name;
  const userImage = user.user_metadata?.avatar_url || "https://avatar.iran.liara.run/public/46";
  const userFallback = userName
    ? userName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
    : userEmail
    ? userEmail[0].toUpperCase()
    : "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className={wrapperClasses}> 
          <Avatar className="h-10 w-10 flex-shrink-0"> 
            <AvatarImage src={userImage || undefined} alt={userName || userEmail || "User"} />
            <AvatarFallback>{userFallback}</AvatarFallback>
          </Avatar>
          <div className="grid gap-1 text-left flex-grow min-w-0"> 
            <p className="text-sm font-medium leading-none truncate">{userName || "User"}</p> 
            <p className="text-xs text-muted-foreground truncate">{userEmail}</p> 
          </div>
        </Button>
      </DropdownMenuTrigger>
              <DropdownMenuContent className="w-60" align="center" sideOffset={8} alignOffset={0}>
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
  );
}

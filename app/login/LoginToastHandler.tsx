"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export function LoginToastHandler() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const toastMessage = searchParams.get("toastMessage");
  const signOutError = searchParams.get("signOutError");

  useEffect(() => {
    if (toastMessage === "reauthGoogle") {
      console.log("TOAST: Preparing to show reauthGoogle toast");
      setTimeout(() => {
        toast({
          title: "Re-authentication Required",
          description: "Your session expired. Please login with Google again.",
          variant: "destructive",
        });
        console.log("TOAST: reauthGoogle toast call executed");
      }, 0);
    }
    if (signOutError) {
      console.log("TOAST: Preparing to show signOutError toast");
      setTimeout(() => {
        toast({
          title: "Sign Out Issue",
          description: "There was an issue fully signing you out. Please proceed with login.",
          variant: "default", 
        });
        console.log("TOAST: signOutError toast call executed");
      }, 0);
    }
  }, [toast, toastMessage, signOutError]);

  return null; // This component does not render anything itself
} 
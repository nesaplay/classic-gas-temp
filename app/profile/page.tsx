"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Icons } from "@/components/icons";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const profileFormSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters.").optional().or(z.literal('')),
  email: z.string().email("Please enter a valid email address."),
  avatar_url: z.string().url("Please enter a valid URL.").optional().or(z.literal('')),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const supabase = createClient();
  const { toast } = useToast();

  const defaultValues: Partial<ProfileFormValues> = {
    full_name: "",
    email: "",
    avatar_url: "",
  };

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues,
    mode: "onChange",
  });

  useEffect(() => {
    let isMounted = true;
    setIsFetching(true);

    async function fetchUserData() {
      const { data: { user: currentUser }, error } = await supabase.auth.getUser();

      if (isMounted) {
        if (error) {
          console.error("Error fetching user:", error);
          toast({ title: "Error", description: "Could not fetch profile.", variant: "destructive" });
          setUser(null);
        } else {
          setUser(currentUser);
          form.reset({
            email: currentUser?.email || "",
            full_name: currentUser?.user_metadata?.full_name || "",
            avatar_url: currentUser?.user_metadata?.avatar_url || "",
          });
        }
        setIsFetching(false);
      }
    }

    fetchUserData();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Profile Auth Event:", event);
         if (!isMounted) return;

        const currentUser = session?.user ?? null;
        setUser(currentUser);
         form.reset({
            email: currentUser?.email || "",
            full_name: currentUser?.user_metadata?.full_name || "",
            avatar_url: currentUser?.user_metadata?.avatar_url || "",
         });
         if (event === 'SIGNED_OUT' || !session) {
           setIsFetching(false);
           setIsLoading(false);
         }
         if (event === 'INITIAL_SESSION') {

         }
      }
    );

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, [supabase, toast, form.reset]);

  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
    : user?.email?.[0].toUpperCase() || "?";

  async function onSubmit(data: ProfileFormValues) {
    if (!user) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: data.full_name,
          avatar_url: data.avatar_url,
        },
      });

      if (error) {
        console.error("Failed to update profile:", error);
        toast({ title: "Update Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Profile updated successfully." });
        await supabase.auth.refreshSession();
        const { data: { user: updatedUser } } = await supabase.auth.getUser();
        if (updatedUser) setUser(updatedUser);
      }
    } catch (error) {
      console.error("Unexpected error updating profile:", error);
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  if (isFetching) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-950 dark:to-purple-950 p-8">
        <Icons.spinner className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-950 dark:to-purple-950 p-8">
        <div className="text-center">
            <p className="text-xl">Please log in to view your profile.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-950 dark:to-purple-950 p-8">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl bg-white dark:bg-gray-900 p-8 shadow-xl">
          <h1 className="text-3xl font-semibold">Profile Settings</h1>
          <p className="mt-2 text-muted-foreground">Update your personal information</p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-6">
              <div className="flex flex-col items-center space-y-4">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={form.watch("avatar_url") || undefined} alt={form.watch("full_name") || ""} />
                  <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                </Avatar>
                <Button variant="outline" size="sm" className="mt-2" type="button" disabled>
                  Change Avatar (WIP)
                </Button>
              </div>

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input className="h-11" placeholder="Your full name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" className="h-11 bg-gray-100 dark:bg-gray-800" {...field} disabled />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="avatar_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Avatar URL</FormLabel>
                      <FormControl>
                        <Input className="h-11" placeholder="https://..." {...field} />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground">URL of your profile picture.</p>
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" className="w-full h-11" disabled={isLoading || isFetching || !form.formState.isDirty}>
                {isLoading && <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}

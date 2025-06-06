import type React from "react"
import { cookies } from 'next/headers'
import { redirect } from "next/navigation"
import { createClient } from '@/lib/supabase/server' // Import Supabase server client

export async function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies() // Await the cookies
  const supabase = createClient(cookieStore)

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/login")
  }

  // If user is authenticated, render the children
  return <>{children}</>
}


import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/'

  console.log("[Auth Callback] Received code:", code ? 'present' : 'missing')
  console.log("[Auth Callback] Next path:", next)

  if (code) {
    console.log("[Auth Callback] Attempting code exchange.")
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    
    // --- Exchange code only --- 
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      console.log("[Auth Callback] Code exchange successful. Redirecting...")
       // --- Simple redirect --- 
      const redirectUrl = new URL(next, origin)
      return NextResponse.redirect(redirectUrl.toString())
    } else {
      console.error("[Auth Callback] Error exchanging code for session:", error)
    }
     // --- End code exchange ---
  }

  // Fallback redirect to error page
  console.error("[Auth Callback] No code found or exchange failed. Redirecting to error page.")
  const errorUrl = new URL('/auth/auth-code-error', origin)
  return NextResponse.redirect(errorUrl.toString())
} 
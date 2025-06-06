import Image from "next/image"
import { UserAuthForm } from "@/components/auth/user-auth-form"
import { Metadata } from "next"
import { PROJECT_CONFIG } from "@/lib/constants"
import { LoginToastHandler } from "./LoginToastHandler"
import React from "react"

export const metadata: Metadata = {
  title: `Login - ${PROJECT_CONFIG.appName}`,
  description: `Sign in to your account`,
}

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-pink-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <React.Suspense fallback={null}>
      <LoginToastHandler />
      </React.Suspense>
      <div className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white dark:bg-gray-950 shadow-xl dark:shadow-2xl dark:shadow-gray-900/50">
        <div className="grid lg:grid-cols-2">
          <div className="px-8 py-12 lg:px-12">
            <div className="flex items-center">
              <Image
                src="/chat/classic-gas-logo.svg"
                alt="Logo"
                width={40}
                height={40}
                className="h-10 w-10 dark:invert"
              />
            </div>
            <div className="mt-12">
              <h1 className="text-3xl font-semibold dark:text-white">Welcome back</h1>
              <p className="mt-2 text-muted-foreground dark:text-gray-400">
                Please sign in to your account to continue
              </p>
            </div>  
            <div className="mt-8">
              <UserAuthForm />
            </div>
          </div>
          <div className="relative hidden lg:block">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/auth-background.png-dIjsw8iUkfMkL4Y3Ua2leTbF3uHBCg.jpeg"
              alt="Scenic login background with stairs and flowers"
              className="h-full w-full object-cover dark:opacity-80"
              width={800}
              height={900}
              priority
            />
          </div>
        </div>
      </div>
    </div>
  )
}


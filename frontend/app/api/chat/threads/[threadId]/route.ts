import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"

export const dynamic = "force-dynamic"

type Params = Promise<{ threadId: string }>

export async function PATCH(request: Request, segmentData: { params: Params }) {
  // 1. Await Request Body
  let requestData
  try {
    requestData = await request.json()
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  // 2. Extract Params & Body
  const { threadId } = await segmentData.params
  const { title } = requestData

  // 3. Initial Validation
  if (!threadId) {
    return NextResponse.json({ error: "Thread ID is required" }, { status: 400 })
  }
  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "Title is required and must be a non-empty string" }, { status: 400 })
  }

  // --- Now safe to initialize client and use cookies ---
  try {
    // 4. Initialize Supabase Client - Using the new @supabase/ssr package
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // 5. Proceed with Auth and DB operations
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: threadData, error: threadError } = await supabase
      .from("threads")
      .select("user_id")
      .eq("id", threadId)
      .single()

    if (threadError || !threadData) {
      console.error("Error fetching thread or thread not found:", threadError)
      return NextResponse.json({ error: "Thread not found" }, { status: 404 })
    }

    const trimmedTitle = title.trim()
    const updateTimestamp = new Date().toISOString()

    // Update the thread title
    const { data, error } = await supabase
      .from("threads")
      .update({ title: trimmedTitle, updated_at: updateTimestamp })
      .eq("id", threadId)
      .select("id, title, updated_at")
      .single()

    if (error) {
      console.error("Error updating thread title:", error)
      return NextResponse.json({ error: "Failed to update thread title" }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    // Catch errors from Supabase client init or DB operations
    console.error("Error during Supabase operation:", error)
    if (error instanceof Error && error.message.includes("cookies()")) {
      // Specific handling for the persistent cookie error if it happens here
      return NextResponse.json({ error: "Cookie handling error during database operation." }, { status: 500 })
    } else if (error instanceof Error && error.message.includes("params")) {
      // Specific handling for the persistent params error if it happens here
      return NextResponse.json({ error: "Parameter handling error during database operation." }, { status: 500 })
    }
    return NextResponse.json({ error: "Internal server error during database operation" }, { status: 500 })
  }
}

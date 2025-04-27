import { createServerSupabaseClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseClient()

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const jobType = searchParams.get("type")

    // Build query
    let query = supabase.from("cron_job_logs").select("*").order("executed_at", { ascending: false }).limit(limit)

    // Filter by job type if provided
    if (jobType) {
      query = query.eq("job_type", jobType)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, logs: data })
  } catch (error) {
    console.error("Error fetching cron job logs:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch cron job logs" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { jobType } = await request.json()

    if (!jobType) {
      return NextResponse.json({ success: false, error: "Job type is required" }, { status: 400 })
    }

    // Log the manual trigger
    const supabase = createServerSupabaseClient()

    const { error: logError } = await supabase.from("cron_job_logs").insert({
      job_type: jobType,
      trigger_type: "manual",
      status: "started",
      executed_at: new Date().toISOString(),
    })

    if (logError) {
      return NextResponse.json({ success: false, error: logError.message }, { status: 500 })
    }

    // Trigger the appropriate job
    let result

    switch (jobType) {
      case "process_reminders":
        result = await fetch(new URL("/api/cron/process-reminders", request.url).toString(), {
          method: "GET",
        })
        break
      case "process_recurring":
        result = await fetch(new URL("/api/cron/process-recurring", request.url).toString(), {
          method: "GET",
        })
        break
      default:
        return NextResponse.json({ success: false, error: "Invalid job type" }, { status: 400 })
    }

    const jobResult = await result.json()

    // Update the log with the result
    const { error: updateError } = await supabase
      .from("cron_job_logs")
      .update({
        status: jobResult.success ? "completed" : "failed",
        result_data: jobResult,
        completed_at: new Date().toISOString(),
      })
      .eq("job_type", jobType)
      .eq("trigger_type", "manual")
      .is("completed_at", null)

    if (updateError) {
      console.error("Error updating cron job log:", updateError)
    }

    return NextResponse.json({
      success: true,
      message: `${jobType} job triggered manually`,
      result: jobResult,
    })
  } catch (error) {
    console.error("Error triggering cron job:", error)
    return NextResponse.json({ success: false, error: "Failed to trigger cron job" }, { status: 500 })
  }
}


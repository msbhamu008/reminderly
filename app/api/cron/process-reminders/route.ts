import { processReminders } from "@/lib/email-service"
import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"

// This endpoint can be called by a cron job to process reminders
export async function GET() {
  try {
    const supabase = createServerSupabaseClient()

    // Enhanced log entry with more details
    const logEntry = {
      job_type: "process_reminders",
      trigger_type: "scheduled",
      status: "started",
      executed_at: new Date().toISOString(),
      details: {
        environment: process.env.NODE_ENV,
        version: "1.0.1", // Track version for debugging
        server_time: new Date().toISOString(),
      },
    }

    // Log the start of the job
    const { data: logData, error: logError } = await supabase.from("cron_job_logs").insert(logEntry).select()

    if (logError) {
      console.error("Error logging cron job start:", logError)
    }

    const logId = logData?.[0]?.id
    const startTime = Date.now()

    // Process reminders with better error handling
    try {
      const result = await processReminders()

      // Calculate execution time
      const executionTimeMs = Date.now() - startTime

      // Update the log with detailed results
      if (logId) {
        await supabase
          .from("cron_job_logs")
          .update({
            status: result.success ? "completed" : "failed",
            result_data: {
              ...result,
              execution_time_ms: executionTimeMs,
              timestamp: new Date().toISOString(),
            },
            completed_at: new Date().toISOString(),
          })
          .eq("id", logId)
      }

      if (result.success) {
        return NextResponse.json({
          success: true,
          message: "Reminders processed successfully",
          stats: result.stats,
          execution_time_ms: executionTimeMs,
        })
      } else {
        console.error("Error processing reminders:", result.error)
        return NextResponse.json(
          {
            success: false,
            error: result.error || "Unknown error occurred",
            details: result.errors || "No detailed error information available",
          },
          { status: 500 },
        )
      }
    } catch (error) {
      // Detailed error logging
      const errorDetails = {
        message: (error as Error).message,
        stack: (error as Error).stack,
        timestamp: new Date().toISOString(),
        execution_time_ms: Date.now() - startTime,
      }

      console.error("Exception processing reminders:", error)

      // Update the log with the error
      if (logId) {
        await supabase
          .from("cron_job_logs")
          .update({
            status: "failed",
            result_data: errorDetails,
            completed_at: new Date().toISOString(),
          })
          .eq("id", logId)
      }

      return NextResponse.json(
        {
          success: false,
          error: (error as Error).message || "Exception occurred",
          details: errorDetails,
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("Critical error in cron job:", error)

    // Log the error even if the main logging fails
    try {
      const supabase = createServerSupabaseClient()
      await supabase.from("cron_job_logs").insert({
        job_type: "process_reminders",
        trigger_type: "scheduled",
        status: "failed",
        result_data: {
          error: (error as Error).message,
          stack: (error as Error).stack,
          critical: true,
          timestamp: new Date().toISOString(),
        },
        executed_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
    } catch (logError) {
      console.error("Failed to log critical error:", logError)
    }

    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message || "Critical error occurred",
        critical: true,
      },
      { status: 500 },
    )
  }
}


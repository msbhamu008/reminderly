import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { jobType } = await request.json();

    if (!jobType) {
      return NextResponse.json({ success: false, error: "Job type is required" }, { status: 400 });
    }

    // Integrate with cron-job.org API to schedule the job
    const cronJobUrl = "https://cron-job.org/api/jobs"; // Example URL for cron-job.org API
    const response = await fetch(cronJobUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer YOUR_API_TOKEN", // Replace with your actual API token
      },
      body: JSON.stringify({
        url: `https://reminderly-one.vercel.app/api/cron/${jobType}`,
        schedule: "*/5 * * * *", // Example schedule (every 5 minutes)
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json({ success: false, error: errorData.message }, { status: response.status });
    }

    return NextResponse.json({ success: true, message: `Job ${jobType} scheduled successfully` });
  } catch (error) {
    console.error("Error scheduling job:", error);
    return NextResponse.json({ success: false, error: "Failed to schedule job" }, { status: 500 });
  }
}

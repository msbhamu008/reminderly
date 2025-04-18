import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

type EmailRecipient = {
  email: string;
  name?: string;
  role?: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { to, subject, htmlContent, reminderData } = body;

    if (!to || !Array.isArray(to) || !subject || !htmlContent) {
      return NextResponse.json(
        { success: false, message: "Missing or invalid required fields" },
        { status: 400 }
      );
    }

    // Send email using Brevo API
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "api-key": process.env.BREVO_API_KEY || "",
      },
      body: JSON.stringify({
        sender: {
          email: process.env.EMAIL_FROM || "noreply@example.com",
          name: process.env.EMAIL_FROM_NAME || "Employee Reminder System",
        },
        to,
        subject,
        htmlContent,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { 
          success: false, 
          message: data.message || "Failed to send email",
          error: data.error || response.statusText
        },
        { status: response.status }
      );
    }

    // Log the email if reminder data is provided
    if (reminderData && reminderData.employeeReminderId) {
      const supabase = createServerSupabaseClient();
      await supabase.from("reminder_logs").insert({
        employee_reminder_id: reminderData.employeeReminderId,
        days_before: reminderData.daysRemaining,
        recipients: to.map((recipient: EmailRecipient) => recipient.email),
        status: "sent",
        sent_at: new Date().toISOString(),
        message_id: data.messageId,
        reminder_type: reminderData.reminderType,
      });
    }

    return NextResponse.json({
      success: true,
      messageId: data.messageId,
    });
  } catch (error) {
    console.error("Error sending email:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
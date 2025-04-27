// Part 2: sendEmail and processReminders functions

export async function sendEmail(emailData: EmailData) {
  try {
    if (!emailData.to.length) {
      return { success: false, error: "No recipients specified" }
    }

    if (!BREVO_API_KEY) {
      console.error("Missing Brevo API key")
      return { success: false, error: "Email service is not properly configured" }
    }

    const fromEmail = process.env.EMAIL_FROM || "noreply@example.com"
    const fromName = process.env.EMAIL_FROM_NAME || "Employee Reminder System"

    // Prepare the request payload for Brevo
    const payload = {
      sender: {
        name: fromName,
        email: fromEmail,
      },
      to: emailData.to,
      subject: emailData.subject,
      htmlContent: emailData.html,
    }

    // Send the email using Brevo API
    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch (e) {
        errorData = { message: errorText }
      }

      console.error("Brevo API error:", errorData)
      return {
        success: false,
        error: errorData.message || `Failed to send email through Brevo API: ${response.status} ${response.statusText}`,
        details: errorData,
      }
    }

    const result = await response.json()

    // Log the email if logData is provided
    if (emailData.logData && emailData.logData.employeeReminderId) {
      const supabase = createServerSupabaseClient()
      await supabase.from("reminder_logs").insert({
        employee_reminder_id: emailData.logData.employeeReminderId,
        days_before: emailData.logData.daysRemaining,
        recipients: emailData.to.map(r => r.email),
        status: "sent",
        sent_at: new Date().toISOString(),
        message_id: result.messageId,
        reminder_type: emailData.logData.reminderType,
      })
    }

    return {
      success: true,
      messageId: result.messageId || "Email sent successfully",
    }
  } catch (error) {
    console.error("Error sending email:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred",
    }
  }
}

// Helper function to replace template variables
function replaceTemplateVariables(template: string, variables: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{${key}}`, "g"), value)
  }
  return result
}

// Helper function to get next occurrence of a date (month and day) relative to today
function getNextOccurrenceDate(dateString: string, today: Date): Date {
  const date = new Date(dateString)
  const year = today.getFullYear()
  const nextDate = new Date(year, date.getMonth(), date.getDate())
  if (nextDate < today) {
    nextDate.setFullYear(year + 1)
  }
  return nextDate
}

export async function processReminders() {
  const supabase = createServerSupabaseClient()
  const totalProcessed = { sent: 0, failed: 0, skipped: 0 }
  const errors: string[] = []
  const processedReminders: Array<{
    id: string;
    status: "sent" | "failed" | "skipped";
    reason?: string;
    error?: string;
    recipients?: number;
    timestamp: string;
  }> = []

  try {
    // Get all pending reminders with their intervals and completion status
    const { data: reminders, error: remindersError } = await supabase
      .from("employee_reminders")
      .select(\`
        id,
        due_date,
        reminder_type_id,
        employees (
          id,
          name,
          email,
          manager_email,
          hr_email,
          birthday,
          work_anniversary
        ),
        reminder_types (
          id,
          name,
          email_templates (
            subject_template,
            body_template
          ),
          recipients (
            notify_employee,
            notify_manager,
            notify_hr,
            additional_emails
          ),
          reminder_intervals (
            days_before
          )
        ),
        reminder_logs!left (
          completed_at
        )
      \`)
      .is("reminder_logs.completed_at", null) // Only get reminders that haven't been completed
      .order("due_date")

    if (remindersError) {
      console.error("Error fetching reminders:", remindersError)
      return { success: false, error: remindersError.message }
    }

    if (!reminders || reminders.length === 0) {
      return { success: true, message: "No pending reminders found" }
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Process each reminder
    for (const reminderData of reminders) {
      const reminder: DatabaseReminder = {
        id: reminderData.id,
        due_date: reminderData.due_date,
        reminder_type_id: reminderData.reminder_type_id,
        employees: reminderData.employees as unknown as Employee,
        reminder_types: reminderData.reminder_types as unknown as ReminderType
      }

      const reminderType = reminder.reminder_types
      const intervals = reminderType.reminder_intervals || []
      const emailTemplate = reminderType.email_templates?.[0]
      const recipientsConfig = reminderType.recipients?.[0]

      if (!emailTemplate || !recipientsConfig) {
        errors.push(\`Missing template or recipients config for reminder \${reminder.id}\`)
        totalProcessed.failed++
        processedReminders.push({
          id: reminder.id,
          status: "failed",
          reason: "Missing template or recipients config",
          timestamp: new Date().toISOString(),
        })
        continue
      }

      // Calculate days until due based on reminder type
      let daysUntilDue: number
      if (reminderType.name.toLowerCase().includes("birthday") && reminder.employees.birthday) {
        const nextBirthday = getNextOccurrenceDate(reminder.employees.birthday, today)
        daysUntilDue = Math.ceil((nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      } else if (reminderType.name.toLowerCase().includes("work anniversary") && reminder.employees.work_anniversary) {
        const nextAnniversary = getNextOccurrenceDate(reminder.employees.work_anniversary, today)
        daysUntilDue = Math.ceil((nextAnniversary.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      } else {
        const dueDate = new Date(reminder.due_date)
        dueDate.setHours(0, 0, 0, 0)
        daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      }

      // Check if we should send a reminder today based on intervals
      const shouldSendToday = intervals.some((interval: ReminderInterval) => interval.days_before === daysUntilDue)

      if (!shouldSendToday) {
        totalProcessed.skipped++
        processedReminders.push({
          id: reminder.id,
          status: "skipped",
          reason: \`No matching interval for daysUntilDue: \${daysUntilDue}\`,
          timestamp: new Date().toISOString(),
        })
        continue
      }

      // Build recipient list (HR and Management only)
      const recipients: EmailRecipient[] = []

      // Always add HR first if available
      if (recipientsConfig.notify_hr && reminder.employees.hr_email) {
        recipients.push({
          email: reminder.employees.hr_email,
          name: "HR Department",
          role: "HR"
        })
      }

      // Then add manager if available
      if (recipientsConfig.notify_manager && reminder.employees.manager_email) {
        recipients.push({
          email: reminder.employees.manager_email,
          name: "Manager",
          role: "Manager"
        })
      }

      // Add any additional management emails
      if (recipientsConfig.additional_emails && Array.isArray(recipientsConfig.additional_emails)) {
        recipientsConfig.additional_emails.forEach((email: string) => {
          recipients.push({
            email,
            name: "Management Team",
            role: "Management"
          })
        })
      }

      if (recipients.length === 0) {
        errors.push(\`No management recipients available for reminder \${reminder.id}\`)
        totalProcessed.failed++
        processedReminders.push({
          id: reminder.id,
          status: "failed",
          reason: "No management recipients",
          timestamp: new Date().toISOString(),
        })
        continue
      }

      // Prepare and send the email
      const templateData = {
        type: reminderType.name,
        employee: reminder.employees.name,
        days: daysUntilDue === 0 ? "today" : \`in \${daysUntilDue} days\`,
        date: (reminderType.name.toLowerCase().includes("birthday") && reminder.employees.birthday)
          ? getNextOccurrenceDate(reminder.employees.birthday, today).toLocaleDateString()
          : (reminderType.name.toLowerCase().includes("work anniversary") && reminder.employees.work_anniversary)
            ? getNextOccurrenceDate(reminder.employees.work_anniversary, today).toLocaleDateString()
            : new Date(reminder.due_date).toLocaleDateString(),
        recipient: "Management Team" // Default value, will be replaced per recipient
      }

      let allSent = true
      let recipientsCount = 0

      for (const recipient of recipients) {
        const personalizedVariables = {
          ...templateData,
          recipient: recipient.role || "Management Team"
        }

        const subject = replaceTemplateVariables(emailTemplate.subject_template, personalizedVariables)
        const html = replaceTemplateVariables(emailTemplate.body_template, personalizedVariables)

        const emailResult = await sendEmail({
          to: [recipient],
          subject,
          html,
          logData: {
            employeeReminderId: reminder.id,
            reminderType: reminderType.name,
            daysRemaining: daysUntilDue
          }
        })

        recipientsCount++

        if (emailResult.success) {
          totalProcessed.sent++
        } else {
          totalProcessed.failed++
          allSent = false
          errors.push(\`Failed to send email to \${recipient.email}: \${emailResult.error}\`)
        }
      }

      processedReminders.push({
        id: reminder.id,
        status: allSent ? "sent" : "failed",
        recipients: recipientsCount,
        timestamp: new Date().toISOString(),
        reason: allSent ? undefined : "One or more emails failed to send",
      })
    }

    return {
      success: true,
      stats: totalProcessed,
      errors: errors.length > 0 ? errors : undefined,
      processedReminders,
    }

  } catch (error) {
    console.error("Error in processReminders:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      stats: totalProcessed,
      errors,
    }
  }
}

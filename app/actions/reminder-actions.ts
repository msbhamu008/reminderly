"use server"

import { createServerSupabaseClient } from "@/lib/supabase"
import { revalidatePath } from "next/cache"
import { sendEmail } from "@/lib/email-service"

// TypeScript types for Supabase query results
type Employee = {
  id: string;
  name: string;
  email: string;
  manager_email: string | null;
  hr_email: string | null;
}

type ReminderType = {
  id: string;
  name: string;
  email_templates: Array<{
    subject_template: string;
    body_template: string;
  }>;
  recipients: Array<{
    notify_employee: boolean;
    notify_manager: boolean;
    notify_hr: boolean;
    additional_emails: string[];
  }>;
}

type Reminder = {
  id: string;
  due_date: string;
  employees: Employee;
  reminder_types: ReminderType;
}

type EmployeeRecord = {
  id: string;
  employee_id: string;
  name: string;
  email: string;
  manager_email: string | null;
  hr_email: string | null;
}

type ReminderTypeRecord = {
  id: string;
  name: string;
  email_templates: Array<{
    subject_template: string;
    body_template: string;
  }>;
  recipients: Array<{
    notify_employee: boolean;
    notify_manager: boolean;
    notify_hr: boolean;
    additional_emails: string[];
  }>;
}

type ReminderQueryResult = {
  id: string;
  due_date: string;
  employees: EmployeeRecord;
  reminder_types: ReminderTypeRecord;
  reminder_logs?: Array<{
    id: string;
    sent_at: string;
  }>;
}

export async function getReminderTypes() {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("reminder_types")
    .select(`
      id,
      name,
      enabled,
      reminder_intervals (
        id,
        days_before
      ),
      email_templates (
        id,
        subject_template,
        body_template
      ),
      recipients (
        id,
        notify_employee,
        notify_manager,
        notify_hr,
        additional_emails
      )
    `)
    .order("name")

  if (error) {
    console.error("Error fetching reminder types:", error)
    return { success: false, error: error.message }
  }

  return {
    success: true,
    data: data.map((type) => ({
      id: type.id,
      name: type.name,
      enabled: type.enabled,
      intervals: type.reminder_intervals.map((interval) => interval.days_before).sort((a, b) => b - a),
      emailTemplate: type.email_templates[0] || null,
      recipients: type.recipients[0] || null,
    })),
  }
}

export async function addReminderType(formData: FormData) {
  const supabase = createServerSupabaseClient()

  const name = formData.get("name") as string
  const enabled = formData.get("enabled") === "true"

  // First, add the reminder type
  const { data: typeData, error: typeError } = await supabase.from("reminder_types").insert({ name, enabled }).select()

  if (typeError) {
    console.error("Error adding reminder type:", typeError)
    return { success: false, error: typeError.message }
  }

  const typeId = typeData[0].id

  // Add default interval (30 days)
  const { error: intervalError } = await supabase
    .from("reminder_intervals")
    .insert({ reminder_type_id: typeId, days_before: 30 })

  if (intervalError) {
    console.error("Error adding default interval:", intervalError)
  }

  // Add default email template for HR/Management
  const { error: templateError } = await supabase.from("email_templates").insert({
    reminder_type_id: typeId,
    subject_template: `[${name}] Action Required: {employee}'s Document Expiring in {days}`,
    body_template: `Dear {recipient},

This is to inform you that {employee}'s ${name} is due for renewal/review {days} (on {date}).

Document Type: ${name}
Employee: {employee}
Due Date: {date}

Please take appropriate action to ensure timely renewal/review of this document.

Best regards,
HR Department`,
  })

  if (templateError) {
    console.error("Error adding default email template:", templateError)
  }

  // Add default recipients configuration - only notify management
  const { error: recipientsError } = await supabase.from("recipients").insert({
    reminder_type_id: typeId,
    notify_employee: false, // Don't notify employees by default
    notify_manager: true,   // Always notify managers
    notify_hr: true,        // Always notify HR
    additional_emails: [],
  })

  if (recipientsError) {
    console.error("Error adding default recipients configuration:", recipientsError)
  }

  revalidatePath("/settings")
  return { success: true, data: typeData[0] }
}

export async function updateReminderType(id: string, formData: FormData) {
  const supabase = createServerSupabaseClient()

  const name = formData.get("name") as string
  const enabled = formData.get("enabled") === "true"

  const { data, error } = await supabase.from("reminder_types").update({ name, enabled }).eq("id", id).select()

  if (error) {
    console.error("Error updating reminder type:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/settings")
  return { success: true, data: data[0] }
}

export async function deleteReminderType(id: string) {
  const supabase = createServerSupabaseClient()

  const { error } = await supabase.from("reminder_types").delete().eq("id", id)

  if (error) {
    console.error("Error deleting reminder type:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/settings")
  return { success: true }
}

export async function addReminderInterval(typeId: string, daysBeforeValue: number) {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("reminder_intervals")
    .insert({ reminder_type_id: typeId, days_before: daysBeforeValue })
    .select()

  if (error) {
    console.error("Error adding reminder interval:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/settings")
  return { success: true, data: data[0] }
}

export async function deleteReminderInterval(typeId: string, daysBeforeValue: number) {
  const supabase = createServerSupabaseClient()

  const { error } = await supabase
    .from("reminder_intervals")
    .delete()
    .eq("reminder_type_id", typeId)
    .eq("days_before", daysBeforeValue)

  if (error) {
    console.error("Error deleting reminder interval:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/settings")
  return { success: true }
}

export async function updateEmailTemplate(typeId: string, formData: FormData) {
  const supabase = createServerSupabaseClient()

  const subjectTemplate = formData.get("subject_template") as string
  const bodyTemplate = formData.get("body_template") as string

  // Check if template exists
  const { data: existingTemplate } = await supabase
    .from("email_templates")
    .select("id")
    .eq("reminder_type_id", typeId)
    .single()

  if (existingTemplate) {
    // Update existing template
    const { error } = await supabase
      .from("email_templates")
      .update({ subject_template: subjectTemplate, body_template: bodyTemplate })
      .eq("id", existingTemplate.id)

    if (error) {
      console.error("Error updating email template:", error)
      return { success: false, error: error.message }
    }
  } else {
    // Create new template
    const { error } = await supabase
      .from("email_templates")
      .insert({ reminder_type_id: typeId, subject_template: subjectTemplate, body_template: bodyTemplate })

    if (error) {
      console.error("Error creating email template:", error)
      return { success: false, error: error.message }
    }
  }

  revalidatePath("/settings")
  return { success: true }
}

export async function updateRecipients(typeId: string, formData: FormData) {
  const supabase = createServerSupabaseClient()

  const notifyEmployee = formData.get("notify_employee") === "true"
  const notifyManager = formData.get("notify_manager") === "true"
  const notifyHr = formData.get("notify_hr") === "true"

  // Parse additional emails from comma-separated string to array
  const additionalEmailsString = (formData.get("additional_emails") as string) || ""
  const additionalEmails = additionalEmailsString
    .split(",")
    .map((email) => email.trim())
    .filter((email) => email.length > 0)

  // Check if recipients config exists
  const { data: existingConfig } = await supabase
    .from("recipients")
    .select("id")
    .eq("reminder_type_id", typeId)
    .single()

  if (existingConfig) {
    // Update existing config
    const { error } = await supabase
      .from("recipients")
      .update({
        notify_employee: notifyEmployee,
        notify_manager: notifyManager,
        notify_hr: notifyHr,
        additional_emails: additionalEmails,
      })
      .eq("id", existingConfig.id)

    if (error) {
      console.error("Error updating recipients configuration:", error)
      return { success: false, error: error.message }
    }
  } else {
    // Create new config
    const { error } = await supabase.from("recipients").insert({
      reminder_type_id: typeId,
      notify_employee: notifyEmployee,
      notify_manager: notifyManager,
      notify_hr: notifyHr,
      additional_emails: additionalEmails,
    })

    if (error) {
      console.error("Error creating recipients configuration:", error)
      return { success: false, error: error.message }
    }
  }

  revalidatePath("/settings")
  return { success: true }
}

export async function getReminders(filterType = "all", searchQuery = "") {
  const supabase = createServerSupabaseClient()

  try {
    let query = supabase
      .from("employee_reminders")
      .select(`
        id,
        due_date,
        employees!inner (
          id,
          employee_id,
          name,
          email,
          manager_email,
          hr_email
        ),
        reminder_types!inner (
          id,
          name
        ),
        reminder_logs (
          id,
          days_before,
          sent_at
        )
      `)
      .order("due_date")

    if (filterType !== "all") {
      query = query.eq("reminder_types.name", filterType)
    }

    if (searchQuery) {
      query = query.or(`employees.name.ilike.%${searchQuery}%,employees.employee_id.ilike.%${searchQuery}%`)
    }

    const { data: remindersData, error } = await query

    if (error) {
      console.error("Error fetching reminders:", error)
      return { success: false, error: error.message }
    }

    // Cast and transform the data to match our expected structure
    const reminders = (remindersData || []).map(item => ({
      id: item.id,
      due_date: item.due_date,
      employees: item.employees as unknown as EmployeeRecord,
      reminder_types: item.reminder_types as unknown as ReminderTypeRecord,
      reminder_logs: item.reminder_logs || []
    }))

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return {
      success: true,
      data: reminders.map((reminder) => {
        const dueDate = new Date(reminder.due_date)
        dueDate.setHours(0, 0, 0, 0)

        const diffTime = dueDate.getTime() - today.getTime()
        const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

        let status = "pending"
        if (reminder.reminder_logs && reminder.reminder_logs.length > 0) {
          status = "sent"
        }

        return {
          id: reminder.id,
          employeeName: reminder.employees.name,
          employeeId: reminder.employees.employee_id,
          email: reminder.employees.email,
          hrEmail: reminder.employees.hr_email,
          managerEmail: reminder.employees.manager_email,
          type: reminder.reminder_types.name,
          dueDate: reminder.due_date,
          daysRemaining,
          status,
        }
      }),
    }
  } catch (error) {
    console.error("Error in getReminders:", error)
    return { success: false, error: (error as Error).message }
  }
}

export async function addEmployeeReminder(formData: FormData) {
  const supabase = createServerSupabaseClient()

  const employeeId = formData.get("employee_id") as string
  const reminderTypeId = formData.get("reminder_type_id") as string
  const dueDate = formData.get("due_date") as string
  const notes = formData.get("notes") as string

  const { data, error } = await supabase
    .from("employee_reminders")
    .insert({
      employee_id: employeeId,
      reminder_type_id: reminderTypeId,
      due_date: dueDate,
      notes,
    })
    .select()

  if (error) {
    console.error("Error adding employee reminder:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/reminders")
  return { success: true, data: data[0] }
}

// Helper function to replace template variables
function replaceTemplateVariables(template: string, variables: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{${key}}`, "g"), value)
  }
  return result
}

// Update the sendReminderNow function to properly use templates
export async function sendReminderNow(reminderId: string) {
  const supabase = createServerSupabaseClient()

  try {
    // Get the reminder details with all necessary email fields
    const { data: reminderData, error: reminderError } = await supabase
      .from("employee_reminders")
      .select(`
        id,
        due_date,
        employees!inner (
          id,
          name,
          email,
          manager_email,
          hr_email
        ),
        reminder_types!inner (
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
          )
        )
      `)
      .eq("id", reminderId)
      .single()

    if (reminderError || !reminderData) {
      console.error("Error fetching reminder details:", reminderError)
      return { success: false, error: reminderError?.message || "Reminder not found" }
    }

    const reminder = reminderData as unknown as Reminder

    // Validate required management email
    if (!reminder.employees.manager_email && !reminder.employees.hr_email) {
      console.error("No management email (manager or HR) available for reminder:", reminderId)
      return { success: false, error: "No management email (manager or HR) available for this reminder" }
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dueDate = new Date(reminder.due_date)
    dueDate.setHours(0, 0, 0, 0)

    const diffTime = dueDate.getTime() - today.getTime()
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    const emailTemplate = reminder.reminder_types.email_templates[0]
    if (!emailTemplate) {
      return { success: false, error: "No email template found for this reminder type" }
    }

    const recipientsConfig = reminder.reminder_types.recipients[0]
    if (!recipientsConfig) {
      return { success: false, error: "No recipients configuration found for this reminder type" }
    }

    // Create recipient list with their roles, prioritizing management
    const recipientList: Array<{email: string; name: string; role: string}> = []

    // Always add HR first if available
    if (reminder.employees.hr_email) {
      recipientList.push({
        email: reminder.employees.hr_email,
        name: 'HR',
        role: 'HR Department'
      })
    }

    // Then add manager if available
    if (reminder.employees.manager_email) {
      recipientList.push({
        email: reminder.employees.manager_email,
        name: 'Manager',
        role: 'Manager'
      })
    }

    // Add any additional emails from the configuration
    if (recipientsConfig.additional_emails && Array.isArray(recipientsConfig.additional_emails)) {
      recipientsConfig.additional_emails.forEach((email: string) => {
        recipientList.push({
          email,
          name: 'Additional Recipient',
          role: 'Management Team'
        })
      })
    }

    // Only add employee if explicitly configured AND it's enabled
    if (recipientsConfig.notify_employee && reminder.employees.email) {
      recipientList.push({
        email: reminder.employees.email,
        name: reminder.employees.name,
        role: 'Employee'
      })
    }

    if (recipientList.length === 0) {
      return { success: false, error: "No recipients found for this reminder" }
    }

    // Send personalized email to each recipient
    const daysText = daysRemaining <= 0 ? "today" : `in ${daysRemaining} days`
    const formattedDate = new Date(reminder.due_date).toLocaleDateString()
    let successfulSends = 0
    const managementEmails: string[] = [] // Track management emails for logging

    for (const recipient of recipientList) {
      const templateVariables = {
        type: reminder.reminder_types.name,
        employee: reminder.employees.name,
        days: daysText,
        date: formattedDate,
        recipient: recipient.role
      }

      const subject = replaceTemplateVariables(emailTemplate.subject_template, templateVariables)
      const body = replaceTemplateVariables(emailTemplate.body_template, templateVariables)

      const emailResult = await sendEmail({
        to: [recipient.email],
        subject,
        html: body,
      })

      if (emailResult.success) {
        successfulSends++
        // Track management emails separately
        if (recipient.role !== 'Employee') {
          managementEmails.push(recipient.email)
        }
      }
    }

    // Log the reminder only if at least one management email was sent successfully
    if (managementEmails.length > 0) {
      const { error: logError } = await supabase.from("reminder_logs").insert({
        employee_reminder_id: reminder.id,
        days_before: daysRemaining,
        recipients: managementEmails, // Only log management recipients
        status: "sent",
        sent_at: new Date().toISOString(),
      })

      if (logError) {
        console.error("Error logging reminder:", logError)
      }
    }

    revalidatePath("/reminders")
    return { 
      success: managementEmails.length > 0, // Consider success only if management emails were sent
      error: managementEmails.length === 0 ? "Failed to send to any management recipients" : undefined,
      messageId: `Sent to ${managementEmails.length} management recipient(s)`
    }
  } catch (error) {
    console.error("Error in sendReminderNow:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to send reminder" 
    }
  }
}

export async function sendBulkReminders(reminderIds: string[]) {
  const supabase = createServerSupabaseClient()

  if (!reminderIds || reminderIds.length === 0) {
    return { success: false, error: "No reminders specified" }
  }

  let sent = 0
  let failed = 0
  const sentIds: string[] = []
  const errors: string[] = []

  // Process each reminder
  for (const reminderId of reminderIds) {
    try {
      const result = await sendReminderNow(reminderId)

      if (result.success) {
        sent++
        sentIds.push(reminderId)
      } else {
        failed++
        errors.push(`Failed to send reminder ${reminderId}: ${result.error}`)
      }
    } catch (error) {
      failed++
      errors.push(`Error processing reminder ${reminderId}: ${(error as Error).message}`)
    }
  }

  return {
    success: sent > 0,
    sent,
    failed,
    sentIds,
    error: errors.length > 0 ? errors.join("; ") : undefined,
  }
}

export async function getReminderById(id: string) {
  const supabase = createServerSupabaseClient()

  try {
    const { data: reminderData, error: reminderError } = await supabase
      .from("employee_reminders")
      .select(`
        id,
        due_date,
        reminder_type_id,
        employees!inner (
          id,
          name,
          email,
          employee_id,
          manager_email,
          hr_email
        ),
        reminder_types!inner (
          id,
          name
        ),
        reminder_logs (
          id,
          sent_at
        )
      `)
      .eq("id", id)
      .single()

    if (reminderError || !reminderData) {
      console.error("Error fetching reminder:", reminderError)
      return { success: false, error: reminderError?.message || "Reminder not found" }
    }

    // Cast the data to match our expected structure with proper types
    const reminder = {
      id: reminderData.id,
      due_date: reminderData.due_date,
      reminder_type_id: reminderData.reminder_type_id,
      employees: reminderData.employees as unknown as EmployeeRecord,
      reminder_types: reminderData.reminder_types as unknown as ReminderTypeRecord,
      reminder_logs: reminderData.reminder_logs || []
    }

    // Check if reminder is completed
    const { data: completionData } = await supabase
      .from("reminder_completions")
      .select("completed_at")
      .eq("employee_reminder_id", id)
      .maybeSingle()

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dueDate = new Date(reminder.due_date)
    dueDate.setHours(0, 0, 0, 0)

    const diffTime = dueDate.getTime() - today.getTime()
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    // Determine status
    let status = "pending"
    if (completionData) {
      status = "completed"
    } else if (reminder.reminder_logs && reminder.reminder_logs.length > 0) {
      status = "sent"
    }

    return {
      success: true,
      data: {
        id: reminder.id,
        employeeName: reminder.employees.name,
        employeeId: reminder.employees.employee_id,
        employeeEmail: reminder.employees.email,
        type: reminder.reminder_types.name,
        reminderTypeId: reminder.reminder_type_id,
        dueDate: reminder.due_date,
        daysRemaining,
        status,
        lastSentAt: reminder.reminder_logs?.[0]?.sent_at || null,
        completedAt: completionData?.completed_at || null,
      }
    }
  } catch (error) {
    console.error("Error in getReminderById:", error)
    return { success: false, error: (error as Error).message }
  }
}

export async function updateReminder(id: string, formData: FormData) {
  const supabase = createServerSupabaseClient()

  try {
    const reminderTypeId = formData.get("reminder_type_id") as string
    const dueDate = formData.get("due_date") as string
    const notes = formData.get("notes") as string
    const priority = (formData.get("priority") as string) || "medium"

    const { error } = await supabase
      .from("employee_reminders")
      .update({
        reminder_type_id: reminderTypeId,
        due_date: dueDate,
        notes: notes,
        priority: priority,
      })
      .eq("id", id)

    if (error) {
      console.error("Error updating reminder:", error)
      return { success: false, error: error.message }
    }

    revalidatePath(`/reminders/${id}`)
    revalidatePath("/reminders")
    return { success: true }
  } catch (error) {
    console.error("Error in updateReminder:", error)
    return { success: false, error: (error as Error).message }
  }
}

export async function deleteReminder(id: string) {
  const supabase = createServerSupabaseClient()

  try {
    const { error } = await supabase.from("employee_reminders").delete().eq("id", id)

    if (error) {
      console.error("Error deleting reminder:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/reminders")
    return { success: true }
  } catch (error) {
    console.error("Error in deleteReminder:", error)
    return { success: false, error: (error as Error).message }
  }
}

export async function markReminderAsComplete(id: string) {
  try {
    const response = await fetch(`/api/reminders/${id}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to mark reminder as complete');
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error in markReminderAsComplete:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to mark reminder as complete' 
    };
  }
}


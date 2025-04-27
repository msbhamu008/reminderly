"use server"

import { createServerSupabaseClient } from "@/lib/supabase"
import { revalidatePath } from "next/cache"

export async function getRecurringReminders() {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("recurring_reminders")
    .select(`
      id,
      name,
      reminder_type_id,
      frequency,
      interval,
      next_due_date,
      enabled,
      reminder_types (
        name
      )
    `)
    .order("name")

  if (error) {
    console.error("Error fetching recurring reminders:", error)
    return { success: false, error: error.message }
  }

  return {
    success: true,
    data: data.map((reminder) => ({
      id: reminder.id,
      name: reminder.name,
      reminderTypeId: reminder.reminder_type_id,
      reminderTypeName: reminder.reminder_types.name,
      frequency: reminder.frequency,
      interval: reminder.interval,
      nextDueDate: reminder.next_due_date,
      enabled: reminder.enabled,
    })),
  }
}

export async function createRecurringReminder(formData: FormData) {
  const supabase = createServerSupabaseClient()

  const recurringReminder = {
    name: formData.get("name") as string,
    reminder_type_id: formData.get("reminder_type_id") as string,
    frequency: formData.get("frequency") as string,
    interval: Number(formData.get("interval") as string),
    next_due_date: formData.get("next_due_date") as string,
    enabled: formData.get("enabled") === "true",
  }

  const { data, error } = await supabase.from("recurring_reminders").insert(recurringReminder).select()

  if (error) {
    console.error("Error creating recurring reminder:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/settings/recurring")
  return { success: true, data: data[0] }
}

export async function updateRecurringReminder(id: string, formData: FormData) {
  const supabase = createServerSupabaseClient()

  const recurringReminder = {
    name: formData.get("name") as string,
    reminder_type_id: formData.get("reminder_type_id") as string,
    frequency: formData.get("frequency") as string,
    interval: Number(formData.get("interval") as string),
    next_due_date: formData.get("next_due_date") as string,
    enabled: formData.get("enabled") === "true",
  }

  const { data, error } = await supabase.from("recurring_reminders").update(recurringReminder).eq("id", id).select()

  if (error) {
    console.error("Error updating recurring reminder:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/settings/recurring")
  return { success: true, data: data[0] }
}

export async function deleteRecurringReminder(id: string) {
  const supabase = createServerSupabaseClient()

  const { error } = await supabase.from("recurring_reminders").delete().eq("id", id)

  if (error) {
    console.error("Error deleting recurring reminder:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/settings/recurring")
  return { success: true }
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


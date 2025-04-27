"use server"

import { createServerSupabaseClient } from "./supabase"

// Configure Brevo API
const BREVO_API_KEY = process.env.BREVO_API_KEY || ""
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"

export type EmailRecipient = {
  email: string;
  name?: string;
  role?: string;
}

export type ReminderInterval = {
  days_before: number;
}

export type EmailTemplate = {
  subject_template: string;
  body_template: string;
}

export type RecipientsConfig = {
  notify_employee: boolean;
  notify_manager: boolean;
  notify_hr: boolean;
  additional_emails: string[];
}

export type ReminderType = {
  id: string;
  name: string;
  email_templates: EmailTemplate[];
  recipients: RecipientsConfig[];
  reminder_intervals: ReminderInterval[];
}

export type Employee = {
  id: string;
  name: string;
  email: string;
  manager_email: string | null;
  hr_email: string | null;
  birthday?: string; // ISO date string for birthday
  work_anniversary?: string; // ISO date string for work anniversary
}

export type Reminder = {
  id: string;
  due_date: string;
  employees: Employee;
  reminder_types: ReminderType;
}

export type DatabaseReminder = {
  id: string;
  due_date: string;
  reminder_type_id: string;
  employees: Employee;
  reminder_types: ReminderType;
}

export type EmailData = {
  to: EmailRecipient[];
  subject: string;
  html: string;
  logData?: {
    employeeReminderId?: string;
    reminderType?: string;
    daysRemaining?: number;
  };
}

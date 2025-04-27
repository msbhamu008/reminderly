"use server"

import { createServerSupabaseClient } from "@/lib/supabase"
import { revalidatePath } from "next/cache"

interface DatabaseEmployee {
  id: string;
  employee_id: string;
  name: string;
  email: string;
  position: string;
  department: string;
  manager_email: string;
  hr_email: string;
  employee_reminders: Array<{
    id: string;
    due_date: string;
    reminder_types: {
      name: string;
    };
  }>;
}

export async function getEmployees(searchQuery = "") {
  const supabase = createServerSupabaseClient()

  let query = supabase
    .from("employees")
    .select(`
      id,
      employee_id,
      name,
      email,
      position,
      department,
      manager_email,
      hr_email,
      employee_reminders:employee_reminders!left (
        id,
        due_date,
        reminder_types (
          name
        )
      )
    `)
    .order("name")

  if (searchQuery) {
    query = query.or(`name.ilike.%${searchQuery}%,employee_id.ilike.%${searchQuery}%,department.ilike.%${searchQuery}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error("Error fetching employees:", error)
    return { success: false, error: error.message }
  }

  return {
    success: true,
    data: data?.map((employee: any) => ({
      ...employee,
      reminders: employee.employee_reminders.map((reminder: any) => ({
        type: reminder.reminder_types?.name ?? 'Unknown',
        dueDate: reminder.due_date,
      })),
    })),
  }
}

export async function addEmployee(formData: FormData) {
  const supabase = createServerSupabaseClient()

  const employee = {
    employee_id: formData.get("employee_id") as string,
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    position: formData.get("position") as string,
    department: formData.get("department") as string,
    manager_email: formData.get("manager_email") as string,
    hr_email: formData.get("hr_email") as string,
  }

  const { data, error } = await supabase.from("employees").insert(employee).select()

  if (error) {
    console.error("Error adding employee:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/employees")
  return { success: true, data: data[0] }
}

export async function updateEmployee(id: string, formData: FormData) {
  const supabase = createServerSupabaseClient()

  const employee = {
    employee_id: formData.get("employee_id") as string,
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    position: formData.get("position") as string,
    department: formData.get("department") as string,
    manager_email: formData.get("manager_email") as string,
    hr_email: formData.get("hr_email") as string,
  }

  const { data, error } = await supabase.from("employees").update(employee).eq("id", id).select()

  if (error) {
    console.error("Error updating employee:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/employees")
  return { success: true, data: data[0] }
}

export async function deleteEmployee(id: string) {
  const supabase = createServerSupabaseClient()

  try {
    // Delete associated reminders first
    const { error: reminderError } = await supabase
      .from("employee_reminders")
      .delete()
      .eq("employee_id", id)

    if (reminderError) {
      console.error("Error deleting reminders:", reminderError)
      return { success: false, error: "Failed to delete associated reminders" }
    }

    // Delete employee
    const { error: employeeError } = await supabase
      .from("employees")
      .delete()
      .eq("id", id)

    if (employeeError) {
      console.error("Error deleting employee:", employeeError)
      return { success: false, error: "Failed to delete employee" }
    }

    revalidatePath("/employees")
    return { success: true }
  } catch (error) {
    console.error("Error in deleteEmployee:", error)
    return { success: false, error: "Failed to delete employee" }
  }
}

export async function bulkDeleteEmployees(employeeIds: string[]) {
  const supabase = createServerSupabaseClient()

  try {
    // Delete associated reminders first
    const { error: reminderError } = await supabase
      .from("employee_reminders")
      .delete()
      .in("employee_id", employeeIds)

    if (reminderError) {
      console.error("Error deleting reminders:", reminderError)
      return { success: false, error: "Failed to delete associated reminders" }
    }

    // Delete employees
    const { error: employeeError } = await supabase
      .from("employees")
      .delete()
      .in("id", employeeIds)

    if (employeeError) {
      console.error("Error deleting employees:", employeeError)
      return { success: false, error: "Failed to delete employees" }
    }

    revalidatePath("/employees")
    return { success: true }
  } catch (error) {
    console.error("Error in bulkDeleteEmployees:", error)
    return { success: false, error: "Failed to delete employees" }
  }
}


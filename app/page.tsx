import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarClock, BarChartIcon as ChartBar, FileSpreadsheet, MailCheck, Settings, Users } from "lucide-react"
import { createServerSupabaseClient } from "@/lib/supabase"
import { RecentActivity } from "@/components/dashboard/recent-activity"

export default async function Home() {
  const supabase = createServerSupabaseClient()

  // Get statistics
  const { count: employeeCount } = await supabase.from("employees").select("*", { count: "exact", head: true })

  const { count: reminderCount } = await supabase.from("employee_reminders").select("*", { count: "exact", head: true })

  // Get upcoming reminders (due in the next 30 days)
  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

  const { count: upcomingCount } = await supabase
    .from("employee_reminders")
    .select("*", { count: "exact", head: true })
    .lte("due_date", thirtyDaysFromNow.toISOString().split("T")[0])
    .gte("due_date", new Date().toISOString().split("T")[0])

  const { count: templateCount } = await supabase.from("reminder_types").select("*", { count: "exact", head: true })

  return (
    <div className="container mx-auto py-10">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Employee Reminder System</h1>
          <p className="text-muted-foreground">
            Track important employee-related deadlines and send automated reminders
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Total Reminders</CardTitle>
              <CalendarClock className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reminderCount || 0}</div>
              <p className="text-xs text-muted-foreground">
                {reminderCount ? "Active employee reminders" : "No reminders configured yet"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Employees</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{employeeCount || 0}</div>
              <p className="text-xs text-muted-foreground">
                {employeeCount ? "Employees in the system" : "No employees added yet"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Upcoming Reminders</CardTitle>
              <CalendarClock className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{upcomingCount || 0}</div>
              <p className="text-xs text-muted-foreground">
                {upcomingCount ? "Due in the next 30 days" : "No upcoming reminders"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Reminder Templates</CardTitle>
              <Settings className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{templateCount || 0}</div>
              <p className="text-xs text-muted-foreground">
                {templateCount ? "Active reminder types" : "No templates configured"}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Get started with these common tasks</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Button asChild className="w-full sm:w-auto">
                <Link href="/upload">
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Upload Employee Data
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href="/dashboard">
                  <ChartBar className="mr-2 h-4 w-4" />
                  View Dashboard
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href="/reminders/bulk">
                  <MailCheck className="mr-2 h-4 w-4" />
                  Send Bulk Reminders
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href="/settings/email/templates">
                  <Settings className="mr-2 h-4 w-4" />
                  Customize Email Templates
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your recent actions in the system</CardDescription>
            </CardHeader>
            <CardContent>
              <RecentActivity />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}


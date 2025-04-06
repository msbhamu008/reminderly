import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createServerSupabaseClient } from "@/lib/supabase"
import { CalendarClock, CheckCircle, Clock, MailCheck, MailX, Users } from "lucide-react"
import { BarChart } from "@/components/charts/bar-chart"
import { PieChart } from "@/components/charts/pie-chart"
import { LineChart } from "@/components/charts/line-chart"
import { UpcomingReminders } from "@/components/dashboard/upcoming-reminders"
import { RecentActivity } from "@/components/dashboard/recent-activity"

export default async function DashboardPage() {
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

  // Get reminder logs statistics
  const { data: reminderLogs } = await supabase
    .from("reminder_logs")
    .select("status, sent_at")
    .order("sent_at", { ascending: false })

  // Calculate success rate
  const totalLogs = reminderLogs?.length || 0
  const successfulLogs = reminderLogs?.filter((log) => log.status === "sent").length || 0
  const successRate = totalLogs > 0 ? Math.round((successfulLogs / totalLogs) * 100) : 0

  // Get reminder types distribution
  const { data: reminderTypesData } = await supabase.from("employee_reminders").select(`
      reminder_types (
        name
      )
    `)

  const reminderTypeDistribution =
    reminderTypesData?.reduce((acc: Record<string, number>, item) => {
      const typeName = item.reminder_types.name
      acc[typeName] = (acc[typeName] || 0) + 1
      return acc
    }, {}) || {}

  // Get reminders by month
  const { data: remindersByMonth } = await supabase.from("employee_reminders").select("due_date")

  const monthlyDistribution =
    remindersByMonth?.reduce((acc: Record<string, number>, item) => {
      const month = new Date(item.due_date).toLocaleString("default", { month: "short" })
      acc[month] = (acc[month] || 0) + 1
      return acc
    }, {}) || {}

  // Prepare chart data
  const pieChartData = Object.entries(reminderTypeDistribution).map(([name, value]) => ({
    name,
    value,
  }))

  const barChartData = Object.entries(monthlyDistribution).map(([month, count]) => ({
    name: month,
    value: count,
  }))

  // Get email delivery stats by day for the last 7 days
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data: emailStats } = await supabase
    .from("reminder_logs")
    .select("status, sent_at")
    .gte("sent_at", sevenDaysAgo.toISOString())

  // Group by day and status
  const emailStatsByDay: Record<string, { sent: number; failed: number }> = {}

  // Initialize the last 7 days
  for (let i = 0; i < 7; i++) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dayStr = date.toISOString().split("T")[0]
    emailStatsByDay[dayStr] = { sent: 0, failed: 0 }
  }

  // Fill in actual data
  emailStats?.forEach((stat) => {
    const day = stat.sent_at.split("T")[0]
    if (emailStatsByDay[day]) {
      if (stat.status === "sent") {
        emailStatsByDay[day].sent += 1
      } else {
        emailStatsByDay[day].failed += 1
      }
    }
  })

  // Convert to array for chart
  const lineChartData = Object.entries(emailStatsByDay)
    .sort(([a], [b]) => a.localeCompare(b)) // Sort by date
    .map(([date, stats]) => ({
      name: new Date(date).toLocaleDateString("default", { month: "short", day: "numeric" }),
      sent: stats.sent,
      failed: stats.failed,
    }))

  return (
    <div className="container mx-auto py-10">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your employee reminder system</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{employeeCount || 0}</div>
              <p className="text-xs text-muted-foreground">
                {employeeCount ? "Active employees in the system" : "No employees added yet"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Total Reminders</CardTitle>
              <CalendarClock className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reminderCount || 0}</div>
              <p className="text-xs text-muted-foreground">
                {reminderCount ? "Active reminders in the system" : "No reminders configured yet"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Upcoming Reminders</CardTitle>
              <Clock className="w-4 h-4 text-muted-foreground" />
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
              <CardTitle className="text-sm font-medium">Email Success Rate</CardTitle>
              {successRate > 90 ? (
                <MailCheck className="w-4 h-4 text-green-500" />
              ) : (
                <MailX className="w-4 h-4 text-amber-500" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{successRate}%</div>
              <p className="text-xs text-muted-foreground">Based on {totalLogs} emails sent</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="emails">Email Analytics</TabsTrigger>
            <TabsTrigger value="reminders">Reminders</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
              <Card className="lg:col-span-4">
                <CardHeader>
                  <CardTitle>Reminders by Month</CardTitle>
                  <CardDescription>Distribution of reminders across months</CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                  <BarChart data={barChartData} />
                </CardContent>
              </Card>

              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>Reminder Types</CardTitle>
                  <CardDescription>Distribution by reminder category</CardDescription>
                </CardHeader>
                <CardContent>
                  <PieChart data={pieChartData} />
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="col-span-1">
                <CardHeader>
                  <CardTitle>Upcoming Reminders</CardTitle>
                  <CardDescription>Reminders due in the next 7 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <UpcomingReminders />
                </CardContent>
              </Card>

              <Card className="col-span-1">
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Latest reminder notifications</CardDescription>
                </CardHeader>
                <CardContent>
                  <RecentActivity />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="emails" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Email Delivery Performance</CardTitle>
                <CardDescription>Success and failure rates over the last 7 days</CardDescription>
              </CardHeader>
              <CardContent className="pl-2">
                <LineChart data={lineChartData} />
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">Successful Deliveries</CardTitle>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{successfulLogs}</div>
                  <p className="text-xs text-muted-foreground">Emails successfully delivered</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">Failed Deliveries</CardTitle>
                  <MailX className="w-4 h-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalLogs - successfulLogs}</div>
                  <p className="text-xs text-muted-foreground">Emails that failed to deliver</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="reminders" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Reminder Status</CardTitle>
                <CardDescription>Overview of all reminders in the system</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] flex items-center justify-center">
                  <p className="text-muted-foreground">Detailed reminder analytics coming soon</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}


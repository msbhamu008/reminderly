"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { useEffect } from "react"
import { CalendarIcon, Clock, Filter, Loader2, Mail, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { getReminders, sendBulkReminders } from "@/app/actions/reminder-actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

type Reminder = {
  id: string
  employeeName: string
  employeeId: string
  type: string
  dueDate: string
  daysRemaining: number
  status: "pending" | "sent" | "completed"
}

export default function BulkRemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [selectedReminders, setSelectedReminders] = useState<string[]>([])
  const [filterType, setFilterType] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [reminderTypes, setReminderTypes] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const { toast } = useToast()

  // Load reminders
  useEffect(() => {
    const fetchReminders = async () => {
      setLoading(true)
      const response = await getReminders(filterType, searchQuery)

      if (response.success) {
        // Filter to only show pending reminders
        const pendingReminders = response.data.filter((reminder) => reminder.status === "pending")
        setReminders(pendingReminders)

        // Extract unique reminder types
        const types = new Set<string>()
        response.data.forEach((reminder: Reminder) => {
          types.add(reminder.type)
        })

        setReminderTypes(types)
      } else {
        toast({
          title: "Error",
          description: "Failed to load reminders",
          variant: "destructive",
        })
      }

      setLoading(false)
    }

    fetchReminders()
  }, [filterType, searchQuery, toast])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedReminders(reminders.map((reminder) => reminder.id))
    } else {
      setSelectedReminders([])
    }
  }

  const handleSelectReminder = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedReminders((prev) => [...prev, id])
    } else {
      setSelectedReminders((prev) => prev.filter((reminderId) => reminderId !== id))
    }
  }

  const handleSendBulkReminders = () => {
    if (selectedReminders.length === 0) {
      toast({
        title: "No reminders selected",
        description: "Please select at least one reminder to send",
        variant: "destructive",
      })
      return
    }

    setResult(null)

    startTransition(async () => {
      try {
        const response = await sendBulkReminders(selectedReminders)

        if (response.success) {
          setResult({
            success: true,
            message: `Successfully sent ${response.sent} reminders. Failed: ${response.failed}`,
          })

          // Remove sent reminders from the list
          if (response.sentIds && response.sentIds.length > 0) {
            setReminders((prev) => prev.filter((reminder) => !response.sentIds.includes(reminder.id)))
            setSelectedReminders([])
          }

          toast({
            title: "Success",
            description: `Successfully sent ${response.sent} reminders`,
          })
        } else {
          setResult({
            success: false,
            message: response.error || "Failed to send reminders",
          })

          toast({
            title: "Error",
            description: response.error || "Failed to send reminders",
            variant: "destructive",
          })
        }
      } catch (error) {
        setResult({
          success: false,
          message: "An unexpected error occurred",
        })

        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        })
      }
    })
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Bulk Reminders</h1>
          <p className="text-muted-foreground">Send multiple reminders at once to save time</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>Pending Reminders</CardTitle>
                <CardDescription>Select reminders to send in bulk</CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search employees..."
                    className="pl-8 w-full sm:w-[200px] md:w-[250px]"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4" />
                      <SelectValue placeholder="Filter by type" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {Array.from(reminderTypes).map((type) => (
                      <SelectItem key={type} value={type.toLowerCase()}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">Loading reminders...</p>
              </div>
            ) : reminders.length > 0 ? (
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={selectedReminders.length === reminders.length && reminders.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Days Remaining</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reminders.map((reminder) => (
                      <TableRow key={reminder.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedReminders.includes(reminder.id)}
                            onCheckedChange={(checked) => handleSelectReminder(reminder.id, !!checked)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{reminder.employeeName}</div>
                          <div className="text-sm text-muted-foreground">{reminder.employeeId}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{reminder.type}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                            <span>{new Date(reminder.dueDate).toLocaleDateString()}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span>{reminder.daysRemaining} days</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="rounded-full bg-muted p-3">
                  <Mail className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-lg font-medium">No pending reminders</h3>
                <p className="mt-2 text-sm text-center text-muted-foreground">
                  {searchQuery || filterType !== "all"
                    ? "Try adjusting your filters to see more results."
                    : "There are no pending reminders at this time."}
                </p>
              </div>
            )}

            {result && (
              <Alert variant={result.success ? "default" : "destructive"} className="mt-4">
                <AlertTitle>{result.success ? "Success" : "Error"}</AlertTitle>
                <AlertDescription>{result.message}</AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <div className="text-sm text-muted-foreground">
              {selectedReminders.length} of {reminders.length} reminders selected
            </div>
            <Button onClick={handleSendBulkReminders} disabled={isPending || selectedReminders.length === 0}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send {selectedReminders.length} Reminders
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}


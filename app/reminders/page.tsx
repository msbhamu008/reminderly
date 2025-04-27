"use client"

import React, { useEffect, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CalendarIcon, CheckCircle, Clock, Search, MoreVertical, Trash2, CheckCircle2 } from "lucide-react"
import { getReminders, sendReminderNow, updateReminder, deleteReminder, markReminderAsComplete } from "../actions/reminder-actions"
import { useToast } from "@/hooks/use-toast"
import { Calendar } from "@/components/ui/calendar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { getReminderEmailTemplate } from '@/lib/email-templates';
import Link from "next/link";

type Reminder = {
  id: string
  employeeName: string
  employeeId: string
  email: string        // Make sure this matches the database field
  type: string
  dueDate: string
  daysRemaining: number
  status: "pending" | "sent" | "completed"
  messageId?: string
  hrEmail?: string     // Match database field hr_email
  managerEmail?: string // Match database field manager_email
  notes?: string
}

const sendDirectEmail = async (reminder: Reminder) => {
  try {
    console.log('Sending reminder with data:', reminder);

    if (!reminder.email) {
      console.error('Missing email data:', reminder);
      throw new Error('Employee email is missing');
    }

    const emailTemplate = getReminderEmailTemplate({
      employeeName: reminder.employeeName,
      type: reminder.type,
      dueDate: reminder.dueDate,
      daysRemaining: reminder.daysRemaining,
      additionalNotes: reminder.notes
    });

    // Use the server-side email service
    const response = await fetch('/api/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: [{ 
          email: reminder.email,
          name: reminder.employeeName 
        }],
        cc: [
          reminder.hrEmail ? { email: reminder.hrEmail, name: 'HR Department' } : null,
          reminder.managerEmail ? { email: reminder.managerEmail, name: 'Manager' } : null
        ].filter(Boolean),
        subject: emailTemplate.subject,
        htmlContent: emailTemplate.htmlContent,
        replyTo: { 
          email: reminder.hrEmail || 'inkredibleai@gmail.com',
          name: 'HR Department' 
        }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to send email');
    }
    
    if (data.messageId) {
      console.log('Message sent successfully, ID:', data.messageId);
      return { success: true, messageId: data.messageId };
    }
    
    return { success: false, error: 'No messageId received' };
  } catch (error) {
    console.error('Email sending error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to send email',
      details: error
    };
  }
};

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [filterType, setFilterType] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [reminderTypes, setReminderTypes] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState("upcoming")
  const { toast } = useToast()
  const [selectedDate, setSelectedDate] = useState<Date>()
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null)
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false)

  // Load reminders
  useEffect(() => {
    const fetchReminders = async () => {
      try {
        setLoading(true)
        console.log('Fetching reminders with:', { filterType, searchQuery })
        const response = await getReminders(filterType, searchQuery)
        console.log('Raw response:', response) // Debug log

        if (response.success && response.data) {
          // Ensure all required fields are present
          const typedReminders = response.data.map(item => ({
            ...item,
            status: item.status as "pending" | "sent" | "completed",
            email: item.email || '', // Ensure email field exists
            hrEmail: item.hr_email || undefined,
            managerEmail: item.manager_email || undefined
          }));
          console.log('Processed reminders:', typedReminders); // Debug log
          setReminders(typedReminders)

          // Extract unique reminder types
          const types = new Set<string>()
          typedReminders.forEach(reminder => {
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
      } catch (error) {
        console.error('Error in fetchReminders:', error)
        toast({
          title: "Error",
          description: "Failed to load reminders",
          variant: "destructive",
        })
        setLoading(false)
      }
    }

    fetchReminders()
  }, [filterType, searchQuery, activeTab])

  const [sortColumn, setSortColumn] = useState<"employeeName" | "dueDate" | null>(null)
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")

  const filteredReminders = reminders.filter((reminder) => {
    // Filter by tab
    if (activeTab === "upcoming" && reminder.status !== "pending") return false
    if (activeTab === "sent" && reminder.status !== "sent") return false
    if (activeTab === "completed" && reminder.status !== "completed") return false

    return true
  })

  const sortedReminders = React.useMemo(() => {
    if (!sortColumn) return filteredReminders

    const sorted = [...filteredReminders].sort((a, b) => {
      if (sortColumn === "employeeName") {
        const nameA = a.employeeName.toLowerCase()
        const nameB = b.employeeName.toLowerCase()
        if (nameA < nameB) return sortOrder === "asc" ? -1 : 1
        if (nameA > nameB) return sortOrder === "asc" ? 1 : -1
        return 0
      } else if (sortColumn === "dueDate") {
        const dateA = new Date(a.dueDate).getTime()
        const dateB = new Date(b.dueDate).getTime()
        return sortOrder === "asc" ? dateA - dateB : dateB - dateA
      }
      return 0
    })

    return sorted
  }, [filteredReminders, sortColumn, sortOrder])

  const handleSendReminder = (reminderId: string) => {
    startTransition(async () => {
      const reminder = reminders.find(r => r.id === reminderId);
      if (!reminder || !reminder.email) {
        toast({
          title: "Error",
          description: "Cannot send reminder: Employee email is missing",
          variant: "destructive",
        });
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      try {
        try {
          const response = await Promise.race([
            sendReminderNow(reminderId),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 5000)
            )
          ]) as { success: boolean; error?: string };

          clearTimeout(timeoutId);

          if (response.success) {
            setReminders((prev) =>
              prev.map((r) => (r.id === reminderId ? { ...r, status: "sent" } : r))
            );
            toast({ title: "Success", description: "Reminder sent successfully" });
            return;
          }
          throw new Error(response.error || 'Failed to send reminder');
        } catch (error) {
          toast({
            title: "Info",
            description: "Primary system timeout, trying direct email...",
          });

          const directResponse = await sendDirectEmail(reminder);
          console.log('Email sending response:', directResponse); // Add logging
          
          if (directResponse.success) {
            setReminders((prev) =>
              prev.map((r) => (r.id === reminderId ? { 
                ...r, 
                status: "sent",
                messageId: directResponse.messageId
              } : r))
            );
            toast({
              title: "Success",
              description: `Email sent successfully. Please check your inbox.`,
              duration: 5000,
            });
            return;
          }

          throw new Error(directResponse.error || 'Failed to send email');
        }
      } catch (error) {
        console.error('Reminder sending error:', error);
        toast({
          title: "Error",
          description: "Failed to send email. Please check console for details.",
          variant: "destructive",
          duration: 5000,
        });
      }
    });
  }

  const handleMarkComplete = async (reminderId: string) => {
    startTransition(async () => {
      const response = await markReminderAsComplete(reminderId)
      if (response.success) {
        // Refresh reminders after marking complete to update UI
        const refreshed = await getReminders(filterType, searchQuery)
        if (refreshed.success && refreshed.data) {
          // Map status string to correct type
          const typedData = refreshed.data.map((item: any) => ({
            ...item,
            status: item.status as "pending" | "sent" | "completed"
          }))
          setReminders(typedData)
        } else {
          // Fallback to updating state directly
          setReminders((prev) =>
            prev.map((r) => (r.id === reminderId ? { ...r, status: "completed" } : r))
          )
        }
        toast({
          title: "Success",
          description: "Reminder marked as completed",
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to update reminder status",
          variant: "destructive",
        })
      }
    })
  }

  const handleRescheduleReminder = async (reminderId: string) => {
    if (!selectedDate) return

    startTransition(async () => {
      const response = await updateReminder(reminderId, "pending", selectedDate.toISOString())
      if (response.success) {
        setReminders((prev) =>
          prev.map((r) => (r.id === reminderId ? { ...r, dueDate: selectedDate.toISOString() } : r))
        )
        setIsRescheduleOpen(false)
        setSelectedDate(undefined)
        toast({
          title: "Success",
          description: "Reminder rescheduled successfully",
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to reschedule reminder",
          variant: "destructive",
        })
      }
    })
  }

  const handleDeleteReminder = async (reminderId: string) => {
    if (!window.confirm("Are you sure you want to delete this reminder?")) return

    startTransition(async () => {
      const response = await deleteReminder(reminderId)
      if (response.success) {
        setReminders((prev) => prev.filter((r) => r.id !== reminderId))
        toast({
          title: "Success",
          description: "Reminder deleted successfully",
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to delete reminder",
          variant: "destructive",
        })
      }
    })
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Reminders</h1>
          <p className="text-muted-foreground">View and manage all upcoming reminders</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>All Reminders</CardTitle>
                <CardDescription>Track and manage employee deadline reminders</CardDescription>
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
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Array.from(reminderTypes).map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="upcoming" onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                <TabsTrigger value="sent">Sent</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
              </TabsList>

              <TabsContent value="upcoming">
                {loading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : filteredReminders.length > 0 ? (
                  <div className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead
                            className="cursor-pointer select-none"
                            onClick={() => {
                              if (sortColumn === "employeeName") {
                                setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                              } else {
                                setSortColumn("employeeName")
                                setSortOrder("asc")
                              }
                            }}
                          >
                            Employee
                            {sortColumn === "employeeName" && (
                              <span>{sortOrder === "asc" ? " ▲" : " ▼"}</span>
                            )}
                          </TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead
                            className="cursor-pointer select-none"
                            onClick={() => {
                              if (sortColumn === "dueDate") {
                                setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                              } else {
                                setSortColumn("dueDate")
                                setSortOrder("asc")
                              }
                            }}
                          >
                            Due Date
                            {sortColumn === "dueDate" && (
                              <span>{sortOrder === "asc" ? " ▲" : " ▼"}</span>
                            )}
                          </TableHead>
                          <TableHead>Days Remaining</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedReminders.map((reminder) => (
                          <TableRow key={reminder.id}>
                            <TableCell>
                            <Link href={`/reminders/${reminder.id}`} className="hover:underline">
                                    {reminder.employeeName}
                                  </Link>
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
                            <TableCell>
                              <Badge
                                variant={reminder.status === "pending" ? "outline" : "default"}
                                className={
                                  reminder.status === "pending"
                                    ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
                                    : ""
                                }
                              >
                                {reminder.status === "pending" ? "Pending" : "Sent"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                {reminder.status === "pending" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSendReminder(reminder.id)}
                                    disabled={isPending}
                                  >
                                    Send Now
                                  </Button>
                                  
                                )}
                                <Button variant="outline" size="sm" asChild>
                                    <Link href={`/reminders/${reminder.id}`}>View Details</Link>
                                  </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleMarkComplete(reminder.id)}>
                                      <CheckCircle2 className="mr-2 h-4 w-4" />
                                      Mark Complete
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedReminder(reminder)
                                        setIsRescheduleOpen(true)
                                      }}
                                    >
                                      <CalendarIcon className="mr-2 h-4 w-4" />
                                      Reschedule
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleDeleteReminder(reminder.id)}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  
                                  </DropdownMenuContent>
                                </DropdownMenu>
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
                      <CheckCircle className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="mt-4 text-lg font-medium">No reminders found</h3>
                    <p className="mt-2 text-sm text-center text-muted-foreground">
                      {searchQuery || filterType !== "all"
                        ? "Try adjusting your filters to see more results."
                        : "There are no upcoming reminders at this time."}
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="sent">
                {loading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : filteredReminders.length > 0 ? (
                  <div className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Days Remaining</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredReminders.map((reminder) => (
                          <TableRow key={reminder.id}>
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
                            <TableCell>
                              <Badge>Sent</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="rounded-full bg-muted p-3">
                      <CheckCircle className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="mt-4 text-lg font-medium">No sent reminders</h3>
                    <p className="mt-2 text-sm text-center text-muted-foreground">
                      There are no sent reminders at this time.
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="completed">
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="rounded-full bg-muted p-3">
                    <CheckCircle className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="mt-4 text-lg font-medium">No completed reminders</h3>
                  <p className="mt-2 text-sm text-center text-muted-foreground">
                    There are no completed reminders at this time.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      <Dialog open={isRescheduleOpen} onOpenChange={setIsRescheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule Reminder</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              initialFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsRescheduleOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedReminder && handleRescheduleReminder(selectedReminder.id)}
              disabled={!selectedDate}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}


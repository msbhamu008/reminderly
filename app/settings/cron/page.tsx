"use client"

import { useState, useEffect, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { AlertCircle, Calendar, CheckCircle, Clock, Loader2, RefreshCw, XCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type CronJobLog = {
  id: string
  job_type: string
  trigger_type: string
  status: string
  executed_at: string
  completed_at: string | null
  result_data: any
}

export default function CronJobsPage() {
  const [logs, setLogs] = useState<CronJobLog[]>([])
  const [loading, setLoading] = useState(true)
  const [isTriggering, startTriggerTransition] = useTransition()
  const [selectedJobType, setSelectedJobType] = useState<string>("process_reminders")
  const [activeTab, setActiveTab] = useState("logs")
  const [triggerResult, setTriggerResult] = useState<any>(null)
  const { toast } = useToast()

  // Load cron job logs
  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true)

      try {
        const response = await fetch("/api/cron/logs")
        const data = await response.json()

        if (data.success) {
          setLogs(data.logs)
        } else {
          toast({
            title: "Error",
            description: "Failed to load cron job logs",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Error loading cron job logs:", error)
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchLogs()

    // Refresh logs every 30 seconds
    const interval = setInterval(fetchLogs, 30000)

    return () => clearInterval(interval)
  }, [toast])

  const handleTriggerJob = () => {
    setTriggerResult(null)

    startTriggerTransition(async () => {
      try {
        const response = await fetch("/api/cron/logs", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ jobType: selectedJobType }),
        })

        const data = await response.json()
        setTriggerResult(data)

        if (data.success) {
          toast({
            title: "Success",
            description: `${selectedJobType} job triggered successfully`,
          })

          // Refresh logs
          const logsResponse = await fetch("/api/cron/logs")
          const logsData = await logsResponse.json()

          if (logsData.success) {
            setLogs(logsData.logs)
          }
        } else {
          toast({
            title: "Error",
            description: data.error || "Failed to trigger job",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Error triggering job:", error)
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        })
      }
    })
  }

  const getJobTypeLabel = (jobType: string) => {
    switch (jobType) {
      case "process_reminders":
        return "Process Reminders"
      case "process_recurring":
        return "Process Recurring Reminders"
      default:
        return jobType
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        )
      case "failed":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        )
      case "started":
        return (
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
            <Clock className="h-3 w-3 mr-1" />
            Running
          </Badge>
        )
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Cron Jobs</h1>
          <p className="text-muted-foreground">Monitor and manually trigger scheduled jobs</p>
        </div>

        <Tabs defaultValue="logs" onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="logs">Job Logs</TabsTrigger>
            <TabsTrigger value="trigger">Manual Trigger</TabsTrigger>
          </TabsList>

          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Cron Job Logs</CardTitle>
                <CardDescription>View the history of scheduled and manually triggered jobs</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="mt-4 text-muted-foreground">Loading job logs...</p>
                  </div>
                ) : logs.length > 0 ? (
                  <div className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Job Type</TableHead>
                          <TableHead>Trigger</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Started At</TableHead>
                          <TableHead>Completed At</TableHead>
                          <TableHead>Duration</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.map((log) => {
                          // Calculate duration
                          let duration = "N/A"
                          if (log.completed_at) {
                            const start = new Date(log.executed_at).getTime()
                            const end = new Date(log.completed_at).getTime()
                            const durationMs = end - start
                            duration = `${(durationMs / 1000).toFixed(2)}s`
                          }

                          return (
                            <TableRow key={log.id}>
                              <TableCell>{getJobTypeLabel(log.job_type)}</TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {log.trigger_type === "manual" ? "Manual" : "Scheduled"}
                                </Badge>
                              </TableCell>
                              <TableCell>{getStatusBadge(log.status)}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  {formatDate(log.executed_at)}
                                </div>
                              </TableCell>
                              <TableCell>
                                {log.completed_at ? (
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    {formatDate(log.completed_at)}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">Running...</span>
                                )}
                              </TableCell>
                              <TableCell>{duration}</TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="rounded-full bg-muted p-3">
                      <Clock className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="mt-4 text-lg font-medium">No job logs found</h3>
                    <p className="mt-2 text-sm text-center text-muted-foreground">
                      No cron jobs have been executed yet
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trigger" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Manual Job Trigger</CardTitle>
                <CardDescription>Manually trigger cron jobs for testing purposes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Job Type</label>
                    <Select value={selectedJobType} onValueChange={setSelectedJobType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select job type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="process_reminders">Process Reminders</SelectItem>
                        <SelectItem value="process_recurring">Process Recurring Reminders</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end">
                    <Button onClick={handleTriggerJob} disabled={isTriggering} className="w-full">
                      {isTriggering ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Triggering...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Trigger Job
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {triggerResult && (
                  <Alert variant={triggerResult.success ? "default" : "destructive"}>
                    {triggerResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    <AlertTitle>
                      {triggerResult.success ? "Job Triggered Successfully" : "Failed to Trigger Job"}
                    </AlertTitle>
                    <AlertDescription>
                      {triggerResult.message || triggerResult.error || "Job execution completed"}

                      {triggerResult.success && triggerResult.result && (
                        <pre className="mt-2 p-2 bg-muted rounded-md text-xs overflow-auto">
                          {JSON.stringify(triggerResult.result, null, 2)}
                        </pre>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}


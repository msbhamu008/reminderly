"use client"

import type React from "react"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileSpreadsheet } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { uploadEmployeeData, getReminderTypesForUpload } from "../actions/upload-actions"
import { useEffect } from "react"
import * as XLSX from "xlsx"
import { useToast } from "@/hooks/use-toast"

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<any[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [columnMapping, setColumnMapping] = useState<Record<string, number>>({})
  const [reminderTypeId, setReminderTypeId] = useState<string>("")
  const [reminderTypes, setReminderTypes] = useState<{ id: string; name: string }[]>([])
  const [isPending, startTransition] = useTransition()
  const [uploadStep, setUploadStep] = useState<"select" | "preview" | "configure" | "complete">("select")
  const [uploadResult, setUploadResult] = useState<{ success: number; failed: number; errors: string[] }>()
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  // Fetch reminder types for the dropdown
  useEffect(() => {
    async function fetchReminderTypes() {
      try {
        const response = await getReminderTypesForUpload()
        if (response.success) {
          setReminderTypes(response.data)
        }
      } catch (error) {
        console.error("Failed to load reminder types:", error)
        toast({
          title: "Error",
          description: "Failed to load reminder types",
          variant: "destructive",
        })
      }
    }

    fetchReminderTypes()
  }, [toast])

  const formatExcelDate = (date: any): string => {
    if (!date) return "N/A"

    // If the date is a number (Excel serial date)
    if (typeof date === "number") {
      try {
        // Try using the XLSX date parser
        const dateObj = XLSX.SSF.parse_date_code(date)
        if (dateObj && dateObj.y && dateObj.m && dateObj.d) {
          return `${dateObj.y}-${String(dateObj.m).padStart(2, "0")}-${String(dateObj.d).padStart(2, "0")}`
        }

        // If parse_date_code fails, try another approach for numeric dates
        const excelEpoch = new Date(1899, 11, 30)
        const dateObj2 = new Date(excelEpoch.getTime() + (date - 1) * 24 * 60 * 60 * 1000)
        return dateObj2.toISOString().split("T")[0]
      } catch (error) {
        return "Invalid Date"
      }
    }

    // If the date is a string, try to parse it
    if (typeof date === "string") {
      try {
        const dateObj = new Date(date)
        if (!isNaN(dateObj.getTime())) {
          return dateObj.toISOString().split("T")[0]
        }
        return date // Return as is if we can't parse it
      } catch (error) {
        return date
      }
    }

    // If it's a Date object
    if (date instanceof Date) {
      return date.toISOString().split("T")[0]
    }

    // Default fallback
    return String(date)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsLoading(true)
    const selectedFile = e.target.files?.[0]

    if (selectedFile) {
      setFile(selectedFile)

      try {
        // Read the file as array buffer
        const buffer = await selectedFile.arrayBuffer()

        // Parse the Excel file
        const workbook = XLSX.read(buffer, { type: "array" })
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]

        // Convert sheet to JSON with headers
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

        if (jsonData.length > 0) {
          // Extract headers (first row)
          const extractedHeaders = jsonData[0] as string[]
          setHeaders(extractedHeaders)

          // Get data rows (excluding header)
          const rows = jsonData.slice(1).filter((row) => Array.isArray(row) && row.length > 0)
          setPreviewData(rows)

          // Auto-detect column mapping
          const columnMap: Record<string, number> = {}
          extractedHeaders.forEach((header, index) => {
            if (!header) return

            const headerLower = String(header).toLowerCase()

            if (headerLower.includes("name") || headerLower === "employee name") {
              columnMap.name = index
            } else if (headerLower.includes("id") || headerLower === "employee id" || headerLower === "emp id") {
              columnMap.employeeId = index
            } else if (
              headerLower.includes("email") &&
              !headerLower.includes("manager") &&
              !headerLower.includes("hr")
            ) {
              columnMap.email = index
            } else if (headerLower.includes("manager") && headerLower.includes("email")) {
              columnMap.managerEmail = index
            } else if (
              (headerLower.includes("hr") || headerLower.includes("human resources")) &&
              headerLower.includes("email")
            ) {
              columnMap.hrEmail = index
            } else if (
              headerLower.includes("position") ||
              headerLower.includes("title") ||
              headerLower === "job title"
            ) {
              columnMap.position = index
            } else if (headerLower.includes("department") || headerLower === "dept") {
              columnMap.department = index
            } else if (
              headerLower.includes("due") ||
              headerLower.includes("date") ||
              headerLower.includes("expiry") ||
              headerLower.includes("expiration") ||
              headerLower === "deadline"
            ) {
              columnMap.dueDate = index
            }
          })

          setColumnMapping(columnMap)
          setUploadStep("preview")
        } else {
          toast({
            title: "Error",
            description: "The file appears to be empty",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Error parsing file:", error)
        toast({
          title: "Error",
          description: "Failed to parse Excel file. Please make sure it is a valid Excel file.",
          variant: "destructive",
        })
      }

      setIsLoading(false)
    }
  }

  const handleColumnSelect = (field: string, value: string) => {
    setColumnMapping({
      ...columnMapping,
      [field]: Number.parseInt(value),
    })
  }

  const handleUpload = () => {
    if (!file || !reminderTypeId) {
      toast({
        title: "Missing Information",
        description: "Please select a reminder type",
        variant: "destructive",
      })
      return
    }

    // Make sure we have the required fields mapped
    if (!("name" in columnMapping) || !("dueDate" in columnMapping)) {
      toast({
        title: "Missing Column Mapping",
        description: "Please map the required fields: Name and Due Date",
        variant: "destructive",
      })
      return
    }

    startTransition(async () => {
      try {
        const result = await uploadEmployeeData(previewData, columnMapping, reminderTypeId)

        setUploadResult(result)
        setUploadStep("complete")

        toast({
          title: "Upload Complete",
          description: `Successfully processed ${result.success} records. Failed: ${result.failed}`,
          variant: result.failed > 0 ? "destructive" : "default",
        })
      } catch (error) {
        console.error("Error uploading data:", error)
        toast({
          title: "Upload Failed",
          description: (error as Error).message || "An unexpected error occurred",
          variant: "destructive",
        })
      }
    })
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Upload Employee Data</h1>
          <p className="text-muted-foreground">Upload an Excel sheet containing employee details and reminder dates</p>
        </div>

        <Tabs defaultValue="upload" className="w-full">
          <TabsList>
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="history">Upload History</TabsTrigger>
          </TabsList>
          <TabsContent value="upload">
            <Card>
              <CardHeader>
                <CardTitle>Upload Employee Data</CardTitle>
                <CardDescription>Upload an Excel file with employee information and reminder dates</CardDescription>
              </CardHeader>
              <CardContent>
                {uploadStep === "select" && (
                  <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-12">
                    <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
                    <div className="flex flex-col items-center text-center">
                      <h3 className="font-medium">Drag and drop your Excel file</h3>
                      <p className="text-sm text-muted-foreground mb-4">or click to browse files (XLSX, XLS, CSV)</p>
                      <Input
                        id="file"
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        className="max-w-sm"
                        onChange={handleFileChange}
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                )}

                {uploadStep === "preview" && (
                  <div className="flex flex-col gap-4">
                    <Alert>
                      <FileSpreadsheet className="h-4 w-4" />
                      <AlertTitle>File selected: {file?.name}</AlertTitle>
                      <AlertDescription>
                        Preview the data below and map columns to the required fields.
                      </AlertDescription>
                    </Alert>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="space-y-2">
                        <Label htmlFor="reminder-type">Reminder Type</Label>
                        <Select value={reminderTypeId} onValueChange={setReminderTypeId}>
                          <SelectTrigger id="reminder-type">
                            <SelectValue placeholder="Select reminder type" />
                          </SelectTrigger>
                          <SelectContent>
                            {reminderTypes.map((type) => (
                              <SelectItem key={type.id} value={type.id}>
                                {type.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4 mb-4">
                      <div className="space-y-2">
                        <Label>
                          Employee Name <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          value={columnMapping.name?.toString() || ""}
                          onValueChange={(value) => handleColumnSelect("name", value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select column" />
                          </SelectTrigger>
                          <SelectContent>
                            {headers.map((header, index) => (
                              <SelectItem key={index} value={index.toString()}>
                                {header}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Employee ID</Label>
                        <Select
                          value={columnMapping.employeeId?.toString() || ""}
                          onValueChange={(value) => handleColumnSelect("employeeId", value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select column" />
                          </SelectTrigger>
                          <SelectContent>
                            {headers.map((header, index) => (
                              <SelectItem key={index} value={index.toString()}>
                                {header}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Select
                          value={columnMapping.email?.toString() || ""}
                          onValueChange={(value) => handleColumnSelect("email", value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select column" />
                          </SelectTrigger>
                          <SelectContent>
                            {headers.map((header, index) => (
                              <SelectItem key={index} value={index.toString()}>
                                {header}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Manager Email</Label>
                        <Select
                          value={columnMapping.managerEmail?.toString() || ""}
                          onValueChange={(value) => handleColumnSelect("managerEmail", value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select column" />
                          </SelectTrigger>
                          <SelectContent>
                            {headers.map((header, index) => (
                              <SelectItem key={index} value={index.toString()}>
                                {header}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>HR Email</Label>
                        <Select
                          value={columnMapping.hrEmail?.toString() || ""}
                          onValueChange={(value) => handleColumnSelect("hrEmail", value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select column" />
                          </SelectTrigger>
                          <SelectContent>
                            {headers.map((header, index) => (
                              <SelectItem key={index} value={index.toString()}>
                                {header}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Position/Title</Label>
                        <Select
                          value={columnMapping.position?.toString() || ""}
                          onValueChange={(value) => handleColumnSelect("position", value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select column" />
                          </SelectTrigger>
                          <SelectContent>
                            {headers.map((header, index) => (
                              <SelectItem key={index} value={index.toString()}>
                                {header}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Department</Label>
                        <Select
                          value={columnMapping.department?.toString() || ""}
                          onValueChange={(value) => handleColumnSelect("department", value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select column" />
                          </SelectTrigger>
                          <SelectContent>
                            {headers.map((header, index) => (
                              <SelectItem key={index} value={index.toString()}>
                                {header}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>
                          Due Date <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          value={columnMapping.dueDate?.toString() || ""}
                          onValueChange={(value) => handleColumnSelect("dueDate", value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select column" />
                          </SelectTrigger>
                          <SelectContent>
                            {headers.map((header, index) => (
                              <SelectItem key={index} value={index.toString()}>
                                {header}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {headers.map((header, index) => (
                              <TableHead key={index}>{header}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewData.slice(0, 5).map((row, rowIndex) => (
                            <TableRow key={rowIndex}>
                              {headers.map((_, colIndex) => (
                                <TableCell key={`${rowIndex}-${colIndex}`}>
                                  {colIndex === columnMapping.dueDate ? formatExcelDate(row[colIndex]) : row[colIndex]}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {uploadStep === "complete" && (
                  <div className="flex flex-col items-center justify-center p-6">
                    <div className="rounded-full bg-green-100 p-3 dark:bg-green-900">
                      <svg
                        className="h-6 w-6 text-green-600 dark:text-green-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                    </div>
                    <h3 className="mt-4 text-lg font-medium">Upload Complete</h3>
                    <div className="mt-2 text-sm text-center">
                      <p>Successfully processed {uploadResult?.success} records.</p>
                      {uploadResult?.failed ? (
                        <p className="text-red-500">Failed to process {uploadResult.failed} records.</p>
                      ) : null}
                    </div>

                    {uploadResult?.errors && uploadResult.errors.length > 0 && (
                      <div className="mt-4 w-full">
                        <h4 className="font-medium mb-2">Errors:</h4>
                        <div className="text-xs text-red-500 max-h-40 overflow-y-auto p-2 bg-red-50 dark:bg-red-950 rounded">
                          {uploadResult.errors.map((error, i) => (
                            <div key={i} className="mb-1">
                              {error}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-6 flex gap-3">
                      <Button variant="outline" onClick={() => setUploadStep("select")}>
                        Upload Another File
                      </Button>
                      <Button asChild>
                        <a href="/reminders">View Reminders</a>
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
              {uploadStep === "preview" && (
                <CardFooter className="flex justify-between">
                  <Button variant="outline" onClick={() => setUploadStep("select")}>
                    Back
                  </Button>
                  <Button
                    onClick={handleUpload}
                    disabled={
                      isPending ||
                      !reminderTypeId ||
                      columnMapping.name === undefined ||
                      columnMapping.dueDate === undefined
                    }
                  >
                    {isPending ? "Uploading..." : "Upload and Continue"}
                  </Button>
                </CardFooter>
              )}
            </Card>
          </TabsContent>
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Upload History</CardTitle>
                <CardDescription>View your previous data uploads</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-6">
                  <p className="text-muted-foreground">No upload history available</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}


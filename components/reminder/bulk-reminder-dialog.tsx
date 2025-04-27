import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { createBulkReminders } from "@/app/actions/reminder-actions"

interface BulkReminderDialogProps {
  employeeId: string
}

const BulkReminderDialog = ({ employeeId }: BulkReminderDialogProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile) {
      toast.error('Please select a file')
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('employeeId', employeeId)

      const result = await createBulkReminders(formData)
      if (result.success) {
        toast.success('Reminders uploaded successfully')
      } else {
        toast.error(result.error || 'Failed to upload reminders')
      }
    } catch (error) {
      toast.error('Failed to upload reminders')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Bulk Upload Reminders</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>Upload Multiple Reminders</DialogTitle>
          <DialogDescription>
            Upload a CSV file containing multiple reminders. Each row can contain multiple reminders for the employee.
          </DialogDescription>
        </DialogHeader>
        
        <form action={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-4">
              <Label htmlFor="file">Upload CSV File</Label>
              <Input
                id="file"
                name="file"
                type="file"
                accept=".csv"
                required
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) setSelectedFile(file)
                }}
              />
              <input type="hidden" name="employeeId" value={employeeId} />
            </div>
            
            <div className="bg-muted p-4 rounded-md">
              <h4 className="font-medium mb-2">CSV Format Instructions:</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Your CSV should have the following columns repeated for each reminder:
              </p>
              <code className="text-xs block bg-background p-2 rounded">
                title1,description1,due_date1,type1,title2,description2,due_date2,type2,...
              </code>
              <ul className="text-sm mt-2 space-y-1 text-muted-foreground">
                <li>• Each reminder requires 4 columns: title, description, due_date, type</li>
                <li>• Due dates should be in YYYY-MM-DD format</li>
                <li>• You can add multiple reminders per row (4 columns per reminder)</li>
                <li>• Description is optional, other fields are required</li>
              </ul>
              
              <div className="mt-4">
                <h5 className="font-medium mb-1">Example:</h5>
                <code className="text-xs block bg-background p-2 rounded">
                  License Renewal,Renew medical license,2025-06-01,license,CME Credits,Complete 40 hours,2025-12-31,education
                </code>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button type="submit" disabled={!selectedFile}>
              Upload Reminders
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default BulkReminderDialog
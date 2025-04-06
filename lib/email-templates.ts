type ReminderEmailData = {
  employeeName: string;
  type: string;
  dueDate: string;
  daysRemaining: number;
  hrName?: string;
  companyName?: string;
  additionalNotes?: string;
}

export function getReminderEmailTemplate(data: ReminderEmailData) {
  const {
    employeeName,
    type,
    dueDate,
    daysRemaining,
    hrName = 'HR Department',
    companyName = 'Our Company',
    additionalNotes,
  } = data;

  const formattedDate = new Date(dueDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return {
    subject: `Important: ${type} Reminder for ${employeeName}`,
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
          <h1 style="color: #1a1a1a; margin: 0 0 10px 0; font-size: 24px;">Important Reminder</h1>
          <p style="color: #666; margin: 0; font-size: 16px;">${type}</p>
        </div>

        <div style="margin-bottom: 30px;">
          <p style="font-size: 16px; line-height: 1.5; color: #333;">Hello ${employeeName},</p>
          <p style="font-size: 16px; line-height: 1.5; color: #333;">
            This is a reminder about your upcoming ${type.toLowerCase()}. Please ensure to complete this before the due date.
          </p>
        </div>

        <div style="background-color: #f1f5f9; padding: 20px; border-radius: 5px; margin-bottom: 30px;">
          <h2 style="color: #1a1a1a; margin: 0 0 15px 0; font-size: 18px;">Important Details:</h2>
          <ul style="list-style: none; padding: 0; margin: 0;">
            <li style="margin-bottom: 10px; color: #333;">
              <strong>Due Date:</strong> ${formattedDate}
            </li>
            <li style="margin-bottom: 10px; color: #333;">
              <strong>Days Remaining:</strong> ${daysRemaining}
            </li>
            ${additionalNotes ? `
            <li style="margin-bottom: 10px; color: #333;">
              <strong>Additional Notes:</strong> ${additionalNotes}
            </li>
            ` : ''}
          </ul>
        </div>

        ${daysRemaining <= 7 ? `
        <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-bottom: 30px;">
          <p style="margin: 0; color: #856404;">
            ⚠️ This deadline is approaching soon. Please ensure timely completion.
          </p>
        </div>
        ` : ''}

        <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
          <p style="font-size: 14px; color: #666; margin: 0;">
            Best regards,<br/>
            ${hrName}<br/>
            ${companyName}
          </p>
        </div>

        <div style="margin-top: 30px; font-size: 12px; color: #999;">
          <p style="margin: 0;">
            This is an automated reminder. If you have already completed this task, please inform your HR department.
          </p>
        </div>
      </div>
    `
  };
}

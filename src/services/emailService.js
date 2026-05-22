import nodemailer from 'nodemailer';

// Helper to create transport
const getTransporter = async () => {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // Check if credentials are placeholders or blank
  const isDummy = !user || user.includes('your_email') || !pass || pass.includes('your_app_password');

  if (isDummy) {
    console.log('--- Using Nodemailer Ethereal Mock Mailer (No valid credentials in .env) ---');
    try {
      const testAccount = await nodemailer.createTestAccount();
      return nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    } catch (err) {
      console.warn('Failed to create ethereal test account, falling back to console logging.', err.message);
      return null;
    }
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for others
    auth: {
      user,
      pass,
    },
  });
};

export const sendMail = async ({ to, subject, html, text }) => {
  try {
    const transporter = await getTransporter();
    const from = process.env.SMTP_USER || 'hrms@company.com';

    if (!transporter) {
      console.log('=== EMAIL LOG (MOCKED) ===');
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`Body:\n${text || html}`);
      console.log('==========================');
      return { messageId: 'mocked-id' };
    }

    const info = await transporter.sendMail({
      from: `"HRMS Admin" <${from}>`,
      to,
      subject,
      text,
      html,
    });

    console.log(`Email sent successfully: ${info.messageId}`);
    // If it's Ethereal, log preview URL
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`Ethereal Email Preview URL: ${previewUrl}`);
    }

    return info;
  } catch (error) {
    console.error('Email sending failed:', error.message);
    // Don't crash the app for mail failures
    return null;
  }
};

export const sendEmployeeRegistrationEmail = async (employee, password) => {
  const subject = 'Welcome to the Company - HRMS Portal Credentials';
  const html = `
    <h2>Welcome to the Team, ${employee.name}!</h2>
    <p>Your HRMS account has been successfully created by the Admin.</p>
    <h3>Your Login Credentials:</h3>
    <ul>
      <li><strong>Login URL:</strong> https://hrms-main-1qzy.vercel.app//</li>
      <li><strong>Email/Username:</strong> ${employee.email}</li>
      <li><strong>Password:</strong> ${password}</li>
      <li><strong>Employee ID:</strong> ${employee.employeeId}</li>
    </ul>
    <p>Please log in and update your profile settings as soon as possible.</p>
    <br/>
    <p>Best regards,<br/>HR Operations Team</p>
  `;
  return sendMail({ to: employee.email, subject, html, text: `Welcome ${employee.name}. Your employee ID is ${employee.employeeId}, email is ${employee.email}, password is ${password}.` });
};

export const sendLeaveStatusEmail = async (leave, employee) => {
  const subject = `Leave Request - ${leave.status}`;
  const html = `
    <h2>Leave Application Update</h2>
    <p>Dear ${employee.name},</p>
    <p>Your leave application from <strong>${new Date(leave.startDate).toLocaleDateString()}</strong> to <strong>${new Date(leave.endDate).toLocaleDateString()}</strong> for <strong>${leave.type}</strong> has been <strong>${leave.status}</strong>.</p>
    ${leave.remarks ? `<p><strong>Admin Remarks:</strong> ${leave.remarks}</p>` : ''}
    <br/>
    <p>Best regards,<br/>HR Operations Team</p>
  `;
  return sendMail({ to: employee.email, subject, html, text: `Your leave request from ${new Date(leave.startDate).toLocaleDateString()} to ${new Date(leave.endDate).toLocaleDateString()} has been ${leave.status}. Remarks: ${leave.remarks}` });
};

export const sendPayslipGeneratedEmail = async (payroll, employee) => {
  const subject = `Payslip Generated for ${payroll.month}/${payroll.year}`;
  const html = `
    <h2>Payslip Notification</h2>
    <p>Dear ${employee.name},</p>
    <p>Your payslip for the month of <strong>${payroll.month}/${payroll.year}</strong> has been generated and is now available for download on the HRMS portal.</p>
    <h3>Summary:</h3>
    <ul>
      <li><strong>Basic Salary:</strong> $${payroll.basicSalary.toFixed(2)}</li>
      <li><strong>Working Days:</strong> ${payroll.workingDays}</li>
      <li><strong>Deductions:</strong> $${payroll.deductions.toFixed(2)}</li>
      <li><strong>Net Salary Paid:</strong> $${payroll.netSalary.toFixed(2)}</li>
    </ul>
    <p>Please log in to your dashboard to download the full PDF copy.</p>
    <br/>
    <p>Best regards,<br/>HR Payroll Team</p>
  `;
  return sendMail({ to: employee.email, subject, html, text: `Payslip for ${payroll.month}/${payroll.year} generated. Net Salary: $${payroll.netSalary.toFixed(2)}` });
};

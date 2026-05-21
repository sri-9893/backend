import PDFDocument from 'pdfkit';

export const generatePayslipPDF = (payroll, employee, stream) => {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  doc.pipe(stream);

  // Layout Design: Sleek and professional
  // Header Logo and Company Details
  doc.fillColor('#1E293B')
     .fontSize(20)
     .text('IT INFRASTRUCTURE CORP', 50, 50, { bold: true });
     
  doc.fontSize(10)
     .fillColor('#64748B')
     .text('101 Tech Towers, Innovation District', 50, 75)
     .text('Phone: +1 800-555-0100 | Email: payroll@itinfra.com', 50, 90);

  doc.fontSize(16)
     .fillColor('#3B82F6')
     .text('PAYSLIP', 400, 50, { align: 'right', bold: true });

  doc.fontSize(10)
     .fillColor('#475569')
     .text(`Month/Year: ${payroll.month}/${payroll.year}`, 400, 75, { align: 'right' })
     .text(`Generated Date: ${new Date().toLocaleDateString()}`, 400, 90, { align: 'right' });

  // Divider
  doc.moveTo(50, 115).lineTo(540, 115).strokeColor('#E2E8F0').lineWidth(1).stroke();

  // Employee details section
  doc.fillColor('#1E293B').fontSize(12).text('Employee Details', 50, 130, { bold: true });
  
  doc.fontSize(10).fillColor('#334155');
  doc.text(`Employee ID: ${employee.employeeId}`, 50, 155);
  doc.text(`Name: ${employee.name}`, 50, 170);
  doc.text(`Email: ${employee.email}`, 50, 185);
  doc.text(`Department: ${employee.department || 'N/A'}`, 50, 200);
  doc.text(`Designation: ${employee.designation || 'N/A'}`, 50, 215);

  doc.text(`Joining Date: ${employee.joiningDate ? new Date(employee.joiningDate).toLocaleDateString() : 'N/A'}`, 300, 155);
  doc.text(`Phone: ${employee.phone || 'N/A'}`, 300, 170);
  doc.text(`Role: ${employee.role}`, 300, 185);
  
  // Divider
  doc.moveTo(50, 235).lineTo(540, 235).strokeColor('#E2E8F0').lineWidth(1).stroke();

  // Attendance stats section
  doc.fillColor('#1E293B').fontSize(12).text('Attendance & Working Days Summary', 50, 250, { bold: true });
  
  doc.fontSize(10).fillColor('#334155');
  doc.text(`Official Working Days: ${payroll.workingDays}`, 50, 275);
  doc.text(`Present Days: ${payroll.presentDays}`, 50, 290);
  doc.text(`Approved Leaves: ${payroll.approvedLeaves}`, 300, 275);
  doc.text(`Holidays: ${payroll.holidays}`, 300, 290);
  doc.text(`Absent Days: ${payroll.absentDays}`, 300, 305);

  // Divider
  doc.moveTo(50, 325).lineTo(540, 325).strokeColor('#E2E8F0').lineWidth(1).stroke();

  // Salary Calculations Table
  doc.fillColor('#1E293B').fontSize(12).text('Salary Breakdown', 50, 340, { bold: true });

  // Grid headers
  doc.fillColor('#F8FAFC');
  doc.rect(50, 360, 490, 25).fill();
  doc.fillColor('#475569').fontSize(10);
  doc.text('Description', 60, 368);
  doc.text('Earnings', 250, 368, { width: 100, align: 'right' });
  doc.text('Deductions', 400, 368, { width: 100, align: 'right' });

  // Table content
  doc.fillColor('#334155');
  doc.text('Basic Salary', 60, 395);
  doc.text(`$${payroll.basicSalary.toFixed(2)}`, 250, 395, { width: 100, align: 'right' });
  doc.text('$0.00', 400, 395, { width: 100, align: 'right' });

  doc.text(`Absent Deductions (${payroll.absentDays} day(s))`, 60, 415);
  doc.text('$0.00', 250, 415, { width: 100, align: 'right' });
  doc.text(`$${payroll.deductions.toFixed(2)}`, 400, 415, { width: 100, align: 'right' });

  // Table summary
  doc.moveTo(50, 440).lineTo(540, 440).strokeColor('#E2E8F0').lineWidth(1).stroke();

  // Net Salary
  doc.fillColor('#F1F5F9');
  doc.rect(50, 450, 490, 35).fill();
  doc.fillColor('#1E293B').fontSize(12).text('Net Salary Paid', 60, 462, { bold: true });
  doc.fillColor('#1E293B').fontSize(14).text(`$${payroll.netSalary.toFixed(2)}`, 350, 460, { width: 180, align: 'right', bold: true });

  // Footer / Disclaimer
  doc.fontSize(8)
     .fillColor('#94A3B8')
     .text('This is a system-generated payslip and does not require a physical signature.', 50, 520, { align: 'center' });

  doc.end();
};

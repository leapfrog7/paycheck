export function calculateGrossPay({ hourlyRate = 0, hoursWorked = 0, salary = 0 }) {
  const numericHourlyRate = Number(hourlyRate) || 0
  const numericHoursWorked = Number(hoursWorked) || 0
  const numericSalary = Number(salary) || 0

  if (numericSalary > 0) {
    return numericSalary
  }

  return numericHourlyRate * numericHoursWorked
}

export function calculateNetPay({ grossPay = 0, deductions = 0 }) {
  return Math.max(0, Number(grossPay) - Number(deductions))
}

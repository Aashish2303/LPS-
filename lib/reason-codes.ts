export const reasonCodes = [
  ['RC-01', 'Workforce', 'Insufficient manpower'],
  ['RC-02', 'Diversion', 'Crew diverted to another task'],
  ['RC-03', 'Skills', 'Required skills missing'],
  ['RC-04', 'Supervision', 'Supervisor absent'],
  ['RC-05', 'Quality', 'Rework required'],
  ['RC-06', 'Weather', 'Adverse weather'],
  ['RC-07', 'Materials', 'Material missing or wrong specification'],
  ['RC-08', 'Drawings', 'Drawing or RFI not issued'],
  ['RC-09', 'Equipment', 'Plant unavailable'],
  ['RC-10', 'Planning', 'Task not properly planned'],
  ['RC-11', 'Site issues', 'Access or logistics'],
  ['RC-12', 'Safety', 'Safety hold or incident'],
  ['RC-13', 'Client', 'Client approval delay'],
  ['RC-14', 'Payment', 'Subcontractor payment dispute'],
  ['RC-15', 'Predecessor delay', 'Dependent task not complete'],
  ['RC-16', 'Other', 'Specify the reason'],
] as const;

export const otherReason = 'RC-16';
const previousLabels: Record<string, string> = {
  'Quality / rework': 'RC-05', 'Access / logistics': 'RC-11',
  'Client approval': 'RC-13', Commercial: 'RC-14',
};

export function reasonCode(value: string) {
  return reasonCodes.find(([code, title]) => value === code || value === title)?.[0]
    ?? (Object.hasOwn(previousLabels, value) ? previousLabels[value] : undefined);
}

export function reasonLabel(value: string) {
  const entry = reasonCodes.find(([code]) => code === reasonCode(value));
  return entry ? entry[0] + ' · ' + entry[1] : value;
}

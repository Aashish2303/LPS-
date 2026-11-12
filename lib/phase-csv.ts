import { addDays, dateSchema, type Command } from './domain';

function csvRows(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let closed = false;
  const pushField = () => {
    row.push(field.trim());
    field = '';
    closed = false;
  };
  const pushRow = () => {
    pushField();
    if (row.some(Boolean)) rows.push(row);
    row = [];
  };
  const csv = input.replace(/^\uFEFF/, '');
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (quoted) {
      if (char === '"' && csv[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
        closed = true;
      } else field += char;
    } else if (char === ',') {
      pushField();
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && csv[i + 1] === '\n') i++;
      pushRow();
    } else if (char === '"') {
      if (field.trim() || closed) throw Error('Unexpected quote in CSV');
      field = '';
      quoted = true;
    } else if (closed) {
      if (char !== ' ' && char !== '\t') throw Error('Expected a comma after a quoted value');
    } else field += char;
  }
  if (quoted) throw Error('CSV contains an unclosed quoted field');
  pushRow();
  return rows;
}

const headerKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function parseDate(value: string, field: string, row: number) {
  let date = value;
  const named = /^(\d{1,2})[- /]([a-z]{3,9})[- /](\d{4})$/i.exec(value);
  const numeric = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value);
  if (named) date = named[3] + '-' + String(months.indexOf(named[2].slice(0, 3).toLowerCase()) + 1).padStart(2, '0') + '-' + named[1].padStart(2, '0');
  else if (numeric) date = numeric[3] + '-' + numeric[2].padStart(2, '0') + '-' + numeric[1].padStart(2, '0');
  if (!dateSchema.safeParse(date).success) throw Error('CSV row ' + row + ': enter a valid ' + field + ' date (YYYY-MM-DD).');
  return date;
}

export function parsePhaseCsv(input: string): Extract<Command, {type:'importTasks'}> {
  const [header, ...rows] = csvRows(input);
  if (!header || !rows.length) throw Error('CSV needs a header and at least one activity.');
  if (rows.length > 500) throw Error('Import up to 500 activities at a time.');
  const keys = header.map(headerKey);
  if (new Set(keys).size !== keys.length) throw Error('CSV headers must be unique.');
  const tasks = rows.map((cells, index) => {
    const number = index + 2;
    if (cells.slice(keys.length).some(Boolean)) throw Error('CSV row ' + number + ': put values containing commas in quotes.');
    const row = new Map(keys.map((key, i) => [key, cells[i] ?? '']));
    const get = (...aliases: string[]) => aliases.map(alias => row.get(alias)).find(Boolean) ?? '';
    const id = get('id', 'slno', 'activityid', 'taskid');
    const name = get('name', 'activity', 'description', 'taskname');
    const unit = get('unit', 'uom', 'unitofmeasurement');
    const quantity = get('total', 'quantity', 'totalquantity', 'qty');
    if (!id || !name || !unit || !quantity) throw Error('CSV row ' + number + ': ID, activity name, unit and quantity are required.');
    const total = Number(quantity);
    if (!Number.isFinite(total) || total <= 0 || total > 1e9 || Math.abs(total * 1000 - Math.round(total * 1000)) >= 0.0001) {
      throw Error('CSV row ' + number + ': enter a positive quantity with up to three decimal places.');
    }
    const start = parseDate(get('earlystart', 'eps', 'es', 'start', 'plannedstart'), 'early start', number);
    const finish = parseDate(get('earlyfinish', 'epf', 'ef', 'finish', 'plannedfinish'), 'early finish', number);
    const lateStart = get('latestart', 'lps', 'ls');
    const lateFinish = get('latefinish', 'lpf', 'lf');
    const floatText = get('float', 'totalfloat', 'floatdays', 'totalfloatdays');
    const float = floatText ? Number(floatText.replace(/\s*(?:d|days?)$/i, '')) : undefined;
    if (float !== undefined && (!Number.isFinite(float) || Math.abs(float) > 1000000)) throw Error('CSV row ' + number + ': enter a numeric float in days.');
    const owner = get('owner', 'responsible', 'lastplanner') || 'Trade lead';
    const descriptions = get('constraints', 'constraint', 'openconstraints', 'constraintdescription').split('|').map(v => v.trim()).filter(Boolean);
    const due = get('constraintdue', 'constraintduedate');
    return {
      type: 'task' as const, id, name, unit, total, start, finish, owner,
      trade: get('trade') || 'Phase Schedule',
      area: get('area', 'location', 'zone') || 'Zone A',
      predecessors: get('predecessors', 'predecessor', 'predecessorids').split(/[|,]/).map(v => v.trim()).filter(Boolean),
      pull: true, milestoneId: '',
      schedule: {
        lateStart: lateStart ? parseDate(lateStart, 'late start', number) : undefined,
        lateFinish: lateFinish ? parseDate(lateFinish, 'late finish', number) : undefined,
        float,
      },
      constraints: descriptions.map(description => ({
        description, category: get('constraintcategory', 'constrainttype') || 'Planning',
        owner: get('constraintowner') || owner,
        due: due ? parseDate(due, 'constraint due', number) : start,
      })),
    };
  });
  return {type:'importTasks',tasks};
}

export function phaseCsvTemplate(start: string) {
  const d = (days: number) => addDays(start, days);
  return [
    'id,name,trade,area,owner,unit,total,early_start,early_finish,late_start,late_finish,float,predecessors,constraints,constraint_category,constraint_owner,constraint_due',
    ['A01','Foundation excavation','Civil','Zone A','Earthworks lead','m³',42,d(0),d(9),d(2),d(11),2,'','','','',''].join(','),
    ['A02','Footing concrete','Structure','Zone A','Concrete lead','m³',24,d(10),d(15),d(10),d(15),0,'A01','Footing drawing approval pending','Drawings','Design coordinator',d(9)].join(','),
    ['A03','Foundation backfill','Civil','Zone A','Earthworks lead','m³',36,d(16),d(21),d(16),d(21),0,'A02','','','',''].join(','),
    ['B01','Site drainage','Civil','Zone B','Drainage lead','m',30,d(3),d(12),d(1),d(10),-2,'','','','',''].join(','),
  ].join('\n') + '\n';
}

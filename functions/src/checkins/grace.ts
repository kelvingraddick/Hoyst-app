export type GraceRule = {
  allowance: number;
  windowDays: number;
};

function padDatePart(value: number) {
  return value.toString().padStart(2, '0');
}

export function getPreviousDateKey(dateKey: string) {
  const [year = '1970', month = '01', day = '01'] = dateKey.split('-');
  const date = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day)),
  );

  date.setUTCDate(date.getUTCDate() - 1);

  return [
    date.getUTCFullYear(),
    padDatePart(date.getUTCMonth() + 1),
    padDatePart(date.getUTCDate()),
  ].join('-');
}

export function getRollingDateKeys(todayDateKey: string, windowDays: number) {
  const dateKeys: string[] = [];
  const windowSize = Math.max(1, Math.round(windowDays));
  let cursor = todayDateKey;

  for (let index = 0; index < windowSize; index += 1) {
    dateKeys.push(cursor);
    cursor = getPreviousDateKey(cursor);
  }

  return dateKeys;
}

export function canUseSkipGrace({
  graceRule,
  priorSkipCount,
}: {
  graceRule?: GraceRule;
  priorSkipCount: number;
}) {
  const allowance = Math.max(0, Math.round(graceRule?.allowance ?? 0));

  if (allowance <= 0) {
    return false;
  }

  return priorSkipCount < allowance;
}

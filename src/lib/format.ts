export function formatManwon(v: number) {
  const rounded = Math.round(v);
  if (rounded >= 10000) {
    const eok = Math.floor(rounded / 10000);
    const rest = rounded % 10000;
    return rest ? `${eok}억 ${rest.toLocaleString()}만원` : `${eok}억원`;
  }
  return `${rounded.toLocaleString()}만원`;
}

/** 적금 만기 예상 수령액(세전, 단리, 만원) */
export function estimateMaturity(monthly: number, termMonths: number, rate: number) {
  const principal = monthly * termMonths;
  const interest = monthly * (rate / 100 / 12) * ((termMonths * (termMonths + 1)) / 2);
  return { principal, interest, total: principal + interest };
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  return `${y}.${m}.${d}`;
}

export function daysLeft(iso: string | null | undefined, today = new Date()) {
  if (!iso) return null;
  const end = new Date(`${iso}T23:59:59+09:00`);
  return Math.ceil((end.getTime() - today.getTime()) / 86_400_000);
}

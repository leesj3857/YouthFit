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

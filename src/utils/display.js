export const STATES = {
  aprobado: { label: 'Aprobado', cls: 'aprobado' },
  publicado: { label: 'Publicado', cls: 'publicado' },
  revision: { label: 'En revisión', cls: 'revision' },
  borrador: { label: 'Borrador', cls: 'borrador' },
  vencido: { label: 'Vencido', cls: 'vencido' },
  archivado: { label: 'Archivado', cls: 'archivado' },
};

export function fmtDate(s) {
  if (!s || s === '-') return '-';
  const [y, m, d] = String(s).split('-');
  if (!y || !m || !d) return s;
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${d} ${months[parseInt(m, 10) - 1] || m} ${y}`;
}

export function fmtDateTime(value) {
  if (!value) return 'Sin registros';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

// Lógica pura (sin Firebase ni pantalla): estados, colores, fechas y avances.

/** Estados de un vano, en el orden del trabajo. */
export const ESTADOS = [
  { id: 'Pendiente Certificacion', corto: 'Pendiente', grupo: 'pendiente', color: '#8A9690', fondo: '#FFFFFF' },
  { id: 'Poda Preventiva', corto: 'Preventiva', grupo: 'podado', color: '#2E7D32', fondo: '#E8F3E9' },
  { id: 'Poda Cerca', corto: 'Cerca', grupo: 'podado', color: '#B7791F', fondo: '#FFF4D6' },
  { id: 'Poda Muy Cerca', corto: 'Muy cerca', grupo: 'podado', color: '#C62828', fondo: '#FDE8E7' },
  { id: 'Poda en Altura', corto: 'En altura', grupo: 'podado', color: '#6A1B9A', fondo: '#F3E8F8' },
  { id: 'Restos de Poda', corto: 'Restos', grupo: 'restos', color: '#C2410C', fondo: '#FFEDE3' },
  { id: 'Certificado', corto: 'Certificado', grupo: 'certificado', color: '#1D4ED8', fondo: '#E3ECFD' }
];
export const PENDIENTE = ESTADOS[0].id;
export const CERTIFICADO = 'Certificado';
const POR_ID = Object.fromEntries(ESTADOS.map(e => [e.id, e]));

export function infoEstado(id) {
  return POR_ID[id] || POR_ID[PENDIENTE];
}

/** Filtros de la vista de tramo. */
export const FILTROS = [
  { id: 'todos', texto: 'Todos', pasa: () => true },
  { id: 'pendiente', texto: 'Pendientes', pasa: v => infoEstado(v.estado).grupo === 'pendiente' },
  { id: 'podado', texto: 'Podados', pasa: v => infoEstado(v.estado).grupo === 'podado' },
  { id: 'restos', texto: 'Restos', pasa: v => infoEstado(v.estado).grupo === 'restos' },
  { id: 'certificado', texto: 'Certificados', pasa: v => infoEstado(v.estado).grupo === 'certificado' }
];

/** Vanos activos de un tramo, en el orden de la Hoja 1. */
export function vanosDeTramo(tramo) {
  return Object.entries((tramo && tramo.vanos) || {})
    .filter(([, v]) => v && v.activo !== false)
    .map(([clave, v]) => ({ clave, ...v }))
    .sort((a, b) => (a.o || 0) - (b.o || 0));
}

/** Cantidad de vanos por estado y avance de certificación. */
export function avanceTramo(tramo) {
  const vanos = vanosDeTramo(tramo);
  const porEstado = Object.fromEntries(ESTADOS.map(e => [e.id, 0]));
  let ultima = '';
  for (const v of vanos) {
    porEstado[infoEstado(v.estado).id]++;
    if (v.fecha && v.fecha > ultima) ultima = v.fecha;
  }
  const total = vanos.length;
  const cert = porEstado[CERTIFICADO];
  return { total, porEstado, cert, pct: total ? Math.round(cert / total * 100) : 0, ultima };
}

export function sumarAvances(avances) {
  const porEstado = Object.fromEntries(ESTADOS.map(e => [e.id, 0]));
  let total = 0, ultima = '';
  for (const a of avances) {
    total += a.total;
    for (const e of ESTADOS) porEstado[e.id] += a.porEstado[e.id];
    if (a.ultima > ultima) ultima = a.ultima;
  }
  const cert = porEstado[CERTIFICADO];
  return { total, porEstado, cert, pct: total ? Math.round(cert / total * 100) : 0, ultima };
}

/** Agrupa los tramos por zona, ordenados por número de tramo. */
export function zonasDe(tramos) {
  const zonas = {};
  for (const t of tramos) {
    (zonas[t.zona] = zonas[t.zona] || []).push(t);
  }
  return Object.keys(zonas).sort((a, b) => a.localeCompare(b, 'es')).map(nombre => ({
    nombre,
    id: idZona(nombre),
    tramos: zonas[nombre].sort((a, b) => (a.tramo || 0) - (b.tramo || 0))
  }));
}

export function idZona(nombre) {
  return String(nombre || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Texto para buscar sin importar acentos ni mayúsculas. */
export function normalizar(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Fecha local de Argentina como 'AAAA-MM-DD'. */
export function hoyISO(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(d);
}

/** 'AAAA-MM-DD' -> 'DD/MM/AAAA' */
export function fechaAR(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-');
  return d && m && y ? `${d}/${m}/${y}` : String(iso);
}

/** Teléfono para un enlace tel: (deja solo dígitos y +). */
export function telefono(t) {
  return String(t || '').replace(/[^\d+]/g, '');
}

// Interfaz de la app de certificación de poda (celular y PC).
import * as db from './db.js';
import {
  ESTADOS, FILTROS, CERTIFICADO, infoEstado, vanosDeTramo, avanceTramo, sumarAvances,
  zonasDe, normalizar, fechaAR, telefono
} from './logica.js';
import { VERSION_APP } from './config.js';

// ---------------- Estado y utilidades ----------------

const S = {
  user: null, perfil: null,
  tramos: {}, lista: [], meta: { desdeCache: true, pendientes: false }, cargado: false, errorDatos: null,
  lineas: {},
  subs: [],
  busqueda: '', filtro: 'todos', seleccion: new Set(), hoja: null, confirmar: null,
  instalar: null
};
const app = document.getElementById('app');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const esSup = () => S.perfil && S.perfil.rol === 'supervisor';
const puedeUsar = () => S.perfil && S.perfil.activo !== false && ['inspector', 'supervisor'].includes(S.perfil.rol);

function limpiarSubs() { S.subs.forEach(u => { try { u(); } catch (_) { /* nada */ } }); S.subs = []; }

function toast(msg, tipo = 'info') {
  const t = document.createElement('div');
  t.className = `toast toast-${tipo}`;
  t.setAttribute('role', 'status');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('fuera'), 3200);
  setTimeout(() => t.remove(), 3700);
}

function render(html) { app.innerHTML = html; }

function conservarScroll(fn) {
  const m = app.querySelector('.scroll');
  const top = m ? m.scrollTop : 0;
  fn();
  const m2 = app.querySelector('.scroll');
  if (m2) m2.scrollTop = top;
}

const icono = {
  volver: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  salir: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>',
  sinSenal: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8a15 15 0 0 0-9.6-3.6M5 12.6a10 10 0 0 1 3-1.8M19 12.6a10 10 0 0 0-4.3-2.2M8.5 16.4a5 5 0 0 1 7 0M12 20h.01M3 3l18 18"/></svg>',
  llave: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3L21 2M17 6l3 3M14 9l2 2"/></svg>',
  doc: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg>',
  tel: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>',
  ok: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>',
  buscar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>'
};

// ---------------- Avisos ----------------

function avisoConexion() {
  const pend = S.meta.pendientes;
  if (!navigator.onLine) {
    return `<div class="aviso aviso-ambar" role="status">${icono.sinSenal}<div><strong>Sin señal</strong><span>${pend ? 'Hay cambios guardados en el equipo. ' : ''}Los cambios se guardan y se envían solos al volver la conexión, con la app abierta.</span></div></div>`;
  }
  if (pend) {
    return `<div class="aviso aviso-ambar" role="status">${icono.sinSenal}<div><strong>Enviando cambios…</strong><span>Mantené la app abierta hasta que termine.</span></div></div>`;
  }
  return '';
}

function avisoInstalar() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (standalone || window.innerWidth > 900) return '';
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (ios) {
    return `<div class="aviso aviso-azul"><div><strong>Instalá la app en el iPhone</strong><span>En Safari tocá Compartir y después "Agregar a pantalla de inicio". Instalada funciona sin señal y no pierde los datos.</span></div></div>`;
  }
  if (S.instalar) {
    return `<div class="aviso aviso-azul"><div><strong>Instalá la app</strong><span>Así funciona sin señal y se abre desde la pantalla de inicio.</span></div><button class="btn btn-chico" data-accion="instalar">Instalar</button></div>`;
  }
  return '';
}

function refrescarAvisos() {
  const el = app.querySelector('[data-avisos]');
  if (el) el.innerHTML = avisoConexion() + avisoInstalar();
}

// ---------------- Router ----------------

function ruta() {
  const [a, b] = location.hash.replace(/^#\/?/, '').split('/');
  return { a: a || '', b: b ? decodeURIComponent(b) : '' };
}

function navegar(h) { if (location.hash !== h) location.hash = h; else enrutar(); }

function enrutar() {
  S.hoja = null; S.confirmar = null;
  if (!S.user) return vistaLogin();
  if (!S.perfil || !puedeUsar()) return vistaSinPermiso();
  const r = ruta();
  if (r.a === 't' && r.b) {
    if (S.tramoAbierto !== r.b) { S.tramoAbierto = r.b; S.seleccion = new Set(); S.filtro = 'todos'; }
    return vistaTramo();
  }
  S.tramoAbierto = null;
  return vistaInicio();
}

function repintar() {
  const r = ruta();
  if (!S.user || !puedeUsar()) return;
  if (r.a === 't') conservarScroll(vistaTramo);
  else pintarListaInicio();
}

window.addEventListener('hashchange', enrutar);
window.addEventListener('online', refrescarAvisos);
window.addEventListener('offline', refrescarAvisos);

// ---------------- Vistas: acceso ----------------

function vistaCargando(msg = 'Cargando…') {
  render(`<div class="centro"><div class="spinner" aria-hidden="true"></div><p>${esc(msg)}</p></div>`);
}

function vistaLogin(error = '') {
  render(`
  <div class="login">
    <div class="login-marca"><span class="marca-chica">EPEC · Redes de Alta Tensión</span><h1>Certificación de poda</h1></div>
    <form class="tarjeta login-form" data-form="login" novalidate>
      <label>Usuario<input name="usuario" autocomplete="username" autocapitalize="none" spellcheck="false" required placeholder="ej.: perez.j"></label>
      <label>Contraseña<input name="clave" type="password" autocomplete="current-password" required></label>
      ${error ? `<p class="error" role="alert">${esc(error)}</p>` : ''}
      <button class="btn btn-primario btn-grande" type="submit">Ingresar</button>
      <p class="nota">La primera vez necesitás señal para ingresar. Después la app funciona sin conexión.</p>
    </form>
    <p class="version">v${VERSION_APP}</p>
  </div>`);
}

function vistaSinPermiso() {
  const inactivo = S.perfil && S.perfil.activo === false;
  const deCuadrilla = S.perfil && S.perfil.rol && !['inspector', 'supervisor'].includes(S.perfil.rol);
  render(`
  <div class="centro">
    <h1>${inactivo ? 'Usuario desactivado' : 'Usuario sin permisos'}</h1>
    <p>${inactivo ? 'Tu usuario fue desactivado.' : deCuadrilla
      ? 'Este usuario es de la app de cuadrillas. Para certificar poda necesitás un usuario de inspector.'
      : 'Tu usuario no tiene el rol de inspector de poda.'} Pedile al supervisor que lo revise.</p>
    <button class="btn" data-accion="salir">${icono.salir} Salir</button>
  </div>`);
}

function encabezado({ titulo, sub = '', volver = '', extra = '' }) {
  return `
  <header class="barra">
    ${volver ? `<a class="btn-icono" href="${volver}" aria-label="Volver">${icono.volver}</a>` : ''}
    <div class="barra-titulo">${sub ? `<span class="barra-sub">${esc(sub)}</span>` : ''}<strong>${esc(titulo)}</strong></div>
    ${extra}
  </header>`;
}

/** Barra de avance con un tramo de color por estado. */
function barraEstados(av) {
  if (!av.total) return '<div class="avance"></div>';
  return `<div class="avance" aria-hidden="true">${ESTADOS.filter(e => e.grupo !== 'pendiente')
    .map(e => `<span style="width:${av.porEstado[e.id] / av.total * 100}%;background:${e.color}"></span>`).join('')}</div>`;
}

// ---------------- Inicio: zonas y tramos ----------------

function vistaInicio() {
  const p = S.perfil;
  render(`
  <div class="pantalla ancha">
    ${encabezado({
      titulo: 'Certificación de poda',
      sub: `${p.nombre || p.usuario || ''} · ${esSup() ? 'Supervisor' : 'Inspector'}`,
      extra: `<button class="btn-icono" data-accion="salir" aria-label="Salir">${icono.salir}</button>`
    })}
    <div data-avisos>${avisoConexion()}${avisoInstalar()}</div>
    <div class="buscador">
      ${icono.buscar}
      <input type="search" data-buscar placeholder="Buscar línea o tramo" value="${esc(S.busqueda)}" aria-label="Buscar línea o tramo">
    </div>
    <main class="scroll contenido" data-lista></main>
  </div>`);
  pintarListaInicio();
}

function pintarListaInicio() {
  const cont = app.querySelector('[data-lista]');
  if (!cont) return;
  const m = app.querySelector('.scroll');
  const top = m ? m.scrollTop : 0;
  refrescarAvisos();

  if (S.errorDatos) {
    cont.innerHTML = `<div class="aviso aviso-rojo"><div><strong>No se pudieron cargar los tramos</strong><span>${esc(S.errorDatos)}</span></div><button class="btn btn-chico" data-accion="reiniciar">Reintentar</button></div>`;
    return;
  }
  if (!S.cargado) { cont.innerHTML = '<p class="nota">Cargando tramos…</p>'; return; }
  if (!S.lista.length) {
    cont.innerHTML = S.meta.desdeCache && !navigator.onLine
      ? '<div class="vacio"><strong>Todavía no hay datos en este equipo</strong><span>Abrí la app una vez con señal para descargar los tramos. Después funciona sin conexión.</span></div>'
      : '<div class="vacio"><strong>No hay tramos cargados</strong><span>Los tramos salen de la Hoja 1 de la planilla APP_Poda.</span></div>';
    return;
  }

  const q = normalizar(S.busqueda);
  const zonas = zonasDe(S.lista).map(z => ({
    ...z,
    tramos: z.tramos.filter(t => !q || normalizar(`${t.linea} tramo ${t.tramoTxt || t.tramo} ${t.zona}`).includes(q))
  })).filter(z => z.tramos.length);

  cont.innerHTML = `
    ${zonas.length ? '' : '<p class="nota">Ningún tramo coincide con la búsqueda.</p>'}
    ${zonas.map(z => {
      const avZ = sumarAvances(z.tramos.map(avanceTramo));
      return `
      <section class="grupo">
        <div class="fila-esp"><h2>${esc(z.nombre)} · ${z.tramos.length} tramo${z.tramos.length === 1 ? '' : 's'}</h2><span class="chico gris">${avZ.cert} de ${avZ.total} certificados · ${avZ.pct}%</span></div>
        ${barraEstados(avZ)}
        <div class="grilla-tramos">
          ${z.tramos.map(t => {
            const av = avanceTramo(t);
            return `
            <a class="tarjeta tarjeta-tramo" href="#/t/${encodeURIComponent(t.id)}">
              <div class="fila-esp"><span class="mono verde">Tramo ${esc(t.tramoTxt || t.tramo)}</span>
                ${t._pendiente ? '<span class="estado estado-pend">Sin enviar</span>' : av.total && av.cert === av.total ? '<span class="estado estado-cert">Certificado</span>' : ''}</div>
              <strong class="tarjeta-titulo">${esc(t.linea)}</strong>
              ${barraEstados(av)}
              <div class="fila-esp chico"><span>${av.cert} de ${av.total} certificados</span><span class="gris">${av.pct}%</span></div>
              ${av.ultima ? `<span class="chico gris">Último cambio ${fechaAR(av.ultima)}</span>` : ''}
            </a>`;
          }).join('')}
        </div>
      </section>`;
    }).join('')}
    <p class="version centrado">v${VERSION_APP}${S.meta.desdeCache && !navigator.onLine ? ' · datos guardados en el equipo' : ''}</p>`;
  const m2 = app.querySelector('.scroll');
  if (m2) m2.scrollTop = top;
}

// ---------------- Tramo ----------------

function tramoActual() { return S.tramos[S.tramoAbierto] || null; }

function vistaTramo() {
  const t = tramoActual();
  if (!t) {
    if (!S.cargado) return vistaCargando('Abriendo el tramo…');
    render(`<div class="centro"><h1>Tramo no encontrado</h1><p>Puede que se haya sacado de la Hoja 1.</p><a class="btn" href="#/">Volver</a></div>`);
    return;
  }
  const vanos = vanosDeTramo(t);
  const av = avanceTramo(t);
  const filtro = FILTROS.find(f => f.id === S.filtro) || FILTROS[0];
  const visibles = vanos.filter(filtro.pasa);
  // la selección solo puede tener vanos que existen
  for (const k of [...S.seleccion]) if (!t.vanos[k] || t.vanos[k].activo === false) S.seleccion.delete(k);
  const nSel = S.seleccion.size;
  const todosVisiblesElegidos = visibles.length && visibles.every(v => S.seleccion.has(v.clave));
  const empresas = [...new Set(vanos.map(v => v.empresa).filter(Boolean))];
  const linea = S.lineas['L' + t.lineaId];
  const privados = empresas.length ? empresas : ((linea && linea.privados) || []);

  render(`
  <div class="pantalla ancha">
    ${encabezado({
      titulo: t.linea,
      sub: `${t.zona} · Tramo ${t.tramoTxt || t.tramo}`,
      volver: '#/',
      extra: `<button class="btn-icono texto" data-accion="accesos">${icono.llave}<span class="solo-ancho">Accesos y OT</span></button>`
    })}
    <div data-avisos>${avisoConexion()}</div>
    <div class="resumen">
      <div class="fila-esp"><strong>${av.cert} de ${av.total} certificados · ${av.pct}%</strong>${privados.length ? `<span class="chico gris">Privado: ${esc(privados.join(', '))}</span>` : ''}</div>
      ${barraEstados(av)}
      <div class="leyenda">${ESTADOS.map(e => av.porEstado[e.id] ? `<span><i style="background:${e.color}"></i>${esc(e.corto)} ${av.porEstado[e.id]}</span>` : '').join('')}</div>
    </div>
    <nav class="filtros" aria-label="Filtro">
      ${FILTROS.map(f => {
        const n = vanos.filter(f.pasa).length;
        return `<button class="pill ${S.filtro === f.id ? 'activo' : ''}" data-accion="filtro" data-valor="${f.id}" aria-pressed="${S.filtro === f.id}">${f.texto} · ${n}</button>`;
      }).join('')}
    </nav>
    <div class="barra-seleccion">
      <span class="chico gris">Tocá los vanos para elegirlos</span>
      ${visibles.length ? `<button class="btn btn-chico btn-secundario" data-accion="${todosVisiblesElegidos ? 'ninguno' : 'todos'}">${todosVisiblesElegidos ? 'Quitar selección' : `Elegir los ${visibles.length}`}</button>` : ''}
    </div>
    <main class="scroll contenido">
      ${visibles.length ? '' : '<p class="nota">No hay vanos en este filtro.</p>'}
      <div class="grilla-vanos">
        ${visibles.map(v => {
          const e = infoEstado(v.estado);
          const sel = S.seleccion.has(v.clave);
          return `<button class="vano ${sel ? 'elegido' : ''} ${e.id === CERTIFICADO ? 'vano-cert' : ''}" style="--c:${e.color};--f:${e.fondo}" data-accion="elegir" data-clave="${esc(v.clave)}" aria-pressed="${sel}"
            aria-label="Vano ${esc(v.v)}, ${esc(e.id)}${v.fecha ? ', ' + fechaAR(v.fecha) : ''}">
            ${sel ? `<span class="tilde">${icono.ok}</span>` : ''}
            <strong>${esc(v.v)}</strong>
            <span class="vano-estado">${esc(e.corto)}</span>
            ${v.fecha ? `<span class="vano-fecha">${fechaAR(v.fecha).slice(0, 5)}</span>` : ''}
          </button>`;
        }).join('')}
      </div>
    </main>
    <footer class="pie">
      ${nSel
        ? `<div class="pie-texto"><strong>${nSel} vano${nSel === 1 ? '' : 's'} elegido${nSel === 1 ? '' : 's'}</strong><button class="enlace" data-accion="ninguno">Quitar selección</button></div>
           <button class="btn btn-primario" data-accion="hoja-estado">Cambiar estado</button>`
        : `<div class="pie-texto"><strong>${esc(t.linea)}</strong><span class="${t._pendiente ? 'ambar' : 'verde'}">${t._pendiente ? 'Cambios sin enviar · se envían al volver la señal' : (S.meta.desdeCache && !navigator.onLine ? 'Sin señal · nada pendiente' : 'Todo enviado')}</span></div>`}
    </footer>
    ${S.hoja === 'estado' ? hojaEstado(t) : ''}
    ${S.hoja === 'accesos' ? hojaAccesos(t, linea) : ''}
  </div>`);
}

function hojaEstado(t) {
  const claves = [...S.seleccion];
  const n = claves.length;
  if (!n) return '';
  if (S.confirmar) {
    const e = infoEstado(S.confirmar);
    return `
    <div class="velo" data-accion="cerrar-hoja">
      <div class="hoja" role="dialog" aria-modal="true" aria-label="Confirmar" data-accion="nada">
        <span class="etiqueta">Confirmar</span>
        <strong class="hoja-titulo">¿${e.id === CERTIFICADO ? 'Certificar' : `Pasar a ${esc(e.id)}`} ${n} vano${n === 1 ? '' : 's'}?</strong>
        <p class="gris">Queda con la fecha de hoy y a tu nombre. ${e.id === CERTIFICADO ? 'Hacelo solo después de verificar el trabajo en el campo.' : ''}</p>
        <button class="btn btn-primario btn-grande" data-accion="aplicar" data-valor="${esc(e.id)}">Sí, ${e.id === CERTIFICADO ? 'certificar' : 'cambiar'}</button>
        <button class="btn btn-secundario" data-accion="cancelar">Volver</button>
      </div>
    </div>`;
  }
  const uno = n === 1 ? t.vanos[claves[0]] : null;
  const actual = uno ? infoEstado(uno.estado) : null;
  return `
  <div class="velo" data-accion="cerrar-hoja">
    <div class="hoja" role="dialog" aria-modal="true" aria-label="Cambiar estado" data-accion="nada">
      <div>
        <span class="etiqueta">Cambiar estado</span>
        <strong class="hoja-titulo">${uno ? `Vano ${esc(uno.v)}` : `${n} vanos`}</strong>
      </div>
      ${uno ? `<p class="gris">Ahora: <strong style="color:${actual.color}">${esc(actual.id)}</strong>${uno.fecha ? ` desde el ${fechaAR(uno.fecha)}` : ''}${uno.porNombre ? ` · ${esc(uno.porNombre)}` : ''}</p>` : ''}
      <div class="opciones-estado">
        ${ESTADOS.map(e => `<button class="opcion-estado ${actual && actual.id === e.id ? 'actual' : ''} ${e.id === CERTIFICADO ? 'opcion-cert' : ''}" style="--c:${e.color};--f:${e.fondo}" data-accion="estado" data-valor="${esc(e.id)}">
          <i></i><span>${esc(e.id)}</span></button>`).join('')}
      </div>
      <button class="btn btn-secundario" data-accion="cerrar-hoja">Cancelar</button>
    </div>
  </div>`;
}

function hojaAccesos(t, linea) {
  const accesos = (linea && linea.accesos) || [];
  const tel = (nombre, num) => {
    const n = telefono(num);
    return n ? `<a class="btn btn-chico btn-secundario" href="tel:${esc(n)}">${icono.tel}${esc(nombre || 'Llamar')} · ${esc(num)}</a>` : (nombre ? `<span>${esc(nombre)}</span>` : '');
  };
  return `
  <div class="velo" data-accion="cerrar-hoja">
    <div class="hoja hoja-alta" role="dialog" aria-modal="true" aria-label="Accesos y OT" data-accion="nada">
      <div><span class="etiqueta">Accesos y OT</span><strong class="hoja-titulo">${esc(t.linea)}</strong></div>
      ${linea && linea.linkOT
        ? `<a class="btn btn-primario" href="${esc(linea.linkOT)}" target="_blank" rel="noopener">${icono.doc}Ver la OT${linea.textoLinkOT ? '' : ''}</a>${linea.textoLinkOT ? `<span class="chico gris">${esc(linea.textoLinkOT)}</span>` : ''}`
        : '<p class="nota">Esta línea no tiene link de OT cargado (columna H de Control de Tramos).</p>'}
      <h3 class="subtitulo">Accesos y contactos · ${accesos.length}</h3>
      ${accesos.length ? accesos.map(a => `
        <div class="acceso">
          <div class="fila-esp"><strong>${a.desde || a.hasta ? `Vanos ${esc(a.desde)}${a.hasta ? ' – ' + esc(a.hasta) : ''}` : 'Acceso'}</strong>${a.candado ? `<span class="estado">Candado ${esc(a.candado)}</span>` : ''}</div>
          ${a.campo ? `<span>Campo: ${esc(a.campo)}</span>` : ''}
          ${a.dueno || a.telDueno ? `<div class="fila-tel"><span class="chico gris">Dueño</span>${tel(a.dueno, a.telDueno)}</div>` : ''}
          ${a.encargado || a.telEncargado ? `<div class="fila-tel"><span class="chico gris">Encargado</span>${tel(a.encargado, a.telEncargado)}</div>` : ''}
          ${a.extra ? `<span class="chico">${esc(a.extra)}</span>` : ''}
          ${a.privado ? `<span class="chico gris">Privado: ${esc(a.privado)}</span>` : ''}
        </div>`).join('') : '<p class="nota">No hay accesos cargados para esta línea (hoja Accesos de APP_Poda).</p>'}
      <button class="btn btn-secundario" data-accion="cerrar-hoja">Cerrar</button>
    </div>
  </div>`;
}

// ---------------- Eventos ----------------

app.addEventListener('submit', async e => {
  const f = e.target.closest('form[data-form]');
  if (!f) return;
  e.preventDefault();
  if (f.dataset.form === 'login') {
    const d = Object.fromEntries(new FormData(f));
    if (!d.usuario || !d.clave) return vistaLogin('Completá usuario y contraseña.');
    const btn = f.querySelector('button'); btn.disabled = true; btn.textContent = 'Ingresando…';
    try {
      await db.ingresar(d.usuario, d.clave);
    } catch (err) {
      const c = err.code || '';
      vistaLogin(c.includes('network') ? 'Sin conexión. La primera vez necesitás señal para ingresar.'
        : c.includes('too-many') ? 'Demasiados intentos. Esperá unos minutos.'
        : 'Usuario o contraseña incorrectos.');
    }
  }
});

app.addEventListener('input', e => {
  if (e.target.matches('[data-buscar]')) { S.busqueda = e.target.value; pintarListaInicio(); }
});

app.addEventListener('click', async e => {
  const el = e.target.closest('[data-accion]');
  if (!el) return;
  const acc = el.dataset.accion;
  if (acc === 'nada') return;
  if (acc === 'cerrar-hoja') {
    if (el.classList.contains('velo') && e.target !== el) return;
    S.hoja = null; S.confirmar = null; conservarScroll(vistaTramo); return;
  }
  if (acc === 'salir') { limpiarSubs(); await db.salir(); location.hash = '#/'; return; }
  if (acc === 'reiniciar') { location.reload(); return; }
  if (acc === 'instalar' && S.instalar) { S.instalar.prompt(); S.instalar = null; refrescarAvisos(); return; }

  if (acc === 'filtro') { S.filtro = el.dataset.valor; conservarScroll(vistaTramo); return; }
  if (acc === 'elegir') {
    const k = el.dataset.clave;
    S.seleccion.has(k) ? S.seleccion.delete(k) : S.seleccion.add(k);
    conservarScroll(vistaTramo);
    return;
  }
  if (acc === 'todos') {
    const t = tramoActual(); const f = FILTROS.find(x => x.id === S.filtro) || FILTROS[0];
    vanosDeTramo(t).filter(f.pasa).forEach(v => S.seleccion.add(v.clave));
    conservarScroll(vistaTramo); return;
  }
  if (acc === 'ninguno') { S.seleccion = new Set(); conservarScroll(vistaTramo); return; }
  if (acc === 'hoja-estado') { S.hoja = 'estado'; S.confirmar = null; conservarScroll(vistaTramo); return; }
  if (acc === 'accesos') { S.hoja = 'accesos'; conservarScroll(vistaTramo); return; }
  if (acc === 'cancelar') { S.confirmar = null; conservarScroll(vistaTramo); return; }
  if (acc === 'estado') {
    const estado = el.dataset.valor;
    // Certificar, o cambiar muchos vanos juntos, pide confirmación
    if (estado === CERTIFICADO || S.seleccion.size > 1) { S.confirmar = estado; conservarScroll(vistaTramo); return; }
    return aplicar(estado);
  }
  if (acc === 'aplicar') return aplicar(el.dataset.valor);
});

function aplicar(estado) {
  const t = tramoActual();
  const claves = [...S.seleccion];
  if (!t || !claves.length) return;
  db.cambiarEstados(t, claves, estado, S.perfil)
    .catch(err => toast('No se pudo guardar: ' + (err.code === 'permission-denied' ? 'tu usuario no tiene permiso.' : err.message), 'error'));
  S.seleccion = new Set(); S.hoja = null; S.confirmar = null;
  toast(`${claves.length} vano${claves.length === 1 ? '' : 's'} · ${estado}`, 'ok');
  if (navigator.vibrate) navigator.vibrate(30);
  conservarScroll(vistaTramo);
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && S.hoja) { S.hoja = null; S.confirmar = null; conservarScroll(vistaTramo); }
});

// ---------------- Inicio de la app ----------------

function avisoReinicio(msg) {
  if (document.querySelector('.aviso-reinicio')) return;
  const d = document.createElement('div');
  d.className = 'aviso aviso-rojo aviso-reinicio';
  d.innerHTML = `<div><strong>Algo falló</strong><span>${esc(msg)}</span></div><button class="btn btn-chico" data-accion="reiniciar">Reintentar</button>`;
  d.querySelector('button').addEventListener('click', () => location.reload());
  document.body.appendChild(d);
}
window.addEventListener('unhandledrejection', e => avisoReinicio(e.reason && (e.reason.message || e.reason)));
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.instalar = e; refrescarAvisos(); });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(err => console.warn('SW', err)));
}

function escucharDatos() {
  limpiarSubs();
  S.cargado = false; S.errorDatos = null;
  S.subs.push(db.escucharTramos((tramos, meta) => {
    S.tramos = Object.fromEntries(tramos.map(t => [t.id, t]));
    S.lista = tramos;
    S.meta = meta;
    S.cargado = true; S.errorDatos = null;
    repintar();
  }, err => {
    console.error(err);
    S.errorDatos = err.code === 'permission-denied' ? 'Tu usuario no tiene permiso para ver los tramos.' : err.message;
    S.cargado = true;
    repintar();
  }));
  S.subs.push(db.escucharLineas(lineas => {
    S.lineas = lineas;
    if (ruta().a === 't' && S.hoja === 'accesos') conservarScroll(vistaTramo);
  }, err => console.warn('lineas', err)));
}

vistaCargando();
db.alCambiarSesion(async user => {
  S.user = user;
  if (!user) { limpiarSubs(); S.perfil = null; S.tramos = {}; S.lista = []; return enrutar(); }
  vistaCargando('Cargando tu usuario…');
  S.perfil = await db.obtenerPerfil(user);
  if (puedeUsar()) escucharDatos();
  enrutar();
});

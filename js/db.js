// Acceso a Firebase: autenticación y base de datos (Firestore) con modo sin conexión.
import { initializeApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, updatePassword
} from 'firebase/auth';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, getDoc, onSnapshot, collection, writeBatch, serverTimestamp
} from 'firebase/firestore';
import { firebaseConfig, CORREO_ADMIN, DOMINIO_USUARIOS } from './config.js';
import { hoyISO } from './logica.js';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

// ---------------- Autenticación ----------------

export function correoDeUsuario(usuario) {
  const u = String(usuario || '').trim().toLowerCase();
  return u.includes('@') ? u : `${u}@${DOMINIO_USUARIOS}`;
}

export function ingresar(usuario, clave) {
  return signInWithEmailAndPassword(auth, correoDeUsuario(usuario), clave);
}

export function salir() { return signOut(auth); }

export function alCambiarSesion(cb) { return onAuthStateChanged(auth, cb); }

export function cambiarMiClave(nueva) { return updatePassword(auth.currentUser, nueva); }

/** Perfil del usuario: rol (inspector / supervisor), nombre. */
export async function obtenerPerfil(user) {
  let datos = null;
  try {
    const snap = await getDoc(doc(db, 'usuarios', user.uid));
    if (snap.exists()) datos = snap.data();
  } catch (e) {
    console.warn('No se pudo leer el perfil', e);
  }
  const esAdmin = (user.email || '').toLowerCase() === CORREO_ADMIN;
  if (!datos && esAdmin) datos = { nombre: 'Supervisor', usuario: user.email, rol: 'supervisor', activo: true };
  if (!datos) return null;
  if (esAdmin) datos.rol = 'supervisor';
  return { uid: user.uid, email: user.email, ...datos };
}

// ---------------- Datos de poda ----------------

/**
 * Todos los tramos (38 documentos, unos 600 KB). Se escuchan completos para que la app
 * tenga todo guardado en el teléfono y funcione sin señal en cualquier tramo.
 * cb(tramos, { desdeCache, pendientes })
 */
export function escucharTramos(cb, onError) {
  return onSnapshot(collection(db, 'poda_tramos'), { includeMetadataChanges: true }, s => {
    cb(s.docs.map(d => ({ id: d.id, ...d.data(), _pendiente: d.metadata.hasPendingWrites })), {
      desdeCache: s.metadata.fromCache,
      pendientes: s.metadata.hasPendingWrites
    });
  }, onError);
}

/** Líneas: accesos, link de la OT y empresas privadas. */
export function escucharLineas(cb, onError) {
  return onSnapshot(collection(db, 'lineas'), s => {
    cb(Object.fromEntries(s.docs.map(d => [d.id, { id: d.id, ...d.data() }])));
  }, onError);
}

/**
 * Cambia el estado de varios vanos de un tramo.
 * No se espera la respuesta del servidor: sin señal queda en cola y se envía sola.
 * Cada cambio queda además en el historial.
 */
export function cambiarEstados(tramo, claves, estado, perfil) {
  const fecha = hoyISO();
  const ref = doc(db, 'poda_tramos', tramo.id);
  const cambios = { actualizado: serverTimestamp() };
  const historial = [];
  for (const k of claves) {
    const v = (tramo.vanos || {})[k];
    if (!v) continue;
    cambios[`vanos.${k}.estado`] = estado;
    cambios[`vanos.${k}.fecha`] = fecha;
    cambios[`vanos.${k}.por`] = perfil.uid;
    cambios[`vanos.${k}.porNombre`] = perfil.nombre || '';
    cambios[`vanos.${k}.ts`] = serverTimestamp();
    historial.push({
      tramoId: tramo.id, zona: tramo.zona || '', tramo: tramo.tramo || 0, linea: tramo.linea || '',
      lineaId: tramo.lineaId || '', clave: k, vano: v.v || '', de: v.estado || '', a: estado,
      fecha, por: perfil.uid, porNombre: perfil.nombre || '', ts: serverTimestamp()
    });
  }
  const lotes = [];
  let b = writeBatch(db);
  b.update(ref, cambios);
  let n = 1;
  for (const h of historial) {
    if (n >= 450) { lotes.push(b); b = writeBatch(db); n = 0; }
    b.set(doc(collection(db, 'poda_historial')), h);
    n++;
  }
  lotes.push(b);
  return Promise.all(lotes.map(l => l.commit()));
}

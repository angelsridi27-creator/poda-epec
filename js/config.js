// Configuración del proyecto de Firebase (no es secreta: identifica el proyecto).
// Es el mismo proyecto que la app de cuadrillas: comparten usuarios y base de datos.
export const firebaseConfig = {
  apiKey: 'AIzaSyBGU7LNm1I36GN_vjzOmEHO6yVB1oClMFo',
  authDomain: 'ot-cuadrillas.firebaseapp.com',
  projectId: 'ot-cuadrillas',
  storageBucket: 'ot-cuadrillas.firebasestorage.app',
  messagingSenderId: '936584539568',
  appId: '1:936584539568:web:5f8a5ec142f97629bd3a75'
};

// Cuenta que siempre tiene permisos de supervisor (debe coincidir con firestore.rules).
export const CORREO_ADMIN = 'angelsridi27@gmail.com';

// Los usuarios entran con un usuario corto; internamente se usa usuario@DOMINIO.
export const DOMINIO_USUARIOS = 'cuadrillas.app';

export const VERSION_APP = '1.0.0';

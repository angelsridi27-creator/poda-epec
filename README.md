# Poda · Certificación (EPEC)

App para que los inspectores de EPEC certifiquen la poda que hacen las empresas privadas, vano por vano. Funciona en el celular y en la PC, también sin señal. Usa la misma base de datos y los mismos usuarios que la app de cuadrillas (Firebase `ot-cuadrillas`).

Los vanos salen de la Hoja 1 de la planilla **APP_Poda**: el script `SincronizarPoda` los copia a la app cada 15 minutos y devuelve a la planilla los estados que se cargan acá.

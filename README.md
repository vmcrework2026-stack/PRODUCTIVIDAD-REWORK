# Productividad por Mesa · Retrabajo

Página web para capturar la productividad del área de retrabajo (almacén, mesa, turno, marca, tipo de retrabajo, piezas y personas), con dashboard dinámico e historial consultable.

- **Página:** `index.html` + `config.js`. Es estática, se publica gratis con GitHub Pages.
- **Base de datos:** una hoja de Google Sheets. Un Apps Script (`apps-script/Code.gs`) la expone como servicio web.

```
index.html        la aplicación completa (captura, dashboard, historial)
config.js         único archivo que se edita: URL del Apps Script y claves
apps-script/
  Code.gs         servicio que guarda y consulta en Google Sheets
```

Sin configurar nada, la página abre en **modo demostración** con datos de ejemplo y no guarda.

## 1. Google Sheets + Apps Script

1. Crea una hoja nueva en Google Sheets (por ejemplo "Productividad Retrabajo").
2. Menú **Extensiones → Apps Script**. Borra el contenido y pega todo `apps-script/Code.gs`. Guarda.
3. En **Configuración del proyecto (engrane) → Propiedades del script**, agrega:
   - `ADMIN_KEY`: clave que se pedirá en el historial para eliminar capturas. Sin esta propiedad nadie puede eliminar.
   - `WRITE_KEY` (opcional): clave para guardar capturas. Si la pones, debe ser igual a `WRITE_KEY` en `config.js`.
4. **Implementar → Nueva implementación → Aplicación web**:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier persona**
5. Autoriza los permisos que pide Google y copia la **URL de la aplicación web** (termina en `/exec`).

Las hojas `Capturas` y `Catalogos` se crean solas en la primera captura. Cada fila de `Capturas` es una mesa de un turno.

## 2. Configurar la página

Edita `config.js`:

```js
window.APP_CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/XXXX/exec',
  WRITE_KEY: '',          // la misma que en el script, si la usas
  SHEET_URL: 'https://docs.google.com/spreadsheets/d/XXXX'   // muestra el enlace "Abrir hoja"
};
```

## 3. Publicar en GitHub Pages

1. Crea un repositorio en GitHub y sube estos archivos (en la raíz: `index.html`, `config.js`, `apps-script/`, `README.md`).
2. **Settings → Pages → Build and deployment**: Source **Deploy from a branch**, rama `main`, carpeta `/ (root)`.
3. Tu página queda en `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`. Comparte ese enlace con los capturistas.

## Cómo funciona

- Al guardar, se reemplazan las filas de esa fecha, turno y almacén. C4 y C5 se guardan por separado, así que dos equipos no se pisan.
- Las mesas sin piezas no se guardan. Una captura ya guardada no se borra desde la pantalla de captura; se elimina desde el historial (vista "Por captura") con la clave de administrador.
- El dashboard y el historial se actualizan solos cada 30 segundos.
- El dashboard compara contra el periodo anterior de la misma duración. Piezas por persona se calcula como piezas totales entre personas totales, no como promedio de promedios.

## Seguridad

Cualquiera con el enlace de la página puede capturar, y `WRITE_KEY` en `config.js` es visible para quien abra el código. Sirve para frenar bots, no para controlar usuarios. Para restringir quién captura, haz el repositorio privado con GitHub Pages en un plan que lo permita, o ponlo detrás de un acceso con cuentas.

## Actualizar el Apps Script

Si cambias `Code.gs`: **Implementar → Administrar implementaciones → editar → Versión nueva → Implementar**. La URL no cambia.

## Límites de Google

Apps Script permite unas 20 000 llamadas por día en cuentas gratuitas y una hoja admite hasta 10 millones de celdas. Con 12 mesas por turno y 3 turnos por día, el uso normal queda muy por debajo.

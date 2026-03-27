# Hojas de Seguridad

Aplicacion web local-first para almacenamiento, consulta publica y alertas de vencimiento de hojas de seguridad en PDF.

## Funcionalidades

- Consulta publica sin login desde la pantalla inicial.
- Login administrativo para carga de PDF y gestion de usuarios.
- Carga individual o masiva de hojas de seguridad en formato PDF con fecha del documento.
- Almacenamiento local en IndexedDB para uso sin internet.
- Vencimiento calculado automaticamente a 5 anos desde la fecha del documento.
- Alertas visuales y notificaciones del navegador para hojas vencidas o proximas a vencer.
- Roles `admin` y `uploader`.

## Credenciales iniciales

- Usuario: `admin`
- Contrasena: `Admin123!`

## Consideraciones del modo offline

- Los archivos PDF, los usuarios y la sesion se guardan localmente en el navegador del equipo donde se use la app.
- Si se cambia de navegador o se borra el almacenamiento del navegador, la informacion no se comparte ni se conserva fuera de ese equipo.
- La autenticacion es local, pensada para operacion sin servidor. Si despues se requiere multiusuario real entre varios equipos, conviene migrar a un backend centralizado.

## Desarrollo

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
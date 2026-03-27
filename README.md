# Hojas de Seguridad

Aplicacion web local-first para almacenamiento, consulta publica y alertas de vencimiento de hojas de seguridad en PDF.

Puede trabajar en dos modos:

- `Solo local` (sin configuracion adicional): datos por navegador/equipo.
- `Centralizado` (con Supabase): datos compartidos entre PC y celular.

## Funcionalidades

- Consulta publica sin login desde la pantalla inicial.
- Login administrativo para carga de PDF y gestion de usuarios.
- Carga individual o masiva de hojas de seguridad en formato PDF con fecha del documento.
- Almacenamiento local en IndexedDB para uso sin internet.
- Vencimiento calculado automaticamente a 5 anos desde la fecha del documento.
- Alertas visuales y notificaciones del navegador para hojas vencidas o proximas a vencer.
- Sincronizacion opcional con Supabase para compartir hojas y usuarios entre dispositivos.
- Roles `admin` y `uploader`.

## Credenciales iniciales

- Usuario: `admin`
- Contrasena: `Admin123!`

## Consideraciones del modo offline

- Los archivos PDF, los usuarios y la sesion se guardan localmente en el navegador del equipo donde se use la app.
- Si se cambia de navegador o se borra el almacenamiento del navegador, la informacion no se comparte ni se conserva fuera de ese equipo.
- La autenticacion es local, pensada para operacion sin servidor. Si despues se requiere multiusuario real entre varios equipos, conviene migrar a un backend centralizado.

## Activar modo centralizado (Supabase)

1. Cree un proyecto en Supabase.
2. En SQL Editor ejecute este esquema:

```sql
create table if not exists public.hds_users (
	id text primary key,
	full_name text not null,
	username text not null unique,
	password_hash text not null,
	role text not null check (role in ('admin', 'uploader')),
	created_at timestamptz not null
);

create table if not exists public.hds_sheets (
	id text primary key,
	product_name text not null,
	manufacturer text not null,
	area text not null,
	notes text not null,
	document_date date not null,
	expiration_date date not null,
	upload_date timestamptz not null,
	uploaded_by_id text not null,
	uploaded_by_name text not null,
	file_name text not null,
	pdf_base64 text not null,
	pdf_mime text not null,
	pdf_size bigint not null,
	created_at timestamptz not null,
	updated_at timestamptz not null
);
```

3. Cree un archivo `.env.local` basado en `.env.example`:

```bash
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY
```

4. Ejecute la app (`npm run dev`) y valide que en la interfaz aparece `Datos: Sincronizados en nube`.

Notas:

- Si no define estas variables, la app sigue en modo local.
- El primer inicio en modo centralizado crea el admin inicial `admin / Admin123!` si la tabla de usuarios esta vacia.
- Los PDF se guardan en la tabla como base64 para simplificar despliegue en frontend estatico.

## Desarrollo

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
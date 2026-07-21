# Directorio Familiar

Aplicación web privada para reemplazar una libreta física de contactos y datos administrativos. Organiza personas, empresas, documentos, teléfonos, correos, direcciones, notas y credenciales de plataformas.

## Funciones

- Acceso restringido a cuatro cuentas familiares.
- Contraseñas temporales con cambio obligatorio en el primer ingreso.
- Contactos y empresas con búsqueda por nombre, razón social, documento, NIT, correo o teléfono.
- Múltiples teléfonos, correos, direcciones y categorías por registro.
- Credenciales cifradas individualmente con AES-256-GCM.
- Revelado temporal de contraseñas, copia con limpieza del portapapeles y auditoría.
- Importación masiva mediante CSV UTF-8 separado por punto y coma.
- Exportación CSV que excluye contraseñas.
- Respaldo completo cifrado con una clave elegida por el usuario.
- Historial de creación, edición, archivo, revelado, importación y exportación.
- Diseño responsive basado en azul petróleo y dorado.

## Arquitectura

- Next.js 16 App Router y React 19.
- Neon Serverless Postgres.
- Vercel para despliegue y variables protegidas.
- `bcrypt` para las contraseñas de usuarios.
- AES-256-GCM para las credenciales de terceros.
- Cookies `HttpOnly`, `Secure`, `SameSite=Strict` y sesiones revocables guardadas como hash.
- Zod para validación del lado del servidor.

El repositorio puede ser público porque no contiene datos del directorio ni secretos. Los datos viven en Neon y las claves se configuran como variables protegidas de Vercel.

## Desarrollo local

1. Copia `.env.example` como `.env.local`.
2. Define `DATABASE_URL` con la conexión pooled de Neon.
3. Genera una clave aleatoria de 32 bytes, codificada en Base64, para `VAULT_ENCRYPTION_KEY`.
4. Ejecuta la migración `db/migrations/001_initial.sql` en Neon.
5. Instala y arranca:

```bash
npm install
npm run db:seed
npm run dev
```

Nunca confirmes `.env.local` ni el archivo de accesos temporales en Git.

## Formato de importación

La plantilla está disponible dentro de la aplicación y en `public/plantilla-importacion.csv`.

Reglas principales:

- Archivo CSV UTF-8 separado por `;`.
- `tipo`: `persona` o `empresa`.
- `nombre_mostrar`: obligatorio.
- `registro_id`: agrupa varias filas del mismo contacto; sirve para agregar varias credenciales.
- `categorias`: nombres separados con `|`.
- `nit`, `numero_documento` y `correo` se usan para omitir duplicados.
- `contrasena_plataforma` puede venir en texto plano durante la importación y se cifra inmediatamente; el CSV debe eliminarse después.
- Máximo 5 MB y 3.000 filas por archivo.

## Verificación

```bash
npm run lint
npm test
npm run build
npm audit --audit-level=moderate
```


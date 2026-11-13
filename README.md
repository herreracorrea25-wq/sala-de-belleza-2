# Salón de Belleza Esther

Aplicación web para que clientes registren y administren sus citas, y para que estilistas consulten su agenda, gestionen clientes y actualicen horarios.

## Estructura del proyecto

```text
sala de belleza/
├── backend/
│   ├── scripts/
│   │   └── verificar-api.js       # Comprobación de endpoints de solo lectura
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js        # Conexión con MongoDB e inicialización
│   │   ├── models/                # Esquemas de MongoDB
│   │   ├── app.js                 # Configuración de Express y rutas de la API
│   │   └── server.js              # Carga de configuración e inicio del servidor
│   ├── .env                       # Configuración local; no se comparte
│   ├── package.json
│   └── package-lock.json
├── frontend/
│   ├── public/                    # Recursos públicos
│   ├── src/
│   │   ├── config/                # URL de la API y catálogo de servicios
│   │   ├── router/                # Rutas y control de acceso por rol
│   │   ├── stores/                # Estado global con Pinia
│   │   ├── views/                 # Pantallas de la aplicación
│   │   ├── App.vue
│   │   ├── main.js                # Punto de entrada de Vue y Quasar
│   │   └── style.css
│   ├── package.json
│   └── package-lock.json
└── README.md
```

`frontend/src/assets/` y `frontend/src/components/` no se incluyen porque los recursos de ejemplo no se utilizaban y todavía no hay componentes reutilizables independientes. `node_modules/` y `dist/` son carpetas generadas localmente, no código fuente para organizar o subir al repositorio. Los `assets/` que Vite crea dentro de `dist/` sí contienen el CSS, JavaScript y fuentes necesarios para la versión compilada. El archivo raíz `.gitignore` evita incluir las carpetas generadas y los secretos locales.

## Tecnologías

- **Frontend:** Vue 3, Vite, Vue Router, Pinia y Quasar.
- **Backend:** Node.js, Express, Mongoose y MongoDB Atlas.
- **Autenticación:** JSON Web Tokens y contraseñas protegidas con `bcryptjs`.

El estilista puede consultar y gestionar su agenda y clientes; el cliente puede solicitar y revisar sus citas. Las rutas del frontend restringen el acceso por rol y la API valida autenticación, disponibilidad y datos de las citas.

Desde **Mi cuenta**, clientes y estilistas pueden actualizar sus datos y cambiar su contraseña. Los clientes también pueden consultar, cancelar o proponer cambios para sus citas. Los estilistas pueden crear cuentas de clientes con contraseña inicial, editar sus datos y agregar servicios; cada estilista puede ofrecer varios servicios desde su perfil.

## Preparación local

Se necesita Node.js y una base MongoDB accesible. La conexión y los secretos se configuran en `backend/.env` (no copiar credenciales a este README ni subirlas a Git). El backend utiliza `MONGO_URI`, `JWT_SECRET`, `STYLIST_INVITE_CODE` y opcionalmente `PORT`; el frontend permite configurar `VITE_API_URL`.

El registro de estilistas requiere que la persona administradora comparta el valor privado de `STYLIST_INVITE_CODE`. Sin esta variable configurada en el servidor, no se permiten nuevos registros de estilistas. Los clientes pueden crear su propia cuenta; las cuentas creadas por un estilista también requieren una contraseña inicial.

### 1. Instalar dependencias

En una terminal de PowerShell, desde la carpeta principal del proyecto:

```powershell
cd backend
npm install
cd ..\frontend
npm install
```

### 2. Iniciar el backend

En una terminal:

```powershell
cd backend
npm run dev
```

El servidor usa el puerto `4000` por defecto y requiere que `MONGO_URI` apunte a una base accesible. La conexión a MongoDB Atlas depende de que el clúster permita la IP de la máquina.

### 3. Iniciar el frontend

En otra terminal:

```powershell
cd frontend
npm run dev
```

Vite muestra en la terminal la dirección local para abrir la aplicación. El frontend usa la URL configurada por `VITE_API_URL` o, si no se define, el backend de producción configurado por la aplicación.

### 4. Compilar y verificar

Para validar la compilación del frontend:

```powershell
cd frontend
npm run build
```

Con el backend encendido y la base de datos conectada, la comprobación de API no crea cuentas ni citas:

```powershell
cd backend
npm run check:api
```

## Carpetas importantes

- `backend/src/app.js`: configura Express y contiene los endpoints HTTP.
- `backend/src/server.js`: inicia el backend después de cargar la configuración y conectar la base.
- `backend/src/config/database.js`: conecta MongoDB e inserta estilistas de ejemplo si la colección está vacía.
- `backend/src/models/`: esquemas de usuarios, clientes, estilistas y citas.
- `backend/scripts/`: verificaciones auxiliares que no forman parte del servidor de producción.
- `frontend/src/views/`: pantallas de login, agenda, reserva, clientes, servicios e información.
- `frontend/src/router/`: navegación y protección de rutas.
- `frontend/src/stores/`: sesión y datos compartidos.

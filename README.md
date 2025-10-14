# api-booking
Cloud 2025/2 - Booking Microservice

Docker Image: leom1509/booking-microservice

### Booking Microservice – README (Docker Compose & creación de boletos)

Este README explica **cómo levantar el servicio con Docker Compose** usando un archivo `.env`, y **qué estructura JSON** debes enviar para **crear un nuevo boleto** en `POST /bookings`.

---

### Requisitos
- Docker y Docker Compose instalados.
- Conectividad desde esta EC2 hacia la EC2 de MongoDB (puerto 27017 permitido en Security Group/NACL).
- Archivo `.env` junto al `docker-compose.yml`.

---

### Archivo `.env` (ejemplo)
```dotenv
# Si la API está en otra EC2 del mismo SG, usa la IP privada del Mongo
MONGODB_URI=mongodb://172.31.28.90:27017/
DB_NAME=bookingsdb
PORT=3000
```

---

### Levantar con Docker Compose
```bash
# Construir e iniciar en segundo plano
docker compose up -d

# Ver estado de los servicios
docker compose ps

# Ver logs de la API
docker compose logs -f booking

# Probar health
curl -i http://<IP_O_DOMINIO>:3000/health
```
> Asegúrate de que la app escuche en `0.0.0.0` y que el puerto `3000` esté abierto.

---

### Endpoints principales
- `GET    /health` — Verifica conexión a la DB (`{ ok: true }` si todo OK).
- `GET    /bookings` — Lista (con filtros y paginación).
- `POST   /bookings` — **Crea un boleto** (estructura abajo).
- `GET    /bookings/:id` — Obtiene un boleto por `_id`.
- `PATCH  /bookings/:id` — Actualiza **campos mutables**.
- `PUT    /bookings/:id` — Reemplazo **solo** de campos mutables.
- `DELETE /bookings/:id` — Elimina un boleto.

> Si usaste un prefijo en tu app (ej. `app.use('/api', router)`), antepón `/api` a todas las rutas.

---

### Estructura JSON para **crear un boleto** (`POST /bookings`)
**Campos requeridos:**
- `_id` *(string)*: identificador único del boleto.
- `showtime_id` *(string)*: función/horario.
- `movie_id` *(string)*: película.
- `status` *(string, **MAYÚSCULAS**)*: uno de `PENDING`, `CONFIRMED`, `CANCELLED`, `REFUNDED`.
- `price_total` *(number)*: total cobrado.
- `currency` *(string)*: p. ej. `PEN`, `USD`.

**Campos opcionales/recomendados:**
- `cinema_id` *(string)*
- `sala_id` *(string)*
- `sala_number` *(number)*
- `seats` *(array de objetos)*, cada elemento:
  - `seat_row` *(string)*, ej. `"A"`.
  - `seat_number` *(number)*, ej. `10`.
- `user` *(objeto)*:
  - `user_id` *(string)*, `name` *(string)*, `email` *(string)*
- `payment_method` *(string o null)*: **minúsculas** en el enum `card | cash | yape | plin | stripe | null`
- `source` *(string o null)*: **minúsculas** en el enum `web | mobile | kiosk | partner | null`
- `created_at` *(Date o string ISO)*: si se omite, el servidor completa con la hora actual.

---

### Reglas de validación importantes
- `status` **en MAYÚSCULAS** (`CONFIRMED`, `CANCELLED`, `PENDING`, `REFUNDED`).
- `payment_method` y `source` **en minúsculas**, respetando los enums anteriores.
- **Anti doble-venta**: índice único parcial evita `CONFIRMED` duplicados para **el mismo** `showtime_id` **y el mismo** asiento (`seat_row` + `seat_number`). Si intentas confirmar un duplicado → **409 Conflict**.
- **Campos inmutables** en PUT/PATCH: `_id`, `showtime_id`, `movie_id`, `cinema_id`, `sala_id`, `sala_number`, `created_at`.

---

### Ejemplos `curl`
**Health**
```bash
curl -i http://<IP_O_DOMINIO>:3000/health
```

**Crear boleto (POST /bookings)**
```bash
curl -i -X POST http://<IP_O_DOMINIO>:3000/bookings   -H "Content-Type: application/json"   -d '{
    "_id":"b-001",
    "showtime_id":"s-100",
    "movie_id":"m-100",
    "cinema_id":"c-200",
    "sala_id":"room-7",
    "sala_number":7,
    "seats":[
      {"seat_row":"A","seat_number":10},
      {"seat_row":"A","seat_number":11}
    ],
    "user":{"user_id":"u-123","name":"Luciana","email":"l@x.com"},
    "payment_method":"yape",
    "source":"web",
    "status":"CONFIRMED",
    "price_total":32.5,
    "currency":"PEN"
  }'
```

**Obtener por id**
```bash
curl -s http://<IP_O_DOMINIO>:3000/bookings/b-001
```

**Actualizar parcialmente (PATCH)**
```bash
curl -i -X PATCH http://<IP_O_DOMINIO>:3000/bookings/b-001   -H "Content-Type: application/json"   -d '{"status":"CANCELLED","payment_method":"card"}'
```

**Eliminar**
```bash
curl -i -X DELETE http://<IP_O_DOMINIO>:3000/bookings/b-001
```

---

### Filtros y paginación en `GET /bookings`
Parámetros soportados:
- `limit` *(1–200, por defecto 50)*
- `page` *(>=1, por defecto 1)*
- Filtros: `movie_id`, `cinema_id`, `showtime_id`, `user_id`, `status`, `source`, `payment_method`, `email`
- Rango de fechas: `date_from=YYYY-MM-DD`, `date_to=YYYY-MM-DD`
- Orden: `sort` (por defecto `-created_at_dt`)

**Ejemplo:**
```bash
curl -s "http://<IP_O_DOMINIO>:3000/bookings?status=CONFIRMED&limit=10&page=1&sort=-created_at_dt"
```

---

### Errores comunes
- **400 `Document failed validation`**: revisa `status` (MAYÚSCULAS), `payment_method/source` (minúsculas y en enum), tipos numéricos y `created_at`.
- **409 `duplicate key`**: `_id` duplicado o intento de confirmar un asiento/función ya confirmado.
- **500 en `/health`**: API arriba pero sin conexión a MongoDB (ver `MONGODB_URI`, conectividad y reglas de red).

---

### Notas de implementación
- La API usa `PORT` del `.env` (3000 por defecto).
- Expón el puerto con `- "3000:3000"` en Compose.
- `created_at` se recomienda guardarlo como `Date`. Si envías string ISO, el backend lo normaliza.
- Si activas materialización (`bookings_mat`), los listados pueden salir de esa colección/vista para lecturas rápidas.

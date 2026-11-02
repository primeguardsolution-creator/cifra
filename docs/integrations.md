# Integraciones de CIFRA (webhooks y API)

Se configuran en **Business → Perfil y equipo → Integraciones** (solo propietario y administradores).

## Webhooks de salida

CIFRA hace un `POST` JSON a tu URL (https) cuando ocurre un evento al que te suscribiste. Hay reintentos con espera creciente (1 min, 5 min, 30 min, 2 h, 12 h; 6 intentos). Responde con un código 2xx para confirmar.

| Evento | Cuándo |
| --- | --- |
| `message.received` | Un cliente escribe en un chat del negocio (no las respuestas del equipo ni las notas internas) |
| `conversation.created` | Un cliente abre un chat nuevo con el negocio |
| `customer.created` | Entra un cliente en el CRM (a mano, por chat o por la API) |
| `customer.stage_changed` | Un cliente cambia de etapa (`from`, `to`) |
| `appointment.created` | Se crea una cita |
| `appointment.updated` | Cambia el estado o la hora de una cita |
| `test.ping` | El botón «Probar» |

Cuerpo:

```json
{ "id": "…", "event": "customer.created", "created_at": "2026-11-11T10:00:00Z", "business_id": "…",
  "data": { "customer": { "id": "…", "name": "Ana", "phone": "+34…", "email": null, "stage": "lead", "tags": ["web"], "value_minor": null } } }
```

Cabeceras: `X-Cifra-Event`, `X-Cifra-Delivery` (id único, úsalo para no procesar dos veces), `X-Cifra-Timestamp`, `X-Cifra-Signature`.

### Verificar la firma

`X-Cifra-Signature = "sha256=" + HMAC_SHA256(secreto, timestamp + "." + cuerpo_en_bruto)`. Rechaza avisos con más de 5 minutos de antigüedad.

```js
import { createHmac, timingSafeEqual } from 'node:crypto';
const ok = (secret, ts, raw, sig) => {
  const mine = 'sha256=' + createHmac('sha256', secret).update(`${ts}.${raw}`).digest('hex');
  return Math.abs(Date.now() / 1000 - Number(ts)) < 300 && mine.length === sig.length && timingSafeEqual(Buffer.from(mine), Buffer.from(sig));
};
```

```python
import hmac, hashlib, time
def ok(secret, ts, raw, sig):
    mine = "sha256=" + hmac.new(secret.encode(), f"{ts}.{raw}".encode(), hashlib.sha256).hexdigest()
    return abs(time.time() - int(ts)) < 300 and hmac.compare_digest(mine, sig)
```

Por seguridad, CIFRA solo llama a URLs https que resuelvan a direcciones públicas (nunca a redes privadas, `localhost` ni metadatos de la nube) y no sigue redirecciones. El aviso llega, como mucho, un minuto después del evento.

## API de entrada

Crea una clave en la misma pantalla (se muestra una vez). Úsala así:

```
Authorization: Bearer cifra_…
```

Límite: 60 peticiones por minuto y clave. Errores: `401` clave inválida, `400` datos no válidos (`name_required`, `invalid_stage`, `title_required`, `customer_not_found`), `429` límite.

### `GET /api/v1/ping`
Devuelve `{ "ok": true, "business": "…" }`.

### `POST /api/v1/customers`
Crea o actualiza un cliente. Se busca primero por teléfono (ignora espacios y símbolos) y luego por correo. Al actualizar solo cambian los campos que envías, y las etiquetas se suman.

```bash
curl -X POST https://TU-SITIO/api/v1/customers \
  -H "Authorization: Bearer cifra_…" -H "Content-Type: application/json" \
  -d '{"name":"Ana Pérez","phone":"+34 600 123 456","email":"ana@ejemplo.com","stage":"lead","tags":["web"],"notes":"Pidió presupuesto","value":1250}'
```

Campos: `name` (obligatorio al crear), `phone`, `email`, `stage` (`lead`, `contacted`, `proposal`, `won`, `lost`), `tags`, `notes`, `value` (en euros) o `value_minor` (céntimos). Responde `201` si lo creó y `200` si lo actualizó: `{ "id", "created", "customer" }`.

### `POST /api/v1/tasks`
```bash
curl -X POST https://TU-SITIO/api/v1/tasks -H "Authorization: Bearer cifra_…" -H "Content-Type: application/json" \
  -d '{"title":"Llamar a Ana","customer_id":"…","due_at":"2026-11-15T10:00:00Z"}'
```

## Puesta en marcha (una vez)

1. Aplica la migración `20261111_000024_integrations.sql` en Supabase.
2. En Netlify (Functions) ya hacen falta `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SERVICE_ROLE_KEY`. No hay variables nuevas.
3. La función `webhooks-dispatch` se ejecuta sola cada minuto en producción.

## Pruebas

`npm run test:db` (base de datos) y `npm run test:integrations` (firma, protección de red y API).

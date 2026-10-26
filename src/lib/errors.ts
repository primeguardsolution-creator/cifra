import { tr } from '../i18n';

const known: [RegExp, string][] = [
  [/rate_limited/, 'Demasiados intentos seguidos. Espera un minuto e inténtalo de nuevo.'],
  [/user_not_found/, 'No encontramos a nadie con ese número en CIFRA.'],
  [/own_business/, 'Eres parte de este negocio; no puedes escribirle como cliente.'],
  [/business_not_found/, 'Ese negocio ya no está disponible.'],
  [/forbidden_role/, 'No tienes permiso para asignar ese rol.'],
  [/forbidden/, 'No tienes permiso para hacer eso.'],
  [/assignee_not_in_team/, 'Esa persona no forma parte del equipo.'],
  [/invalid_title/, 'Escribe un nombre para el grupo.'],
  [/businesses_handle_key|duplicate key.*handle/i, 'Ese identificador ya está en uso. Prueba con otro.'],
  [/username_reserved/, 'Ese nombre de usuario está reservado. Elige otro.'],
  [/profiles_username_key|duplicate key.*username/i, 'Ese nombre de usuario ya está en uso.'],
  [/profiles_phone|phone_exists|already registered|User already/i, 'Este número ya tiene una cuenta. Inicia sesión.'],
  [/Invalid login credentials/i, 'Número o contraseña incorrectos.'],
  [/Phone signups are disabled|phone_provider_disabled/i, 'El registro por teléfono aún no está activado en el servidor.'],
  [/Token has expired|otp_expired|invalid.*token|invalid_or_expired/i, 'El código no es válido o ha caducado.'],
  [/invalid_email/, 'Escribe un correo válido.'],
  [/mail_failed|not_configured/, 'No pudimos enviar el correo ahora. Inténtalo en unos minutos.'],
  [/update_failed/, 'No pudimos cambiar la contraseña. Inténtalo de nuevo.'],
  [/Failed to fetch|Network request failed|NetworkError|Load failed/i, 'Sin conexión. Revisa tu internet e inténtalo de nuevo.'],
  [/row-level security|permission denied/i, 'No tienes permiso para hacer eso.'],
  [/over_sms_send_rate_limit|too many/i, 'Demasiados intentos. Espera un momento.'],
  [/weak_password|Password should/i, 'Elige una contraseña más segura (mínimo 8 caracteres).'],
  [/payload too large|exceeded the maximum allowed size/i, 'El archivo es demasiado grande (máximo 25 MB).'],
  [/mime type .* is not supported/i, 'Ese tipo de archivo no está permitido.'],
];

export function friendly(e: unknown, fallback = 'Algo salió mal. Inténtalo de nuevo.'): string {
  const raw = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : typeof e === 'string' ? e : '';
  for (const [re, msg] of known) if (re.test(raw)) return tr(msg);
  return tr(fallback);
}

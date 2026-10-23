# CIFRA — Prompt maestro de producto y requisitos

## Propósito

Construir **CIFRA**, una aplicación móvil de mensajería con una experiencia clara, rápida y privada, preparada para uso personal y comercial. Debe conservar la identidad y las pantallas ya existentes de CIFRA, y evolucionar desde datos de demostración a un producto real, multiusuario y sincronizado.

El resultado debe permitir que muchas personas y empresas usen la misma aplicación al mismo tiempo, con cuentas independientes, datos privados por defecto y conversación real entre cuentas. La app no es una copia de WhatsApp: toma como referencia la fiabilidad esperada de una aplicación de mensajería moderna y aporta una experiencia CIFRA propia.

## Principios no negociables

- **Multiusuario real:** ningún dato de una cuenta puede mostrarse, editarse, buscarse o sincronizarse en otra sin una relación o permiso explícito.
- **Privacidad y seguridad desde el diseño:** mínimo privilegio, cifrado en tránsito, secretos fuera del cliente, registro de eventos sensibles y controles claros para la persona usuaria.
- **Móvil primero y multiplataforma:** iOS y Android como experiencias principales; web solo cuando tenga paridad funcional y de seguridad adecuada.
- **Sincronización confiable:** cambios, mensajes, lecturas y notificaciones deben llegar de forma consistente entre dispositivos y personas autorizadas.
- **Accesible e internacionalizable:** interfaz legible, navegación con lector de pantalla, contraste suficiente, zonas horarias y formatos regionales correctos. Español como idioma inicial.

## 1. Cuenta, registro y acceso

### Registro

- Crear una cuenta con teléfono verificado, correo electrónico verificado o ambos; el producto debe poder configurar qué métodos se habilitan por mercado.
- Pedir solo los datos necesarios: nombre visible, identificador/usuario opcional, fecha de nacimiento si es legalmente necesaria, país y aceptación de términos y privacidad versionados.
- Validar el teléfono mediante código de un solo uso y el correo mediante enlace o código de un solo uso. Incluir límites de reintentos, expiración, protección frente a enumeración de cuentas y prevención de abuso.
- Permitir elegir foto, nombre y privacidad del perfil durante el alta, pero nunca bloquear el acceso por no completar información opcional.
- Mostrar una aceptación explícita para comunicaciones de producto/marketing separada de los términos del servicio.

### Inicio de sesión y sesiones persistentes

- Iniciar sesión con los métodos registrados y una segunda verificación cuando el riesgo lo requiera. Permitir biometría/PIN local como desbloqueo del dispositivo, sin sustituir la autenticación del servidor.
- Mantener la sesión de forma persistente y segura entre aperturas de la app. Usar tokens de corta duración, renovación rotativa, almacenamiento seguro del sistema operativo y revocación en servidor.
- Listar sesiones y dispositivos activos (nombre/modelo aproximado, plataforma, fecha de última actividad y ubicación aproximada si está disponible con consentimiento). Permitir cerrar una sesión concreta o todas las demás.
- Invalidar y pedir acceso de nuevo ante cierre voluntario, contraseña/credencial cambiada, revocación, detección de riesgo o pérdida de un dispositivo.
- Aplicar protección frente a fuerza bruta, CAPTCHA/desafío adaptativo cuando corresponda, rate limiting, registro de accesos y alertas de inicios de sesión inusuales.

### Recuperación y seguridad de cuenta

- Recuperar el acceso mediante teléfono/correo ya verificados, con comprobaciones de riesgo y plazos de seguridad antes de cambios críticos.
- Ofrecer métodos adicionales de recuperación: códigos de respaldo de un solo uso y contacto/administrador de recuperación para una organización, siempre configurables y revocables.
- Permitir actualizar teléfono, correo, credenciales y autenticación en dos pasos; confirmar cambios sensibles desde el canal anterior cuando sea posible.
- Incluir pantalla de seguridad con estado de verificación, dispositivos, códigos de respaldo, alertas y opción de eliminación/exportación de cuenta conforme a la política aplicable.

## 2. Perfil y preferencias personales

- El perfil editable incluye avatar, nombre, nombre de usuario/handle, biografía, pronombres opcionales, zona horaria, idioma, estado y enlaces permitidos.
- Definir quién puede ver cada atributo: todos, contactos, solo yo o una audiencia personalizada cuando aplique. La visibilidad por defecto debe ser conservadora.
- Configurar privacidad de última vez/en línea, confirmaciones de lectura, foto, estado, grupos, llamadas, invitaciones y descubrimiento por teléfono/correo.
- Permitir bloquear, desbloquear, silenciar y denunciar cuentas; el bloqueo debe impedir nuevos contactos, mensajes y llamadas en ambas direcciones según la política definida.
- Las preferencias de apariencia, accesibilidad y notificaciones se guardan por cuenta y se sincronizan con reglas claras por dispositivo.

## 3. Aislamiento de datos, permisos y modelo de seguridad

- Cada entidad persistida debe tener un propietario o espacio/organización explícita (`user_id`, `workspace_id` o equivalente) y todas las consultas deben filtrar por el ámbito autorizado en servidor. Nunca confiar en un identificador recibido desde la interfaz para conceder acceso.
- Usar controles de acceso en el backend (por ejemplo, políticas por fila/tenant), pruebas automatizadas de aislamiento y revisión de permisos para toda API, archivo y canal en tiempo real.
- Separar datos personales, empresariales, mensajes, archivos, índices de búsqueda, analítica y copias de seguridad; aplicar retención y borrado por tipo de dato.
- Cifrar datos en tránsito con TLS moderno y datos sensibles en reposo. Guardar credenciales, claves y tokens exclusivamente en servicios de secretos o almacenamiento seguro; no incluirlos en repositorios ni compilaciones cliente.
- Firmar y validar cargas de archivos, comprobar tipo/tamaño, analizar contenido malicioso y utilizar URLs de acceso con caducidad y autorización.
- Mantener auditoría inmutable de acciones de administración y seguridad: cambios de roles, acceso a conversaciones compartidas, exportaciones, integraciones, cierres de sesión y modificaciones de perfil empresarial.

## 4. Contactos y descubrimiento

- Crear contactos manualmente, por invitación, importación opcional y directorio empresarial autorizado. Solicitar permisos del sistema solo al activar la importación de agenda.
- La comparación de agenda debe minimizar exposición: normalizar y proteger identificadores, no cargar libreta completa sin consentimiento y explicar qué se comparte.
- Mostrar solicitudes/aceptación de contacto cuando el modelo de privacidad lo requiera. Permitir eliminar, bloquear, etiquetar, añadir notas privadas y marcar favoritos.
- Buscar por nombre, nombre de usuario o datos empresariales públicos, respetando las reglas de visibilidad y evitando enumeración masiva de cuentas.
- Sincronizar contactos propios entre dispositivos sin hacer públicos los datos privados de la agenda.

## 5. Mensajería, llamadas y sincronización entre usuarios

### Conversaciones

- Soportar conversaciones uno a uno, grupos y canales/espacios empresariales. Cada conversación tiene miembros, roles, estado de pertenencia, configuración de notificaciones y reglas de retención.
- Enviar texto, reacciones, respuestas, menciones, archivos, fotos, vídeo, notas de voz, ubicación y enlaces con vista previa segura. Diseñar las funciones para degradar correctamente si un tipo de contenido no está disponible.
- Incluir edición y eliminación con indicadores transparentes, reenvío, destacados/guardados, búsqueda dentro de conversaciones y controles de mensajes temporales cuando se habiliten.
- Reflejar estados de envío, entrega y lectura con respeto a la configuración de privacidad. Manejar reintentos idempotentes, colas offline, orden de mensajes, duplicados y conflictos de edición.
- Permitir silenciar, archivar, fijar y administrar grupos (invitación, aprobación, expulsión, enlace de invitación y permisos de envío).

### Tiempo real y varios dispositivos

- Sincronizar mensajes, membresías, presencia autorizada, estados, lecturas y cambios de perfil mediante un canal en tiempo real autenticado, con recuperación de eventos perdidos al reconectar.
- El servidor es la fuente de verdad para autorización y secuenciación; el cliente mantiene caché local cifrada y una cola de operaciones segura para funcionamiento sin conexión.
- Resolver cambios concurrentes de forma predecible, conservar marcas de tiempo de servidor y nunca sustituir silenciosamente datos ajenos por datos locales.
- Asociar dispositivos a la cuenta con claves/credenciales propias; poder desvincularlos remotamente. No mezclar cachés, archivos ni notificaciones de perfiles distintos en un mismo dispositivo.

### Privacidad de comunicaciones

- Diseñar una arquitectura compatible con cifrado de extremo a extremo para conversaciones privadas y documentar con precisión qué contenidos lo usan. Las conversaciones de equipo con obligaciones de archivo pueden requerir un modelo distinto, explicado al usuario.
- No registrar contenido de mensajes en logs, analítica, notificaciones ni herramientas de soporte. Las notificaciones deben ocultar contenido en pantalla bloqueada según preferencia.
- Ofrecer denuncias de abuso con el mínimo contenido necesario y una explicación clara de qué se comparte para la revisión.

## 6. Notificaciones

- Implementar notificaciones push para mensajes, menciones, llamadas, tareas de equipo, alertas de seguridad y eventos empresariales configurables.
- Distinguir preferencias globales, por conversación/cliente y por dispositivo; incluir horario de silencio, prioridad, sonido, vista previa y agrupación.
- Al pulsar una notificación, abrir el elemento autorizado correcto sin filtrar información si la sesión está bloqueada, cerrada o pertenece a otra cuenta.
- Registrar entrega y errores técnicos sin almacenar el contenido del mensaje; tratar tokens push como datos sensibles y eliminarlos al cerrar sesión o revocar un dispositivo.

## 7. Capacidades Business

### Perfil comercial y presencia

- Una cuenta puede crear o pertenecer a una o varias organizaciones/negocios, sin mezclar sus datos con el perfil personal. Definir claramente cuándo se está operando como persona o como negocio.
- Perfil comercial editable: nombre legal y visible, categoría, descripción, logo/portada, teléfono, correo, web, dirección/área de servicio, moneda, idiomas, enlaces sociales, políticas y verificaciones aplicables.
- Configurar horario habitual, horarios especiales, festivos, ausencias y respuestas fuera de horario con zona horaria explícita.
- Gestionar catálogo: categorías, productos/servicios, variantes, precio, impuestos, disponibilidad, imágenes, enlaces de compra, condiciones y estado publicado/borrador. Validar archivos y permisos de edición.

### Equipo, roles y espacios compartidos

- Invitar miembros al negocio por correo, teléfono o enlace controlado; ver estado de invitación, expiración y revocación.
- Definir roles preconfigurados como propietario, administrador, supervisor, agente y solo lectura, con permisos granulares. El propietario no puede quedar sin control; acciones críticas requieren confirmación/auditoría.
- Los miembros usan su propia cuenta y conservan su perfil personal; el acceso al negocio es una asignación revocable, no una cuenta compartida.
- Permitir equipos, colas y etiquetas para asignación de conversaciones. Mantener historial de asignación y no exponer notas internas al cliente.

### Bandeja compartida y relación con clientes

- Proveer bandeja compartida con filtros por estado, responsable, equipo, etiqueta, canal, prioridad, SLA y fecha. Estados mínimos: nuevo, abierto, pendiente, resuelto y cerrado.
- Asignar, reasignar, reclamar, seguir y escalar conversaciones; prevenir colisiones mostrando presencia/edición de agentes y conservando historial de acciones.
- Separar mensajes externos, notas internas y automatizaciones. Las notas internas jamás deben salir al cliente ni aparecer en exportaciones destinadas a éste.
- Mantener ficha de cliente con datos permitidos, consentimiento, etiquetas, historial, pedidos/enlaces si se integran, notas privadas autorizadas y solicitudes de eliminación/exportación.

### Automatizaciones e integraciones

- Crear respuestas de bienvenida, ausencia, respuestas rápidas, enrutamiento, asignación por horario/etiqueta, reglas de prioridad y seguimiento, con activación/desactivación, simulación y registro de ejecución.
- Evitar bucles y envíos abusivos: límites, condiciones de parada, deduplicación, ventanas horarias y revisión humana cuando el riesgo sea alto.
- Exponer integraciones mediante OAuth/credenciales con alcance mínimo, rotación, revocación, webhooks firmados, reintentos idempotentes y panel de salud/auditoría.
- No permitir que automatizaciones o integraciones accedan a conversaciones, contactos o catálogos fuera del negocio y rol autorizados.

## 8. Datos, cumplimiento y operaciones

- Mostrar política de privacidad, términos, finalidad de tratamiento, consentimiento y controles de datos de forma comprensible. Adaptar el producto a la normativa aplicable en los mercados objetivo; validar requisitos legales antes del lanzamiento.
- Proporcionar exportación de datos, eliminación de cuenta, desvinculación de negocio y periodos de retención transparentes, incluyendo el efecto sobre mensajes, copias de seguridad y obligaciones empresariales.
- Implementar observabilidad segura: métricas técnicas, alertas, trazas con datos redactados, monitorización de errores y panel de estado. Prohibido incorporar contenido de mensajes o identificadores sensibles en errores sin protección.
- Diseñar copias de seguridad, recuperación ante desastres, migraciones reversibles y pruebas de restauración. Definir objetivos de recuperación y disponibilidad antes de producción.
- Separar entornos de desarrollo, pruebas y producción. Usar datos sintéticos en pruebas, revisiones de seguridad antes de cada versión y gestión de incidentes con comunicación a usuarios cuando corresponda.

## 9. Requisitos de experiencia y calidad

- Mantener y mejorar las pantallas actuales de CIFRA: inicio, bandeja, chat, espacios, llamadas, actualizaciones, perfil y ajustes. Reemplazar gradualmente cualquier dato simulado por los flujos autenticados reales.
- Mostrar estados de carga, vacío, conexión, error, reintento y permisos denegados con lenguaje claro. Ninguna acción debe aparentar éxito si el servidor no la confirmó.
- Permitir cerrar sesión, cambiar de cuenta de forma explícita y, si se admite multicuenta, aislar por completo caché, claves, preferencias y notificaciones de cada una.
- Medir rendimiento con objetivos definidos para arranque, apertura de conversaciones, envío offline/online y sincronización. Optimizar listas largas, archivos y consumo de batería/red.
- Cubrir flujos críticos con pruebas unitarias, integración, extremo a extremo y seguridad: registro, acceso, recuperación, revocación, aislamiento entre usuarios/negocios, permisos, mensajes, sincronización, notificaciones, roles y automatizaciones.

## 10. Criterios de aceptación para la primera versión operativa

1. Dos personas pueden registrarse, verificar su método de acceso, iniciar sesión en dispositivos distintos y mantener sesiones seguras persistentes.
2. Cada persona solo ve sus propios datos, contactos y conversaciones, salvo aquello que comparta o a lo que sea invitada; la prueba automatizada debe demostrarlo.
3. Ambas pueden encontrarse/invitarse conforme a la privacidad elegida, intercambiar mensajes y ver una sincronización confiable entre dispositivos.
4. Un perfil puede editarse y sus cambios se reflejan únicamente donde la visibilidad lo permite.
5. La recuperación y revocación de un dispositivo funcionan sin dejar sesiones inválidas activas.
6. Las notificaciones respetan sesión, dispositivo, conversación y preferencias de privacidad.
7. Una empresa puede crear su perfil, catálogo y horario; invitar un equipo con roles; atender una bandeja compartida y usar automatizaciones con registro de actividad.
8. Un agente solo puede actuar dentro de los negocios, conversaciones y permisos que tenga asignados; una nota interna nunca se entrega al cliente.
9. No existen secretos en el cliente ni datos de un tenant en respuestas, índices, cachés, archivos o registros de otro tenant.
10. Antes de publicar, se han probado los flujos de seguridad, errores, desconexión y recuperación definidos en este documento.

## 11. Fuera de alcance hasta su diseño específico

- Procesamiento de pagos, custodia de dinero, crédito, remesas o servicios financieros regulados. Si se añade pago, deberá tener un diseño legal, de seguridad, proveedor y cumplimiento independiente.
- Prometer cifrado de extremo a extremo o cumplimiento normativo sin una revisión criptográfica/legal verificable.
- Importar contactos, acceder a cámara/micrófono o enviar comunicaciones promocionales sin consentimiento explícito y revocable.

## Entregables esperados antes de implementar producción

- Arquitectura de identidad, autorización multi-tenant, datos, tiempo real, archivos, notificaciones y recuperación.
- Modelo de datos con propietarios/ámbitos, políticas de acceso y matriz de permisos por rol.
- Flujos y prototipos de registro, acceso, perfil, contactos, conversación, recuperación, dispositivo, negocio, catálogo, equipo y bandeja compartida.
- Plan de seguridad, privacidad, cumplimiento, pruebas, observabilidad, backups y despliegue.
- Migración de la aplicación CIFRA existente desde demostración a backend real, por fases y sin perder la experiencia ya diseñada.

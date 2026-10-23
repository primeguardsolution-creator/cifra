// Pure data (no React / RN imports) so the same file feeds the in-app matcher and the optional Claude function.
// Keep every answer truthful: this is what users read as "how CIFRA works".

export const BOT = {
  name: 'Maestro CIFRA',
  username: 'maestro',
  tagline: 'Asistente oficial · responde al instante',
  /** Usernames nobody can register, so no one can impersonate the assistant or the company. */
  reserved: ['maestro', 'cifra', 'soporte', 'ayuda', 'admin', 'oficial', 'support', 'help', 'official', 'botmaster', 'cifra_oficial'],
} as const;

export type ActionKind =
  | { go: string }                     // router path
  | { space: 'business' | 'personal' } // switch space, then optionally go
  | { share: 'invite' };               // open the share sheet with the invitation text

export type BotAction = { label: string; icon: string; do: ActionKind; then?: string };

export type Topic = {
  id: string;
  title: string;
  /** Normalised (lowercase, no accents) words and short phrases that signal this topic. Phrases weigh more. */
  keywords: string[];
  /** Markdown-lite: **bold**, `code`, "• " bullets, blank lines. */
  answer: string;
  actions?: BotAction[];
  /** Topic ids offered as follow-up chips. */
  next?: string[];
};

export const topics: Topic[] = [
  {
    id: 'start',
    title: 'Empezar a usar CIFRA',
    keywords: ['empezar', 'empiezo', 'empece', 'comenzar', 'primeros pasos', 'como funciona', 'que es cifra', 'para que sirve', 'tutorial', 'guia', 'novato', 'empiezo a usar', 'como se usa', 'instrucciones', 'mi mama no sabe', 'explicar a alguien', 'soy nuevo', 'acabo de instalar', 'que puedo hacer', 'funciones', 'para que se usa', 'como me muevo', 'como se maneja'],
    answer: '**CIFRA es mensajería con superpoderes**: chats, grupos, llamadas, estados y un espacio Business para tu negocio, todo en una app.\n\n**Primeros pasos**\n• Toca ✏️ arriba en *Chats* y busca a alguien por su **número** o por su **@usuario**.\n• Escribe el primer mensaje: solo vosotros dos lo veréis.\n• Pulsa 📞 o 📹 en la cabecera para llamar gratis por internet.\n• En *Ajustes* personalizas colores y fondos.\n\nSolo puedes chatear con quien ya tenga cuenta; si no la tiene, invítale.',
    actions: [{ label: 'Nuevo chat', icon: 'create-outline', do: { go: '/new-chat' } }, { label: 'Invitar a un amigo', icon: 'share-social', do: { share: 'invite' } }],
    next: ['newchat', 'calls', 'business'],
  },
  {
    id: 'register',
    title: 'Crear cuenta e iniciar sesión',
    keywords: ['registro', 'registrar', 'registrarme', 'crear cuenta', 'iniciar sesion', 'entrar', 'login', 'contrasena', 'password', 'olvide', 'cuenta duplicada', 'un numero una cuenta', 'otro telefono', 'cambiar de numero', 'dos cuentas', 'otra cuenta', 'cuenta nueva', 'poner mi numero', 'mi numero de telefono', 'codigo sms', 'verificar numero', 'verificacion'],
    answer: '**Tu número de teléfono es tu identidad**: solo puede existir **una cuenta por número**.\n\n• Para registrarte: elige tu país, escribe tu número, tu nombre y una contraseña de 8+ caracteres.\n• Para volver a entrar: número + contraseña.\n• Si el número ya existe, la app te lo dirá y tendrás que iniciar sesión en vez de registrarte.\n\n**Importante (beta):** de momento no enviamos SMS de verificación, así que el número no está comprobado. Elige una contraseña que no uses en otros sitios. Por ahora no hay recuperación de contraseña automática.',
    next: ['security', 'profile'],
  },
  {
    id: 'newchat',
    title: 'Chatear con alguien nuevo',
    keywords: ['nuevo chat', 'empezar chat', 'iniciar chat', 'escribir a alguien', 'buscar persona', 'buscar contacto', 'anadir contacto', 'agregar contacto', 'encontrar a alguien', 'por numero', 'por usuario', 'chatear', 'hablar con', 'hablo con', 'escribir a un amigo', 'contactar a alguien', 'agrego a', 'agregar a', 'anadir a mi', 'escribirle a', 'hablarle', 'como le escribo', 'buscar un negocio con arroba', 'buscar negocio por usuario', 'arroba de un negocio', 'encontrar un negocio'],
    answer: '**Para empezar un chat nuevo**\n1. En *Chats* toca el botón ✏️ (Nuevo chat).\n2. Elige **Por teléfono** (número completo con su país) o **Por @usuario**.\n3. Pulsa *Buscar* y luego *Chatear*.\n\nLa persona debe tener cuenta en CIFRA. Si no la tiene, te ofrecemos **invitarla** con un enlace. Quien ya chatea contigo se guarda en *Contactos* automáticamente.',
    actions: [{ label: 'Abrir Nuevo chat', icon: 'create-outline', do: { go: '/new-chat' } }, { label: 'Invitar a un amigo', icon: 'share-social', do: { share: 'invite' } }],
    next: ['username', 'groups', 'contacts'],
  },
  {
    id: 'username',
    title: '@usuario y número oculto',
    keywords: ['usuario', 'username', 'arroba', 'sin numero', 'ocultar numero', 'ocultar mi numero', 'privacidad numero', 'compartir sin telefono', 'mi nombre de usuario', 'descubrible', 'que me encuentren', 'no me encuentren', 'nadie vea mi telefono', 'que no vean mi numero', 'ocultar telefono', 'esconder numero', 'privacidad del numero', 'mi arroba', 'crear usuario', 'elegir usuario', 'poner usuario', 'identificador personal', 'arroba de mi negocio', 'identificador del negocio'],
    answer: '**Chatea sin dar tu teléfono.**\n\n• En *Ajustes → tu perfil* elige tu **@usuario** (3–32 caracteres, único en CIFRA) y compártelo: quien lo tenga te escribe sin ver tu número.\n• Activa **Ocultar mi número** (en tu perfil) y tu teléfono deja de verse en tu perfil, en los chats y en las búsquedas. Solo te encuentran por tu @usuario.\n• Desactiva **Descubrible por número** en *Ajustes → Privacidad* si no quieres que te encuentren buscando tu teléfono.\n\nTu número sigue siendo tu identidad para iniciar sesión; solo deja de mostrarse.',
    actions: [{ label: 'Editar mi perfil', icon: 'person', do: { go: '/profile' } }, { label: 'Ir a Privacidad', icon: 'shield-checkmark', do: { go: '/settings' } }],
    next: ['privacy', 'profile'],
  },
  {
    id: 'profile',
    title: 'Perfil, foto y nombre',
    keywords: ['perfil', 'foto de perfil', 'cambiar foto', 'avatar', 'cambiar nombre', 'mi nombre', 'bio', 'info', 'estado de perfil', 'editar perfil', 'subir foto', 'apodo', 'mi apodo', 'cambiar apodo', 'cambiar mi apodo', 'foto', 'poner foto', 'quitar foto', 'descripcion', 'frase', 'informacion personal'],
    answer: '**Editar tu perfil**\n1. *Ajustes → toca tu tarjeta* (foto y nombre).\n2. Cambia la **foto** (se ajusta a un cuadrado), tu **nombre**, tu **info** y tu **@usuario**.\n3. Pulsa *Guardar cambios*.\n\nLos demás ven tu foto y nombre en chats y llamadas. La info es el texto corto bajo tu nombre.',
    actions: [{ label: 'Editar mi perfil', icon: 'person', do: { go: '/profile' } }],
    next: ['username', 'customize'],
  },
  {
    id: 'messages',
    title: 'Responder, editar, borrar y reaccionar',
    keywords: ['responder', 'citar', 'editar mensaje', 'borrar mensaje', 'eliminar mensaje', 'reaccion', 'reaccionar', 'emoji', 'copiar', 'doble toque', 'corazon', 'deslizar', 'acciones del mensaje', 'me equivoque', 'mensaje equivocado', 'recuperar mensaje', 'mensaje borrado', 'deshacer', 'reenviar', 'reenvio', 'citar mensaje', 'tachado', 'que significa'],
    answer: '**Acciones sobre un mensaje** (mantén pulsado, o clic derecho en ordenador):\n• **Reaccionar** con 👍 ❤️ 😂 😮 😢 🙏 — o **doble toque** para dar ❤️.\n• **Responder**: desliza el mensaje hacia la derecha, o usa el menú.\n• **Copiar** el texto.\n• **Destacar** ⭐ para guardarlo.\n• **Editar** tus mensajes de texto (aparece *editado*).\n• **Eliminar para todos**: desaparece para ambos y queda «Mensaje eliminado».',
    next: ['starred', 'search'],
  },
  {
    id: 'media',
    title: 'Enviar fotos, vídeos y documentos',
    keywords: ['foto', 'fotos', 'video', 'videos', 'imagen', 'adjuntar', 'adjunto', 'archivo', 'archivos', 'documento', 'pdf', 'subir', 'tamano', 'galeria', 'enviar foto', 'camara', 'imagen', 'subir una imagen', 'mandar una foto', 'enviar una imagen', 'mandar un archivo', 'peso maximo', 'limite de archivos', 'cuanto pesa', 'excel', 'word', 'zip', 'gif', 'reproducir video'],
    answer: '**Para adjuntar**\n1. Toca el **+** junto a la caja de mensaje.\n2. Elige *Foto o vídeo*, *Documento* o (en el móvil) *Cámara*.\n3. Revisa la vista previa y pulsa enviar.\n\n• Tamaño máximo: **25 MB** por archivo.\n• Toca una foto para verla grande.\n• Los archivos se guardan privados: solo los participantes del chat pueden abrirlos.',
    next: ['voice', 'messages'],
  },
  {
    id: 'voice',
    title: 'Mensajes de voz',
    keywords: ['voz', 'mensaje de voz', 'nota de voz', 'audio', 'grabar', 'grabar el microfono', 'permiso de microfono', 'no me deja grabar', 'microfono', 'mandar audio', 'enviar audio', 'grabacion', 'nota de audio', 'mandar una nota', 'mandar un audio', 'audios', 'grabar mi voz', 'hablarle en vez de escribir', 'velocidad del audio', 'audio largo'],
    answer: '**Mensajes de voz**\n1. Con la caja vacía, toca el botón del **micrófono** 🎤.\n2. Habla: verás las ondas y el tiempo (máx. **5 minutos**).\n3. Envía con la flecha ↑, o descarta con la papelera.\n\nEl navegador te pedirá **permiso de micrófono** la primera vez; si lo denegaste, actívalo en los permisos del sitio. El receptor puede reproducirlo, pausarlo y cambiar la velocidad.',
    next: ['calls', 'media'],
  },
  {
    id: 'calls',
    title: 'Llamadas y videollamadas',
    keywords: ['llamada', 'llamadas', 'llamar', 'videollamada', 'video llamada', 'wifi', 'por internet', 'voip', 'telefonear', 'no suena', 'no suena la llamada', 'perdida', 'perdidas', 'devolver llamada', 'historial de llamadas', 'camara no', 'sin audio', 'no se oye', 'se cayo la llamada', 'se corta la llamada', 'no se escucha', 'no me escuchan', 'no me oyen', 'no oigo', 'sin sonido', 'no veo la camara', 'camara negra', 'timbre', 'no suena el telefono', 'no suena cuando me llaman', 'llaman', 'colgar', 'llamada de voz', 'hacer una llamada', 'telefonear gratis', 'llamar gratis', 'llamadas gratis', 'ring', 'audio entrecortado'],
    answer: '**Llamadas gratis por internet (WiFi o datos)**\n• Abre un chat y pulsa 📞 (voz) o 📹 (vídeo) en la cabecera. También desde *Contactos*.\n• En la pestaña **Llamadas** ves el historial, las **perdidas** y puedes *Devolver* la llamada.\n• Durante la llamada: silenciar el micrófono, apagar la cámara (en vídeo) y colgar.\n\n**Cosas que conviene saber**\n• La otra persona solo recibe el aviso de llamada si **tiene CIFRA abierta** (todavía no hay notificaciones push).\n• Da permiso de micrófono y cámara cuando el navegador lo pida.\n• Usamos un servidor de relevo (TURN) para conectar incluso detrás de redes difíciles.\n• Las llamadas son 1 a 1; aún no hay llamadas de grupo.',
    actions: [{ label: 'Ver mis llamadas', icon: 'call', do: { go: '/calls' } }],
    next: ['voice', 'troubleshoot'],
  },
  {
    id: 'groups',
    title: 'Grupos',
    keywords: ['grupo', 'grupos', 'crear grupo', 'participantes', 'salir del grupo', 'anadir al grupo', 'chat grupal', 'grupo de amigos', 'grupo familiar', 'administrador del grupo', 'quitar a alguien del grupo', 'cuantos participantes', 'nombre del grupo', 'cambiar nombre del grupo'],
    answer: '**Crear un grupo**\n1. *Chats → ✏️ → pestaña Grupo*.\n2. Escribe el **nombre** y marca a los participantes (tienen que estar en tus contactos).\n3. Pulsa *Crear grupo*.\n\nDentro del grupo se ve quién escribe cada mensaje. Para irte: abre el chat → menú ⋯ → *Salir del grupo*.',
    actions: [{ label: 'Crear un grupo', icon: 'people', do: { go: '/new-chat' } }],
    next: ['newchat', 'contacts'],
  },
  {
    id: 'statuses',
    title: 'Estados',
    keywords: ['estado', 'estados', 'historia', 'historias', 'story', 'stories', 'publicar estado', '24 horas', 'ver estado', 'subir estado', 'cuanto duran', 'duran las historias', 'mis estados', 'donde veo mis estados', 'dejar de ver estados', 'estado de texto', 'foto del dia'],
    answer: '**Estados** son textos, fotos o **vídeos** que **desaparecen a las 24 horas**.\n\n• Ve a la pestaña **Estados**: arriba está tu tarjeta; toca el **+** para publicar.\n• Debajo aparecen los estados recientes de tus contactos; tócalos para abrirlos.\n• Puedes publicar un **texto** sobre un fondo de color, una **foto** o un **vídeo** de hasta 90 segundos, con un pie si quieres.\n• En **Negocios** verás las publicaciones de los negocios con los que ya hablas, con botón para escribirles.',
    actions: [{ label: 'Abrir Estados', icon: 'aperture', do: { go: '/updates' } }],
    next: ['posts', 'privacy'],
  },
  {
    id: 'posts',
    title: 'Publicaciones del negocio (Business)',
    keywords: ['publicaciones', 'publicacion', 'publicar', 'publicar video', 'publicar en el negocio', 'novedades', 'feed', 'red social', 'escaparate', 'promocion', 'promociones', 'ofertas', 'anuncio', 'anunciar', 'video del negocio', 'videos del negocio', 'estados del negocio', 'estado de negocio', 'subir video', 'reel', 'reels', 'mostrar productos', 'dar a conocer', 'marketing', 'publicidad'],
    answer: '**Publicaciones**: el escaparate de tu negocio dentro de CIFRA.\n• En Business, ve a **Más → Publicaciones** (o *Publicaciones* en la barra lateral) y toca **Publicar**: texto sobre color, **foto** o **vídeo** de hasta 90 segundos, con un pie (precio, oferta, enlace…).\n• Cada publicación dura **7 días** y se ve en tu **perfil público** («Novedades») y en la pestaña **Estados** de todos los que ya te escriben, con botón **Escribir**.\n• Cualquiera del equipo puede publicar (menos el rol *solo lectura*); los gestores pueden borrar.\n\nIdeal para vídeos cortos de producto, ofertas y novedades: con un toque te escriben.',
    actions: [{ label: 'Publicar ahora', icon: 'aperture', do: { space: 'business' }, then: '/posts' }],
    next: ['bizprofile', 'statuses', 'catalog'],
  },
  {
    id: 'contacts',
    title: 'Contactos',
    keywords: ['contactos', 'agenda', 'lista de contactos', 'eliminar contacto', 'borrar contacto'],
    answer: '**Contactos**\n• Se guardan solos cuando empiezas un chat por número o @usuario.\n• Desde la pestaña **Contactos** puedes escribirles, **llamarles** 📞 o **videollamarles** 📹, y eliminarlos desde ⋯.\n• Para añadir a alguien: botón 👤+ → por **@usuario** (sin compartir números; también te sugiere cuentas que empiezan igual) o por número. En el buscador 🔍 también salen **personas** y **negocios** por su @.\n• Si te escribe alguien que **no tienes guardado**, el chat te ofrece **Añadir**, **Reportar** o **Bloquear**.',
    actions: [{ label: 'Abrir Contactos', icon: 'people', do: { go: '/contacts' } }],
    next: ['newchat', 'groups'],
  },
  {
    id: 'organize',
    title: 'Fijar, archivar, silenciar y marcar',
    keywords: ['fijar', 'fijo', 'fijarlo', 'fijado', 'fijados', 'pin', 'archivar', 'archivado', 'archivados', 'silenciar', 'silencio', 'mutear', 'notificaciones del chat', 'no leido', 'marcar como leido', 'ordenar chats', 'organizar', 'desordenado', 'ocultar chat', 'eliminar conversacion', 'borrar conversacion', 'borrar chat', 'eliminar chat', 'quitar un chat', 'limpiar mis chats', 'silenciar un grupo', 'silenciar un chat', 'cuantos chats puedo fijar', 'chats fijados', 'desfijar', 'chat archivado', 'ocultar conversacion'],
    answer: '**Organiza tu lista de chats** (mantén pulsado un chat, o clic derecho en ordenador):\n• **Fijar arriba** 📌 — hasta **5** chats.\n• **Archivar**: lo oculta de la lista; lo recuperas en el filtro **Archivados**.\n• **Eliminar un chat** completo todavía no se puede: usa *Archivar* para quitarlo de la vista (en grupos, *Salir del grupo*).\n• **Silenciar** 8 horas o para siempre.\n• **Marcar como no leído** para acordarte de contestar.\n\nTambién tienes filtros rápidos: *Todos*, *No leídos*, *Grupos*.',
    next: ['search', 'starred'],
  },
  {
    id: 'search',
    title: 'Buscar mensajes',
    keywords: ['buscar', 'busqueda', 'buscar mensaje', 'encontrar mensaje', 'buscar en todos', 'lupa', 'no encuentro un mensaje', 'historial', 'buscar un mensaje antiguo', 'mensaje viejo', 'donde esta aquel mensaje', 'buscar palabra', 'buscar texto', 'encontrar algo que me dijeron'],
    answer: '**Buscar en todos tus mensajes**\n• Toca la lupa 🔍 arriba en *Chats* y escribe una palabra: ves coincidencias de **todas tus conversaciones**, y al tocar una te lleva al mensaje exacto resaltado.\n• El cuadro de «Buscar en tus chats» filtra la lista por nombre, número o último mensaje.',
    actions: [{ label: 'Buscar mensajes', icon: 'search', do: { go: '/search' } }],
    next: ['starred', 'organize'],
  },
  {
    id: 'starred',
    title: 'Mensajes destacados',
    keywords: ['destacar', 'destacado', 'destacados', 'estrella', 'favorito', 'guardar mensaje', 'guardar un mensaje'],
    answer: '**Destacados ⭐**\n• Mantén pulsado un mensaje → *Destacar*.\n• Encuentras todos en *Ajustes → Mensajes destacados*; al tocar uno vas directo a su conversación.\n• Es privado: nadie sabe qué has destacado.',
    actions: [{ label: 'Ver destacados', icon: 'star', do: { go: '/starred' } }],
    next: ['search'],
  },
  {
    id: 'schedule',
    title: 'Programar mensajes',
    keywords: ['programar', 'programado', 'programados', 'agendar', 'enviar mas tarde', 'mas tarde', 'enviar despues', 'cumpleanos', 'felicitar', 'recordar', 'a una hora', 'manana', 'manana por la manana', 'a las 8', 'a las 9', 'a las 10', 'mandarle algo manana', 'dentro de una hora', 'esta noche', 'de madrugada', 'a medianoche', 'luego', 'despues', 'cuando no estoy', 'programar para'],
    answer: '**Mensajes programados ⏰**\n1. Escribe el mensaje (sin enviarlo).\n2. Toca el reloj 🕒 que aparece junto al texto.\n3. Elige *En 1 hora*, *Esta noche*, *Mañana por la mañana*, *El lunes* o una **fecha y hora a medida**.\n\nSe envía solo a su hora, **aunque tengas CIFRA cerrado** (lo hace el servidor). Verás un aviso «mensajes programados» sobre la caja de texto desde donde puedes cancelarlos. Solo texto, no archivos.',
    next: ['messages'],
  },
  {
    id: 'customize',
    title: 'Personalizar colores, fondos y modo oscuro',
    keywords: ['personalizar', 'color', 'colores', 'tema', 'oscuro', 'modo oscuro', 'claro', 'apariencia', 'diseno', 'cambiar el color', 'acento', 'bonito', 'que se vea mas oscuro', 'mas claro', 'otro color', 'cambiar el aspecto', 'estilo', 'temas de color', 'verde', 'morado', 'dark mode', 'tema oscuro', 'modo oscuro negro', 'oscuro de verdad', 'negro total'],
    answer: '**Hazlo tuyo (*Ajustes*)**\n• **Apariencia**: Auto, Claro u Oscuro (el oscuro es negro de verdad).\n• **Color de CIFRA**: 5 colores de acento que cambian botones, burbujas e iconos.\n• **Fondo de los chats**: 6 fondos distintos.\n\nSe guarda en tu dispositivo y se aplica al instante. (Personalizar está en el espacio Personal.)',
    actions: [{ label: 'Ir a Ajustes', icon: 'settings', do: { go: '/settings' } }],
    next: ['profile'],
  },
  {
    id: 'security',
    title: 'Bloqueo con PIN y seguridad de la cuenta',
    keywords: ['pin', 'bloqueo', 'bloquear la app', 'candado', 'seguridad', 'proteger', 'contrasena de la app', 'olvide el pin', 'huella', 'face id', 'privacidad de la app', 'me han hackeado', 'ocultar la app', 'ocultar mis chats', 'que nadie vea mis chats', 'que nadie entre', 'codigo para abrir', 'codigo de acceso', 'patron', 'bloqueo automatico', 'proteger mis chats'],
    answer: '**Bloqueo con PIN 🔒**\n• *Ajustes → Privacidad y avisos → Bloqueo con PIN* → crea un PIN de 6 dígitos.\n• CIFRA se bloquea tras **1 minuto** fuera de la app.\n• Disponible en la versión web/PWA; el PIN se guarda cifrado (PBKDF2) solo en tu dispositivo.\n\n**Si olvidas el PIN**, cierra sesión y vuelve a entrar con tu número y contraseña (tus mensajes siguen en tu cuenta).\n\nPara bloquear a una persona: abre su chat → ⋯ → *Bloquear contacto*.',
    actions: [{ label: 'Abrir Ajustes', icon: 'settings', do: { go: '/settings' } }],
    next: ['privacy', 'block'],
  },
  {
    id: 'block',
    title: 'Bloquear a alguien',
    keywords: ['bloquear', 'bloqueo a una persona', 'bloquear a una persona', 'bloquear a alguien', 'bloquear contacto', 'desbloquear', 'bloqueado', 'bloqueados', 'molesta', 'acoso', 'spam', 'no quiero que me escriba', 'denunciar', 'quien me bloqueo', 'me bloquearon', 'saber si me bloquearon', 'bloquear a un desconocido', 'molestando', 'insultos', 'denuncia', 'reportar usuario'],
    answer: '**Bloquear a una persona**\n• Abre el chat → ⋯ → *Bloquear contacto*. Ya no podréis escribiros.\n• Para deshacerlo: el mismo menú → *Desbloquear*, o en *Ajustes → Contactos bloqueados*.\n\nSi alguien te acosa, bloquéale y no compartas más datos. Aún no existe un botón de denuncia dentro de la app.',
    actions: [{ label: 'Contactos bloqueados', icon: 'ban', do: { go: '/settings' } }],
    next: ['security', 'username'],
  },
  {
    id: 'privacy',
    title: 'Privacidad y cifrado (con honestidad)',
    keywords: ['privacidad', 'cifrado', 'cifrada', 'encriptado', 'extremo a extremo', 'e2e', 'end to end', 'quien puede leer', 'seguro', 'es segura', 'datos', 'espiar', 'whatsapp cifrado', 'tus servidores', 'alguien de la empresa', 'pueden leer mis mensajes', 'leen mis mensajes', 'mis mensajes son privados', 'vendeis mis datos', 'publicidad', 'anuncios', 'datos personales', 'rgpd', 'proteccion de datos', 'que hacen con mis datos', 'guardan mis mensajes'],
    answer: '**Qué protege CIFRA hoy**\n• Todo viaja por conexión cifrada (**TLS**) y se guarda cifrado en el servidor (**cifrado en reposo**).\n• Solo los participantes de cada chat pueden leerlo (reglas de acceso a nivel de base de datos).\n• Los archivos son privados y se abren con enlaces temporales.\n\n**Lo que aún NO hay (te lo decimos claro)**\n• **No es cifrado de extremo a extremo**: el servicio podría técnicamente acceder a los datos almacenados. Está en la hoja de ruta.\n• El número aún no se verifica por SMS (modo beta).\n\nRevisa *Ajustes → Privacidad y seguridad* para el detalle.',
    actions: [{ label: 'Leer la política', icon: 'shield-checkmark', do: { go: '/privacy' } }],
    next: ['security', 'username'],
  },
  {
    id: 'install',
    title: 'Instalar CIFRA en el móvil',
    keywords: ['instalar', 'instalacion', 'pantalla de inicio', 'anadir a inicio', 'app movil', 'descargar', 'play store', 'app store', 'apk', 'icono en el movil', 'guardar en el telefono', 'pwa', 'como la uso en el movil', 'iphone', 'android', 'ios', 'ipad', 'safari', 'chrome', 'tienda de apps', 'hay version para', 'funciona en', 'app para el movil', 'version movil', 'icono', 'como la instalo', 'instalarla', 'instalar cifra', 'icono de la app', 'logo'],
    answer: '**CIFRA se instala como app desde el navegador (PWA)**\n\n**iPhone (Safari):** botón Compartir ⬆️ → *Añadir a pantalla de inicio*.\n**Android (Chrome):** menú ⋮ → *Instalar app* o *Añadir a pantalla de inicio*.\n**Ordenador (Chrome/Edge):** icono de instalar en la barra de direcciones.\n\nQuedará con su icono y se abrirá a pantalla completa. Aún no está en App Store ni Google Play.',
    next: ['start', 'notifications'],
  },
  {
    id: 'notifications',
    title: 'Notificaciones y avisos',
    keywords: ['notificacion', 'notificaciones', 'avisos', 'push', 'no me llegan', 'no me avisa', 'aviso del navegador', 'sonido', 'vibracion', 'alertas', 'no me suena', 'sin sonido de mensaje', 'no vibra', 'recibir avisos', 'activar avisos', 'desactivar avisos', 'avisame', 'alerta de mensaje'],
    answer: '**Avisos hoy**\n• *Ajustes → Avisos en el navegador*: recibe un aviso con mensajes nuevos cuando la pestaña está en segundo plano.\n• Si lo bloqueaste, cámbialo en los permisos del sitio de tu navegador.\n• Silencia chats concretos con pulsación larga → *Silenciar*.\n\n**Limitación honesta:** todavía **no hay notificaciones push** con la app cerrada, ni timbre de llamada si CIFRA no está abierta. Es lo siguiente en la lista.',
    next: ['calls', 'organize'],
  },
  {
    id: 'business',
    title: 'Qué es Business y cómo pasar de Personal a Business',
    keywords: ['business', 'negocio', 'empresa', 'cambiar a business', 'cambiar a personal', 'espacio', 'espacios', 'personal y business', 'pasar a negocio', 'cuenta de empresa', 'tengo un negocio', 'tienda', 'vender', 'switch', 'interruptor', 'abrir un negocio', 'tengo un restaurante', 'tengo una peluqueria', 'soy autonomo', 'soy freelance', 'atender clientes', 'atencion a clientes', 'profesional', 'cuenta profesional', 'agenda y crm', 'crm', 'espacio de trabajo', 'tipo slack', 'como slack'],
    answer: '**Un solo botón para cambiar de espacio**\n• Arriba en *Chats* verás el interruptor **Personal ⇄ Business** (en ordenador, en la barra lateral). También en *Ajustes → Espacios*.\n• **Personal**: tus chats, grupos, llamadas y estados.\n• **Business**: bandeja tipo equipo, **agenda de citas**, **clientes (CRM)**, catálogo y **Doer**, el asistente que hace las tareas. Tiene otro diseño y su propio **color** (ámbar, cobalto, jade, rubí u orquídea: se elige en *Perfil y equipo*) para que no te confundas y cada negocio se distinga.\n\nTu cuenta es la misma; el número no cambia. Para empezar, crea tu negocio (1 minuto).',
    actions: [{ label: 'Cambiar a Business', icon: 'storefront', do: { space: 'business' } }, { label: 'Crear mi negocio', icon: 'add-circle', do: { go: '/business-create' } }],
    next: ['bizcreate', 'agenda', 'doer'],
  },
  {
    id: 'bizcreate',
    title: 'Crear mi negocio',
    keywords: ['crear negocio', 'crear mi negocio', 'creo mi negocio', 'crear un negocio', 'montar mi negocio', 'monto mi negocio', 'abrir un negocio', 'registrar negocio', 'dar de alta negocio', 'abrir negocio', 'nuevo negocio', 'otro negocio', 'varios negocios', 'identificador', 'abro un negocio', 'abrir un negocio en cifra', 'dar de alta mi negocio', 'registrar mi empresa', 'crear mi empresa', 'crear empresa', 'crear mi tienda', 'montar una tienda', 'nombre del negocio'],
    answer: '**Crear tu negocio**\n1. Cambia a **Business** (o *Ajustes → Mi negocio*).\n2. Pulsa *Crear mi negocio* y rellena **nombre**, **identificador** (único, p. ej. `cafe-sol`), categoría y descripción.\n3. Listo: ya tienes bandeja, catálogo y perfil público.\n\nPuedes tener **varios negocios** (hasta 5 por día) y alternar entre ellos tocando el nombre arriba. Tú serás el **Propietario**.',
    actions: [{ label: 'Crear mi negocio', icon: 'add-circle', do: { go: '/business-create' } }],
    next: ['bizprofile', 'team', 'catalog'],
  },
  {
    id: 'bizprofile',
    title: 'Perfil público y enlace para clientes',
    keywords: ['perfil publico', 'enlace de negocio', 'link del negocio', 'compartir negocio', 'que me escriban los clientes', 'como me encuentran', 'buscar negocios', 'encontrar negocio', 'cliente me escribe', 'qr', 'enlace para clientes', 'mi ficha', 'pagina del negocio', 'pagina publica', 'que los clientes me encuentren', 'darme a conocer', 'promocionar mi negocio', 'compartir mi tienda', 'link para clientes', 'perfil del negocio', 'logo del negocio'],
    answer: '**Que tus clientes te encuentren**\n• En Business, entra en *Negocio → Ver perfil público*: ahí está tu ficha con descripción, horario, catálogo y el botón de escribirte.\n• Toca **Compartir** para copiar tu enlace y ponlo en Instagram, tu web o una tarjeta.\n• Los clientes también te encuentran desde *Nuevo chat → Negocios* buscando tu nombre o identificador.\n\nCuando escriben, su conversación aparece en tu **Bandeja**.',
    actions: [{ label: 'Abrir mi negocio', icon: 'storefront', do: { space: 'business' }, then: '/business' }],
    next: ['inbox', 'catalog'],
  },
  {
    id: 'inbox',
    title: 'Bandeja de clientes, estados y asignación',
    keywords: ['bandeja', 'inbox', 'clientes', 'cliente', 'atender', 'atencion al cliente', 'asignar', 'asignacion', 'pendiente', 'resuelto', 'abierto', 'estado de conversacion', 'nota interna', 'nota', 'sin asignar', 'mis conversaciones', 'mis empleados contesten', 'varios atienden', 'quien atiende', 'responder en nombre del negocio', 'conversaciones de clientes', 'cliente nuevo', 'ver quien contesta', 'pasar un cliente a otro', 'derivar', 'bandeja como slack', 'hilos', 'mensajes del equipo', 'quien es el cliente'],
    answer: '**Bandeja compartida**\n• Cada cliente es una conversación con **estado**: *Abierto*, *Pendiente*, *Resuelto* o *Cerrado* (cámbialo con el botón de estado de la cabecera).\n• **Asignar** 👤+ una conversación a ti o a un compañero; filtra por *Míos* y *Sin asignar*.\n• **Nota interna** 🔒: cambia a «Nota interna» sobre la caja de texto; solo tu equipo la ve, el cliente nunca.\n• Arriba ves contadores de abiertos, pendientes y sin asignar.\n• Tu cliente ve el mensaje como del negocio, no de una persona concreta.',
    actions: [{ label: 'Abrir la Bandeja', icon: 'file-tray-full', do: { space: 'business' }, then: '/inbox' }],
    next: ['team', 'quick', 'auto'],
  },
  {
    id: 'team',
    title: 'Equipo y roles',
    keywords: ['equipo', 'roles', 'rol', 'agente', 'agentes', 'empleado', 'empleados', 'anadir al equipo', 'invitar al equipo', 'administrador', 'supervisor', 'solo lectura', 'permisos', 'trabajar en equipo', 'varios agentes', 'compartir bandeja', 'mis empleados', 'empleados contesten', 'mis trabajadores', 'trabajadores', 'socio', 'socios', 'companeros', 'compañeros', 'dar acceso', 'quitar acceso', 'eliminar del equipo', 'que puede hacer cada uno', 'permisos del equipo', 'varios usuarios'],
    answer: '**Trabaja en equipo**\n• *Negocio → Equipo → Añadir*: escribe el **teléfono** de tu compañero (debe tener cuenta CIFRA) y elige su rol.\n• **Roles**: Propietario · Administrador · Supervisor · Agente · Solo lectura.\n• Propietario, Administrador y Supervisor **gestionan** (perfil, automatizaciones, catálogo, equipo). Los Agentes atienden chats. Solo lectura ve sin poder escribir.\n• Cada uno solo puede dar roles inferiores al suyo.',
    actions: [{ label: 'Abrir Negocio', icon: 'storefront', do: { space: 'business' }, then: '/business' }],
    next: ['inbox', 'quick'],
  },
  {
    id: 'quick',
    title: 'Respuestas rápidas',
    keywords: ['respuestas rapidas', 'respuesta rapida', 'guardar plantillas', 'plantillas para responder', 'guardar respuestas', 'atajo', 'plantilla', 'plantillas', 'preguntas frecuentes', 'responder mas rapido', 'mensaje guardado', 'macro', 'pregunta siempre lo mismo', 'repetir lo mismo', 'responder lo mismo', 'mismas preguntas', 'ahorrar tiempo', 'mensajes predefinidos', 'respuestas guardadas', 'barra diagonal', 'atajos de respuesta'],
    answer: '**Respuestas rápidas ⚡**\n1. En Business: *Negocio → Respuestas rápidas → Nueva*.\n2. Ponle un **atajo** (p. ej. `horario`) y el texto.\n3. En cualquier chat de cliente toca el rayo ⚡ junto a la caja y elige la respuesta: se inserta lista para editar o enviar.\n\nIdeal para horarios, precios, dirección o formas de pago.',
    actions: [{ label: 'Abrir Negocio', icon: 'flash', do: { space: 'business' }, then: '/business' }],
    next: ['auto', 'inbox'],
  },
  {
    id: 'auto',
    title: 'Saludo y mensaje de ausencia',
    keywords: ['saludo', 'bienvenida', 'mensaje de bienvenida', 'ausencia', 'mensaje de ausencia', 'fuera de horario', 'automatico', 'automaticos', 'automatizacion', 'automatizaciones', 'respuesta automatica', 'horario', 'bot de negocio', 'chatbot', 'horario de mi negocio', 'horario de atencion', 'configurar horario', 'abierto cerrado', 'estamos cerrados', 'vacaciones', 'mensaje cuando no estoy', 'mensaje automatico', 'respuesta cuando no estamos', 'al primer mensaje', 'primer mensaje'],
    answer: '**Automatizaciones (Business → Negocio)**\n• **Saludo de bienvenida**: se envía solo cuando un cliente abre una conversación nueva contigo.\n• **Mensaje de ausencia**: actívalo con el interruptor cuando no estés; responde automáticamente (como mucho una vez cada 12 horas por cliente).\n• Los mensajes automáticos llevan la etiqueta «RESPUESTA AUTOMÁTICA» para tu equipo.\n\nAún no hay flujos con ramas ni respuestas por palabras clave; las respuestas rápidas cubren lo manual.',
    actions: [{ label: 'Configurar', icon: 'flash', do: { space: 'business' }, then: '/business' }],
    next: ['quick', 'inbox'],
  },
  {
    id: 'catalog',
    title: 'Catálogo de productos y servicios',
    keywords: ['catalogo', 'producto', 'productos', 'servicio', 'servicios', 'precio', 'precios', 'publicar producto', 'anadir producto', 'vender productos', 'menu', 'carta', 'moneda', 'borrador', 'vender cosas', 'vender en la app', 'vender por cifra', 'mis productos', 'lista de precios', 'servicios y precios', 'subir productos', 'foto del producto', 'tienda online', 'carrito', 'pagos', 'cobrar'],
    answer: '**Catálogo 🏷️**\n1. En Business abre la pestaña **Catálogo** y pulsa ➕.\n2. Pon **nombre**, **precio** y moneda (EUR, USD, MXN, GBP, COP, ARS, CLP, PEN), **descripción** y, si quieres, foto.\n3. Activa **Publicado** para que lo vean tus clientes; apagado queda como borrador.\n\nLos clientes ven tu catálogo en tu perfil público y desde el propio chat. Todavía no hay carrito ni pagos dentro de la app: cierras el pedido por chat.',
    actions: [{ label: 'Abrir Catálogo', icon: 'pricetags', do: { space: 'business' }, then: '/catalog' }],
    next: ['bizprofile', 'inbox'],
  },
  {
    id: 'multidevice',
    title: 'Usar CIFRA en varios dispositivos',
    keywords: ['varios dispositivos', 'ordenador', 'tablet', 'pc', 'web', 'otro movil', 'cambiar de movil', 'perdi mi telefono', 'mis chats en otro telefono', 'sincronizar', 'sincronizacion', 'copia de seguridad', 'backup', 'otro ordenador', 'dos dispositivos', 'dos moviles', 'mismo numero en dos moviles', 'cambie de movil', 'perdi el movil', 'me robaron el movil', 'nuevo telefono', 'copia de seguridad', 'restaurar chats'],
    answer: '**Tus chats viven en tu cuenta, no en el teléfono.**\n• Entra con tu número y contraseña desde cualquier navegador o móvil y verás todo al instante, sincronizado.\n• No necesitas copias de seguridad ni transferir chats al cambiar de móvil.\n• En pantalla grande, CIFRA muestra la lista de chats y la conversación lado a lado.\n\nNo compartas tu contraseña. Si cambias de número, hoy se crea una cuenta nueva (no hay migración de número aún).',
    next: ['install', 'security'],
  },
  {
    id: 'invite',
    title: 'Invitar a amigos',
    keywords: ['invitar', 'invitacion', 'mis amigos no estan', 'no esta en cifra', 'no tiene cifra', 'traer amigos', 'compartir cifra', 'recomendar', 'enlace de invitacion', 'amigo sin cuenta', 'mi amigo no tiene', 'mi familia no tiene', 'traer a mi familia', 'enlace de la app', 'compartir la app', 'mandar la app', 'como se lo digo', 'no esta mi contacto'],
    answer: '**Invita a quien aún no está**\n• En *Nuevo chat*, si buscas un número sin cuenta verás el botón **Invitar a CIFRA**: comparte un mensaje con el enlace de la app.\n• También puedes compartir tu **@usuario** desde tu perfil.\n\nCuando se registre, buscadle por número o @usuario y a chatear.',
    actions: [{ label: 'Invitar ahora', icon: 'share-social', do: { share: 'invite' } }],
    next: ['newchat', 'username'],
  },
  {
    id: 'troubleshoot',
    title: 'Solucionar problemas',
    keywords: ['no funciona', 'error', 'fallo', 'problema', 'no carga', 'no me deja', 'se cierra', 'lento', 'no envia', 'no se envia', 'no llegan', 'no me llegan mensajes', 'sin conexion', 'bug', 'ayuda urgente', 'algo salio mal', 'reintentar', 'bloqueado', 'cuelga', 'sin datos', 'sin wifi', 'offline', 'no tengo internet', 'no puedo enviar', 'no puedo abrir', 'pantalla en blanco', 'se queda cargando', 'mensajes no salen', 'no carga la app', 'va lento', 'se ha roto', 'tengo un problema', 'me da error', 'sale un error', 'sin internet', 'gastar datos', 'gasta datos', 'consumo de datos', 'usar sin internet', 'sin conexion'],
    answer: '**Pruebas rápidas, en orden**\n1. **Sin conexión**: CIFRA necesita internet para enviar y recibir; revisa tu conexión. Los mensajes fallidos muestran «Toca para reintentar».\n2. **Actualiza** la página o cierra y abre la app (se actualiza sola al recargar).\n3. **Micrófono/cámara/avisos**: permisos del sitio en el navegador.\n4. **«Demasiados intentos»**: hay límites anti-abuso; espera un minuto.\n5. **No encuentras a alguien**: puede no tener cuenta o tener desactivado «Descubrible por número» — pídele su @usuario.\n6. Si la llamada no conecta, ambos deben tener CIFRA abierta y buena señal.\n\nCuéntame qué te pasa con más detalle y lo miramos juntos.',
    next: ['calls', 'notifications'],
  },
  {
    id: 'limits',
    title: 'Lo que CIFRA aún no tiene',
    keywords: ['no tiene', 'falta', 'echo de menos', 'cuando habra', 'proximamente', 'hoja de ruta', 'roadmap', 'encuestas', 'mensajes temporales', 'desaparecen', 'canales', 'difusion', 'lista de difusion', 'llamadas de grupo', 'traducir', 'traduccion', 'pagos', 'funciones nuevas', 'sugerencia', 'que le falta', 'le falta', 'lo que falta', 'funciones futuras', 'habra', 'se podra', 'algun dia', 'por que no hay', 'echo en falta', 'traductor', 'mensajes que se borran solos', 'listas de difusion', 'canal', 'canales'],
    answer: '**Honestidad ante todo.** Hoy CIFRA todavía **no** tiene:\n• Cifrado de extremo a extremo.\n• Notificaciones push / timbre con la app cerrada.\n• Llamadas de grupo.\n• Encuestas, mensajes temporales (que se autodestruyen) ni canales/listas de difusión.\n• Recordatorios push de citas ni sincronización con Google Calendar.\n• Traducción automática de mensajes.\n• Pagos dentro del chat.\n\nSí tiene, y no es poco: mensajes programados, @usuario sin teléfono, búsqueda global, llamadas por internet, Business con equipo y catálogo. Tus sugerencias nos ayudan a priorizar: cuéntame qué echas de menos.',
    next: ['privacy', 'notifications'],
  },
  {
    id: 'account',
    title: 'Cerrar sesión, contraseña y borrar la cuenta',
    keywords: ['cerrar sesion', 'cierro sesion', 'salir de la cuenta', 'desconectarme', 'desconectar', 'logout', 'sign out', 'cambiar contrasena', 'cambiar la contrasena', 'nueva contrasena', 'recuperar contrasena', 'olvide la contrasena', 'borrar mi cuenta', 'borro mi cuenta', 'eliminar mi cuenta', 'eliminar cuenta', 'borrar cuenta', 'darme de baja', 'dar de baja', 'cambiar mi numero', 'cambiar de numero', 'hackeado', 'hackearon', 'me han hackeado', 'robaron mi cuenta', 'alguien entro en mi cuenta', 'cuenta robada'],
    answer: '**Tu cuenta**\n• **Cerrar sesión**: *Ajustes* → botón rojo **Cerrar sesión** (abajo del todo).\n• **Cambiar la contraseña** y **borrar la cuenta**: todavía **no existen** dentro de la app. Estamos siendo claros para que no pierdas tiempo buscándolos.\n• **Cambiar de número**: tu número es tu identidad, así que hoy un número nuevo significa una cuenta nueva.\n\n**Si crees que alguien entró en tu cuenta:** activa el **Bloqueo con PIN** en tus dispositivos, no reutilices esa contraseña en otros sitios y avisa a tus contactos para que no se fíen de mensajes raros. Aún no hay cierre remoto de sesiones.',
    actions: [{ label: 'Ir a Ajustes', icon: 'settings', do: { go: '/settings' } }],
    next: ['security', 'limits'],
  },
  {
    id: 'notfound',
    title: 'No encuentro a una persona',
    keywords: ['no encuentro a', 'no la encuentro', 'no lo encuentro', 'no me aparece', 'no aparece', 'no sale', 'no sale su nombre', 'no existe', 'no esta en cifra', 'buscar y no sale', 'no da resultado', 'sin resultados', 'por que no la veo', 'no puedo encontrar'],
    answer: '**Si una persona no te aparece al buscarla**\n1. **Revisa el país y el número**: tiene que ser el número completo con su prefijo correcto.\n2. **Puede no tener cuenta** en CIFRA todavía: en ese caso te ofrecemos *Invitar*.\n3. **Puede haber desactivado «Descubrible por número»**: pídele su **@usuario** y búscala por *Por @usuario*.\n4. Con **Ocultar mi número** activo, una persona solo se encuentra por @usuario.\n\nSi ya habéis chateado, la tienes en la pestaña **Contactos**.',
    actions: [{ label: 'Buscar de nuevo', icon: 'search', do: { go: '/new-chat' } }, { label: 'Invitar a un amigo', icon: 'share-social', do: { share: 'invite' } }],
    next: ['username', 'invite', 'contacts'],
  },
  {
    id: 'ticks',
    title: 'Qué significan las palomitas y los iconos',
    keywords: ['palomita', 'palomitas', 'doble palomita', 'una palomita', 'check', 'doble check', 'tick', 'ticks', 'reloj en el mensaje', 'icono del mensaje', 'que significa el icono', 'visto', 'leido', 'han leido mi mensaje', 'cuando lo leen', 'confirmacion de lectura', 'editado', 'se enviado', 'entregado'],
    answer: '**Iconos junto a la hora de tus mensajes**\n• 🕒 **Reloj**: se está enviando.\n• ✓ **Una palomita**: enviado al servidor.\n• ✓✓ **Dos palomitas verdes**: la otra persona ya lo ha **leído**.\n• ⚠️ **Aviso rojo**: no se envió; toca para reintentar.\n• ⭐ **Estrella**: lo has destacado. «editado»: lo modificaste.\n\nEn un grupo se ponen verdes en cuanto **al menos una persona** lo ha leído.',
    next: ['messages', 'troubleshoot'],
  },
  {
    id: 'agenda',
    title: 'Agenda de citas (Business)',
    keywords: ['agenda', 'cita', 'citas', 'agendar', 'agendar cita', 'calendario', 'reservas', 'reservar', 'turnos', 'turno', 'solicitar cita', 'pedir cita', 'pedir una cita', 'cita con un cliente', 'recordatorio de cita', 'confirmar cita', 'cancelar cita', 'reprogramar', 'cambiar la hora de una cita', 'horario de citas', 'reunion con cliente', 'calendario del negocio', 'calendario de citas', 'calendario'],
    answer: '**Agenda integrada en Business**\n• Pestaña **Agenda**: calendario del mes con puntos de color y, debajo, las citas del día.\n• **Nueva cita**: pon qué es, elige **un cliente** o **invita a cualquier cuenta de CIFRA** (por @usuario o teléfono, sea negocio o no), toca el día y la hora, la duración y a quién atiende. Le llega una **invitación al chat** con **Aceptar** / **Rechazar**; hasta que acepte, la cita queda **pendiente de aceptar** y al aceptar pasa a **Confirmada** en las dos agendas.\n• Quien recibe invitaciones las ve arriba en *Chats* y en **Ajustes → Mis citas**.\n• **Solicitudes**: tus clientes pueden pedirte cita desde tu perfil público (*Solicitar una cita*). Te aparecen arriba en la Agenda para **Aceptar** o rechazar.\n• Toca una cita para confirmarla, marcarla como hecha o «no vino», cambiar la fecha o cancelarla; el cliente recibe el aviso en el chat.\n• Si dos citas de la misma persona se pisan, te avisa.\n\nTodavía no hay recordatorios push automáticos ni sincronización con Google Calendar.',
    actions: [{ label: 'Abrir la Agenda', icon: 'calendar', do: { space: 'business' }, then: '/agenda' }],
    next: ['crm', 'doer', 'bizprofile'],
  },
  {
    id: 'incognito',
    title: 'Chat incógnito (se autodestruye)',
    keywords: ['incognito', 'chat incognito', 'modo incognito', 'secreto', 'chat secreto', 'chat privado', 'autodestruir', 'autodestruye', 'se autodestruye', 'se borra solo', 'mensajes que se borran', 'borrar sin rastro', 'sin rastro', 'temporal', 'chat temporal', 'efimero', 'blanco y negro', 'maquina de escribir', 'destruir chat', 'destruir ahora', 'tres horas', '3 horas'],
    answer: '**Chat incógnito**: una sala aparte que **se autodestruye**.\n• Abre un chat 1:1, toca **⋯** y elige **Chat incógnito con …**. Ponle un **nombre** y listo: aparece en la lista de los dos, aparte del chat normal.\n• Se ve en **blanco y negro** y con letra de **máquina de escribir** para que sepas que es temporal; las fotos y vídeos se ven a color.\n• Se destruye **tras 3 horas sin mensajes** (cada mensaje renueva el plazo) o **al instante** cuando los dos pulsáis **Destruir ahora**.\n• Al destruirse desaparece todo para ambos: mensajes, archivos, reacciones. No queda registro ni en la búsqueda.\n\nDentro no hay llamadas ni mensajes programados, y nunca se muestra tu número.',
    actions: [{ label: 'Ir a Chats', icon: 'chatbubbles', do: { go: '/chats' } }],
    next: ['privacy', 'block'],
  },
  {
    id: 'report',
    title: 'Reportar a un desconocido o a un negocio',
    keywords: ['reportar', 'reporte', 'denunciar', 'denuncia', 'spam', 'estafa', 'me escribe un desconocido', 'desconocido', 'no conozco', 'numero desconocido', 'quien es', 'acoso', 'suplantacion', 'se hace pasar', 'contacto desconocido', 'alguien que no conozco'],
    answer: '**Si te escribe alguien que no conoces**\n• Arriba del teclado verás un aviso: **«X no está en tus contactos»** con tres botones: **Añadir** (lo guardas), **Reportar** y **Bloquear**.\n• **Reportar** pide el motivo (spam, suplantación, acoso, estafa…) y te deja **bloquear en el mismo paso**. La otra persona no sabe quién la reportó.\n• También puedes reportar desde **⋯ → Reportar contacto**, y a un negocio desde su chat.\n• Si cierras el aviso, no vuelve a salir en ese chat.',
    actions: [{ label: 'Ir a Chats', icon: 'chatbubbles', do: { go: '/chats' } }],
    next: ['block', 'privacy'],
  },
  {
    id: 'crm',
    title: 'Clientes (CRM) y tareas',
    keywords: ['crm', 'clientes', 'cartera de clientes', 'embudo', 'pipeline', 'etapas', 'seguimiento', 'seguimiento de clientes', 'leads', 'prospectos', 'etiquetas', 'etiqueta', 'notas de cliente', 'tareas', 'tarea', 'recordatorios', 'pendientes', 'ficha de cliente', 'gestionar clientes', 'valor del cliente', 'ventas'],
    answer: '**CRM sencillo, sin configurar nada**\n• Pestaña **Clientes**: cada persona que te escribe aparece **sola** como ficha. También puedes añadir clientes a mano.\n• **Embudo** por columnas: Nuevo → En contacto → Propuesta → Ganado / Perdido. Cambia la etapa tocando la ficha (o pídeselo a **Doer**).\n• En cada ficha: **etiquetas** (#vip), **valor estimado**, **notas privadas**, **Escribir** (abre o crea el chat, incluso si solo tienes su teléfono y esa persona está en CIFRA) y **agendar cita**.\n• **Tareas pendientes** arriba: escribe y pulsa Enter; márcalas con el cuadrado cuando acabes.\n• Cambia entre vista de columnas y lista con el botón de arriba.\n\nLas notas y etiquetas son **solo para tu equipo**; el cliente nunca las ve.',
    actions: [{ label: 'Abrir Clientes', icon: 'people', do: { space: 'business' }, then: '/clients' }],
    next: ['agenda', 'doer', 'inbox'],
  },
  {
    id: 'doer',
    title: 'Doer, el asistente que hace las tareas',
    keywords: ['doer', 'asistente de negocio', 'asistente virtual del negocio', 'que haga las tareas', 'hazlo por mi', 'automatizar', 'me lo programa', 'pedirle algo', 'que lo haga por mi', 'robot del negocio', 'agente virtual', 'asistente de business'],
    answer: '**Doer** hace por ti lo que le pidas en el espacio Business (botón ⚡ del centro).\n\n**Prueba a escribirle**\n• «Agenda una cita con Ana mañana a las 10»\n• «Crea una respuesta rápida horario: abrimos de 9 a 18»\n• «Pon el saludo: ¡Hola! ¿En qué te ayudo?»\n• «Añade un producto Café con leche 2,5€»\n• «Crea una tarea: llamar a proveedores el viernes»\n• «Envía a Ana mañana a las 9: tu pedido está listo»\n• «Mueve a María a ganado»\n\nSiempre te enseña un **plan** y no hace nada hasta que pulses **Hacerlo**. No borra ni cancela cosas por su cuenta. Entiende fechas como «mañana», «el viernes» o «el 15 de noviembre».',
    actions: [{ label: 'Abrir Doer', icon: 'flash', do: { space: 'business' }, then: '/doer' }],
    next: ['agenda', 'quick', 'catalog'],
  },
  {
    id: 'bizphone',
    title: 'Ocultar el teléfono del negocio',
    keywords: ['ocultar telefono del negocio', 'telefono del negocio', 'numero del negocio', 'que no vean el telefono de mi negocio', 'solo atender por cifra', 'mostrar telefono', 'privacidad del negocio', 'telefono publico'],
    answer: '**El teléfono de tu negocio es opcional y privado por defecto.**\n• En *Negocio → Perfil* apaga **Mostrar el teléfono públicamente** (ya viene apagado): tus clientes solo te escriben por CIFRA y ven tu **@identificador**, nunca tu número.\n• Si lo enciendes, aparece en tu perfil público con botón de llamada.\n• El equipo siempre ve el teléfono en el perfil interno.',
    actions: [{ label: 'Abrir Negocio', icon: 'storefront', do: { space: 'business' }, then: '/business' }],
    next: ['bizprofile', 'username'],
  },
  {
    id: 'profileview',
    title: 'Ver el perfil de otra persona o negocio',
    keywords: ['ver perfil', 'perfil de otra persona', 'perfil de mi contacto', 'ver el perfil de', 'informacion del contacto', 'datos del contacto', 'perfil del negocio', 'ver su foto', 'desde cuando esta en cifra', 'miembro desde', 'desde cuando esta alguien', 'desde cuando esta en cifra', 'desde cuando', 'cuando se registro'],
    answer: '**Toca el nombre o la foto en la cabecera de un chat** para abrir su perfil.\n• **Personas**: foto, nombre, @usuario, info, desde cuándo están en CIFRA, y botones para **mensaje, llamada y vídeo**. Su teléfono solo se ve si no lo ha ocultado. Desde ahí también puedes **bloquearla**.\n• **Negocios**: ficha con insignia *Business*, descripción, catálogo, **Solicitar una cita** y botón de escribir.\n• Tu propio perfil (*Ajustes → tu tarjeta*) muestra una vista previa de **cómo te ven los demás**.',
    next: ['username', 'profile', 'agenda'],
  },
  {
    id: 'video',
    title: 'Ver vídeos dentro de la app',
    keywords: ['video', 'videos', 'ver un video', 'reproducir video', 'reproductor', 'reproducir', 'enviar un video', 'mandar un video', 'video no se reproduce', 'velocidad del video', 'pantalla completa'],
    answer: '**Reproductor de vídeo integrado**\n• Los vídeos que te envían salen con su **primer fotograma** y la duración. Tócalos y se reproducen **dentro de CIFRA**, sin salir de la app.\n• Controles: **pausa/play** (toca la pantalla), barra para **avanzar**, velocidad (1×, 1,5×, 2×, 0,5×), **sonido** y **pantalla completa**.\n• Para enviar uno: **+ → Foto o vídeo** (máx. 25 MB).',
    next: ['media', 'voice'],
  },
  {
    id: 'wallpaper',
    title: 'Fondos de chat y tu propia imagen',
    keywords: ['fondo del chat', 'fondos de chat', 'fondo de pantalla', 'wallpaper', 'poner mi foto de fondo', 'imagen de fondo', 'cambiar el fondo', 'fondo personalizado', 'mi propia imagen', 'patron de fondo', 'cifra aurora trama noche', 'foto de fondo', 'poner un fondo', 'fondo', 'fondos', 'cambiar el fondo', 'fondo de los chats'],
    answer: '**Fondos de chat (Ajustes → Personalizar)**\n• 4 diseños propios de CIFRA: **Cifra** (garabatos cifrados, el de siempre), **Aurora**, **Trama** y **Noche**, más **Liso**.\n• **Subir imagen**: elige una foto de tu galería y será el fondo de todos tus chats (se oscurece un poco para que se lea).\n• Los colores del fondo siguen tu color de CIFRA y el modo claro/oscuro. En el espacio Business el fondo es liso a propósito.',
    actions: [{ label: 'Ir a Ajustes', icon: 'settings', do: { go: '/settings' } }],
    next: ['customize'],
  },
  {
    id: 'about',
    title: 'Quién soy',
    keywords: ['quien eres', 'quien eres tu', 'que eres', 'como te llamas', 'tu nombre', 'eres un bot', 'eres humano', 'eres una persona', 'maestro', 'asistente', 'botmaster', 'bot master', 'quien eres tu', 'que haces', 'que sabes hacer', 'eres inteligente', 'eres una ia', 'inteligencia artificial', 'eres chatgpt', 'quien te creo'],
    answer: 'Soy **Maestro CIFRA**, el asistente oficial de la app 🤖. Soy un **bot** (no una persona) y conozco CIFRA de arriba abajo.\n\nPregúntame cosas como *«¿cómo programo un mensaje?»*, *«¿cómo creo mi negocio?»* o *«¿por qué no suena una llamada?»*. Escribe `/ayuda` para ver todos los temas.\n\nMis respuestas son sobre la app; no leo tus chats ni tus datos.',
    next: ['start', 'limits'],
  },
];

export const topicById = new Map(topics.map((t) => [t.id, t]));

/** Short labels for chips and for the "question" bubble when a chip is tapped. */
export const SHORT: Record<string, string> = {
  start: 'Empezar a usar CIFRA', register: 'Cuenta y contraseña', newchat: 'Chatear con alguien nuevo', username: '@usuario y número oculto', profile: 'Perfil y foto',
  messages: 'Editar, borrar, reaccionar', media: 'Fotos y archivos', voice: 'Mensajes de voz', calls: 'Llamadas y videollamadas', groups: 'Grupos', statuses: 'Estados', contacts: 'Contactos',
  organize: 'Fijar, archivar, silenciar', search: 'Buscar mensajes', starred: 'Destacados', schedule: 'Programar mensajes', customize: 'Colores y fondos', security: 'Bloqueo con PIN',
  block: 'Bloquear a alguien', privacy: 'Privacidad y cifrado', install: 'Instalar en el móvil', notifications: 'Notificaciones', business: 'Personal ⇄ Business', bizcreate: 'Crear mi negocio',
  bizprofile: 'Enlace para clientes', inbox: 'Bandeja de clientes', team: 'Equipo y roles', quick: 'Respuestas rápidas', auto: 'Saludo y ausencia', catalog: 'Catálogo', multidevice: 'Varios dispositivos',
  invite: 'Invitar a amigos', account: 'Sesión y contraseña', agenda: 'Agenda de citas', crm: 'Clientes y tareas', doer: 'Doer (asistente)', bizphone: 'Teléfono del negocio', profileview: 'Ver perfiles', video: 'Reproductor de vídeo', wallpaper: 'Fondos de chat', notfound: 'No encuentro a alguien', ticks: 'Palomitas e iconos', troubleshoot: 'Solucionar problemas', limits: 'Lo que aún no hay', about: 'Quién eres',
};

export const COMMANDS: { cmd: string; hint: string; topic?: string }[] = [
  { cmd: '/start', hint: 'Primeros pasos', topic: 'start' },
  { cmd: '/ayuda', hint: 'Ver todos los temas' },
  { cmd: '/chats', hint: 'Chatear con alguien', topic: 'newchat' },
  { cmd: '/llamadas', hint: 'Llamadas y videollamadas', topic: 'calls' },
  { cmd: '/voz', hint: 'Mensajes de voz', topic: 'voice' },
  { cmd: '/grupos', hint: 'Crear grupos', topic: 'groups' },
  { cmd: '/negocio', hint: 'Espacio Business', topic: 'business' },
  { cmd: '/programar', hint: 'Programar mensajes', topic: 'schedule' },
  { cmd: '/privacidad', hint: 'Privacidad y cifrado', topic: 'privacy' },
  { cmd: '/seguridad', hint: 'PIN y bloqueo', topic: 'security' },
  { cmd: '/personalizar', hint: 'Colores y fondos', topic: 'customize' },
  { cmd: '/instalar', hint: 'Instalar en el móvil', topic: 'install' },
  { cmd: '/novedades', hint: 'Lo que viene y lo que falta', topic: 'limits' },
];

export const GREETING_TEXT =
  '¡Hola{name}! Soy **Maestro CIFRA** 🤖, el asistente oficial. Conozco cada rincón de la app y te explico paso a paso cómo hacer lo que quieras.\n\nEscríbeme tu duda con tus palabras, o toca una opción:';

export const STARTER_CHIPS = ['start', 'newchat', 'calls', 'business', 'schedule', 'privacy'];

export const FALLBACK_TEXT =
  'No estoy seguro de haberte entendido 🤔. Prueba a decirlo con otras palabras (por ejemplo «cómo llamo a alguien» o «cómo creo un grupo»), o elige un tema:';

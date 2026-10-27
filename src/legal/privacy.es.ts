import { Doc, contactLine, operator } from './company';

const o = operator('es');

export const privacyEs: Doc = {
  title: 'Política de privacidad',
  intro: [
    `Esta Política de privacidad explica qué datos personales trata ${o.full} («CIFRA», «nosotros») cuando usas CIFRA, para qué los usamos, con quién los compartimos, cuánto tiempo los conservamos y qué derechos tienes. Se aplica a la aplicación web instalable (PWA), a las aplicaciones móviles y a todas las funciones del servicio, en el espacio Personal y en el espacio Business.`,
    'Resumen en pocas líneas: usamos tu teléfono y tu nombre para crear tu cuenta; guardamos tus mensajes y archivos para entregarlos y mostrártelos; no vendemos tus datos ni los usamos para publicidad; no leemos tus chats salvo lo que se nos reporte o lo exija la ley; puedes eliminar tu cuenta y todo lo tuyo desde la propia app.',
  ],
  sections: [
    { h: '1. Quién es el responsable', p: [
      `El responsable del tratamiento de los datos de tu cuenta y del uso del servicio es ${o.full}.`,
      `Puedes contactar con nosotros para cualquier asunto de privacidad mediante ${contactLine('es')}.`,
      'En el espacio Business hay dos papeles distintos: para los datos de tu cuenta de usuario, el responsable es CIFRA; para los datos de los clientes que un Negocio gestiona (conversaciones, fichas del CRM, citas, etiquetas, notas), el responsable es el Negocio y CIFRA actúa como encargado del tratamiento que los aloja y procesa siguiendo sus instrucciones (ver apartado 12).',
    ] },
    { h: '2. Qué datos tratamos', p: [
      'Datos de cuenta y perfil:',
      '• Número de teléfono (es tu identificador), nombre para mostrar, nombre de usuario (@) opcional, biografía opcional, foto de perfil y portada opcionales, idioma, zona horaria y ajustes de privacidad (por ejemplo, si te pueden encontrar por número o si se oculta tu teléfono).',
      '• Tu contraseña, que nunca guardamos en claro: solo un resumen cifrado (hash) gestionado por el proveedor de autenticación.',
      '• Correo de recuperación y su estado de verificación, y el código de recuperación, del que solo guardamos una huella cifrada (hash), nunca el código.',
      'Contenido que creas:',
      '• Mensajes de texto, fotos, vídeos, notas de voz, documentos y otros archivos, respuestas, reacciones, mensajes destacados, mensajes programados, encuestas y votos, estados y publicaciones, y llamadas (su existencia, duración y estado; no grabamos su contenido).',
      '• En Business: datos del negocio (nombre, descripción, contacto, horarios, logotipo, catálogo, publicaciones), equipo y roles, fichas de clientes (nombre, teléfono, correo, etapa, etiquetas, notas, valor), citas, tareas, respuestas rápidas, saludos y mensajes automáticos y difusiones enviadas.',
      'Datos de uso y técnicos:',
      '• Estados de entrega y lectura de mensajes, hora de envío, quién participa en cada conversación, contactos que añades y personas que bloqueas, reportes que envías o recibes.',
      '• Datos del dispositivo y la conexión: tipo de navegador y sistema, versión de la aplicación, dirección IP, identificadores técnicos y registros de errores necesarios para la seguridad y el funcionamiento.',
      '• Si activas las notificaciones: un identificador de suscripción (endpoint y claves) de tu dispositivo, que usamos solo para enviarte avisos, y tus preferencias de aviso por espacio.',
      'Datos de terceros que nos facilitas:',
      '• Si añades a una persona como contacto o cliente, o escribes a alguien, tratamos los datos que introduces sobre ella (nombre, teléfono, correo). Asegúrate de que tienes derecho a hacerlo. No subimos tu agenda de contactos del teléfono a nuestros servidores.',
      'No pedimos datos especialmente sensibles (salud, creencias, orientación sexual, biométricos, etc.). Si los incluyes en tus mensajes o en el CRM, los tratamos como cualquier otro contenido para prestarte el servicio; ten cuidado con lo que compartes.',
    ] },
    { h: '3. Para qué usamos tus datos y con qué base jurídica', p: [
      '• Prestar el servicio (contrato): crear y gestionar tu cuenta, entregar mensajes y llamadas, mostrar estados y publicaciones, sincronizar entre tus dispositivos, enviar notificaciones y recordatorios que has solicitado, y permitir las funciones de Business.',
      '• Seguridad y prevención del abuso (interés legítimo y obligación legal): verificar tu identidad en la recuperación de cuenta, limitar envíos, detectar spam, fraude y comportamientos dañinos, revisar reportes, suspender cuentas y proteger a las personas y al servicio.',
      '• Mantener y mejorar el servicio (interés legítimo): diagnosticar errores, medir el rendimiento y corregir fallos mediante registros y monitorización de errores, sin crear perfiles publicitarios.',
      '• Comunicaciones de servicio (contrato e interés legítimo): enviarte códigos de verificación, avisos de seguridad y cambios importantes. No te enviamos publicidad.',
      '• Asistentes de ayuda y de tareas (contrato y, si procede, consentimiento): procesar tus consultas para responderte o proponerte acciones.',
      '• Cumplir obligaciones legales y atender requerimientos de autoridades (obligación legal) y defender nuestros derechos (interés legítimo).',
      '• Con tu consentimiento, cuando la ley lo exija (por ejemplo, para las notificaciones del dispositivo). Puedes retirarlo en cualquier momento sin que afecte a lo ya hecho.',
      'No vendemos tus datos personales, no los compartimos con fines de publicidad dirigida y no usamos el contenido de tus mensajes para entrenar modelos de inteligencia artificial propios.',
    ] },
    { h: '4. Quién ve tu información dentro de CIFRA', p: [
      'Tus mensajes los ven las personas de la conversación. En un chat con un Negocio, además del cliente, pueden verlo las personas del equipo del Negocio con acceso según su rol.',
      'Tu nombre, foto de perfil, @usuario, biografía y portada se muestran a las personas con las que interactúas y, según tus ajustes, a quienes te busquen. Tu número de teléfono solo se muestra a quien comparte una conversación contigo, salvo que actives «ocultar teléfono». Puedes desactivar que te encuentren por número.',
      'Los estados los ven tus contactos; las publicaciones de un Negocio son visibles para sus clientes y, si el Negocio las hace públicas, para quien abra su perfil público.',
      'Las encuestas muestran los recuentos a los participantes del chat pero no quién votó cada opción. Quien las crea puede cerrarlas.',
    ] },
    { h: '5. Seguridad', p: [
      'Protegemos los datos con medidas técnicas y organizativas razonables: conexiones cifradas (HTTPS/TLS) entre tu dispositivo y nuestros servidores, cifrado en reposo de la base de datos y del almacenamiento por parte de nuestros proveedores, contraseñas con hash, políticas de acceso por filas en la base de datos (cada persona solo accede a lo que le corresponde), límites de frecuencia, registros de auditoría de decisiones de moderación y acceso restringido del personal.',
      'Importante: hoy CIFRA no ofrece cifrado de extremo a extremo. Esto significa que, aunque los datos viajan y se guardan cifrados, el servicio puede técnicamente acceder al contenido para funcionar (por ejemplo, para entregar un mensaje, generar una vista previa o procesar un reporte). Ningún sistema es totalmente invulnerable; si detectamos una brecha de seguridad que afecte a tus datos, te avisaremos y notificaremos a la autoridad cuando la ley lo exija.',
    ] },
    { h: '6. Con quién compartimos los datos', p: [
      'Solo compartimos datos personales en los casos siguientes:',
      '• Con otras personas del servicio, como se explica en el apartado 4.',
      '• Con proveedores que tratan datos por nuestra cuenta (encargados del tratamiento), bajo contrato y solo para prestarnos el servicio: proveedor de base de datos, autenticación y almacenamiento de archivos (Supabase); alojamiento y funciones de servidor (Netlify); envío de correos electrónicos de verificación y recuperación (Brevo); monitorización de errores (Sentry); inteligencia artificial para los asistentes (Anthropic); y los servicios de notificaciones de tu dispositivo o navegador (Apple, Google, Mozilla u otros).',
      '• Con autoridades, tribunales o terceros cuando la ley lo exija, para proteger la seguridad de las personas, para investigar abusos o fraude o para ejercer o defender derechos.',
      '• En operaciones societarias (fusión, adquisición o venta de activos), con salvaguardas equivalentes y avisándote si cambia el responsable de tus datos.',
      'Los proveedores pueden cambiar con el tiempo; mantenemos esta lista actualizada y te avisaremos de cambios importantes.',
    ] },
    { h: '7. Transferencias internacionales', p: [
      'Algunos de nuestros proveedores pueden tratar datos fuera del Espacio Económico Europeo, incluidos Estados Unidos. Cuando ocurra, nos aseguramos de que existan garantías adecuadas, como decisiones de adecuación de la Comisión Europea, cláusulas contractuales tipo y medidas complementarias cuando proceda. Puedes pedirnos más información sobre ellas.',
    ] },
    { h: '8. Cuánto tiempo conservamos los datos', p: [
      '• Cuenta y perfil: mientras tengas la cuenta. Al eliminarla borramos tu perfil, mensajes, estados, contactos, archivos y dispositivos de notificación, y los Negocios de los que seas único miembro. Los datos pueden permanecer en copias de seguridad cifradas durante un periodo limitado (no superior a 90 días) hasta que se sobrescriban.',
      '• Mensajes y archivos: hasta que tú o la otra persona los eliminéis, hasta que caduquen si hay un temporizador (mensajes temporales, chats incógnito) o hasta que se elimine la cuenta. Un mensaje eliminado se retira de la vista y se borra de nuestros sistemas; puede conservarse un breve tiempo por razones técnicas o de seguridad.',
      '• Estados y publicaciones: 24 horas (estados) o 7 días (publicaciones de Negocio), tras lo cual se eliminan.',
      '• Códigos de verificación por correo: caducan a los 10 minutos y se borran al usarse o superar los intentos permitidos.',
      '• Reportes y decisiones de moderación: mientras sean necesarios para proteger a las personas y a la plataforma, y por los plazos que exija la ley.',
      '• Registros técnicos y de errores: durante el tiempo estrictamente necesario para diagnosticar y mantener la seguridad (normalmente semanas o pocos meses).',
      '• Datos que debamos conservar por obligación legal o para defendernos de reclamaciones: durante los plazos legales aplicables, bloqueados y solo accesibles para esos fines.',
    ] },
    { h: '9. Tus derechos y cómo ejercerlos', p: [
      'Según la ley aplicable (por ejemplo, el Reglamento General de Protección de Datos de la UE y otras normas equivalentes), tienes derecho a:',
      '• Acceder a tus datos y obtener una copia.',
      '• Rectificar los datos inexactos (puedes editar tu perfil desde la app).',
      '• Suprimir tus datos («derecho al olvido»): puedes hacerlo tú mismo desde Ajustes → Eliminar mi cuenta.',
      '• Limitar u oponerte al tratamiento basado en el interés legítimo.',
      '• Portabilidad: recibir los datos que nos diste en un formato estructurado y de uso común, cuando proceda.',
      '• Retirar el consentimiento en cualquier momento, cuando sea la base del tratamiento.',
      '• No ser objeto de decisiones basadas únicamente en tratamientos automatizados con efectos jurídicos significativos. No tomamos decisiones de ese tipo; las suspensiones de cuenta pasan por revisión humana.',
      `Para ejercer tus derechos escríbenos mediante ${contactLine('es')}. Podemos pedirte que verifiques tu identidad. Responderemos en el plazo legal (normalmente, un mes).`,
      'Si crees que tratamos tus datos de forma incorrecta, tienes derecho a presentar una reclamación ante la autoridad de protección de datos de tu país o de la sede de nuestro establecimiento.',
      'Si tus datos están en la ficha de CRM de un Negocio, dirígete primero al Negocio, que es su responsable; nosotros le ayudaremos a atender tu solicitud.',
    ] },
    { h: '10. Privacidad de las demás personas y tus herramientas de control', p: [
      'Puedes bloquear a cualquier persona (no podrá escribirte ni llamarte), reportar contactos o Negocios, decidir si te pueden encontrar por número de teléfono, ocultar tu número, silenciar chats, usar mensajes temporales y chats incógnito, proteger la app con un PIN y cerrar sesión en tus dispositivos.',
      'Respeta la privacidad de los demás: no compartas capturas, datos o conversaciones de otras personas sin su permiso ni uses la información de CIFRA contra la ley.',
    ] },
    { h: '11. Notificaciones, almacenamiento local y cookies', p: [
      'CIFRA no usa cookies publicitarias ni de seguimiento de terceros. Usa el almacenamiento del navegador o del dispositivo (por ejemplo, almacenamiento local, bases de datos locales y el «service worker» de la aplicación instalable) para mantener tu sesión, recordar ajustes (idioma, tema, icono elegido, estados vistos), guardar borradores y permitir el funcionamiento sin conexión y las notificaciones. Es necesario para que el servicio funcione y no sirve para rastrearte entre sitios. Puedes borrar estos datos desde tu navegador, aunque cerrarán tu sesión.',
      'Si activas las notificaciones, guardamos la suscripción de tu dispositivo para enviarte avisos; puedes desactivarlas en Ajustes o en tu dispositivo, y eliminamos la suscripción.',
    ] },
    { h: '12. Información para Negocios: nuestro papel como encargado', p: [
      'Cuando un Negocio usa CIFRA para comunicarse con sus clientes y gestionar su CRM, agenda, catálogo y difusiones, trata datos personales de sus clientes como responsable del tratamiento. CIFRA los trata como encargado, únicamente para prestar el servicio y siguiendo las instrucciones documentadas del Negocio (las funciones que el propio Negocio usa), aplicando las medidas de seguridad descritas, ayudándole a atender los derechos de las personas, informándole de brechas de seguridad, no usándolos para fines propios y eliminándolos o devolviéndolos cuando termine el servicio. Estos Términos y esta Política forman el acuerdo de encargo con el Negocio, y podemos firmar un acuerdo adicional si lo necesita.',
      'El Negocio debe informar a sus clientes de cómo trata sus datos, disponer de una base jurídica para ello y para las difusiones y comunicaciones comerciales, y no introducir datos que no pueda tratar legalmente.',
    ] },
    { h: '13. Asistentes de inteligencia artificial', p: [
      'Cuando usas Maestro CIFRA o Doer, enviamos tu consulta, el historial reciente de esa conversación con el asistente y el contexto mínimo necesario (como la lista de nombres de tus clientes en Doer) a nuestro proveedor de modelos de lenguaje para generar la respuesta. No enviamos el resto de tus conversaciones. El proveedor trata esos datos como encargado nuestro y no los usa para entrenar sus modelos según las condiciones aplicables a nuestro uso. Puedes dejar de usar los asistentes en cualquier momento; evita incluir datos sensibles en tus consultas.',
    ] },
    { h: '14. Menores', p: [
      'CIFRA no está dirigido a menores de 16 años (o de la edad mínima de consentimiento digital que corresponda en tu país). No recopilamos conscientemente datos de menores por debajo de esa edad. Si descubrimos que lo hemos hecho, eliminaremos la cuenta y sus datos. Si eres madre, padre o tutor y crees que un menor nos ha dado datos, contáctanos.',
    ] },
    { h: '15. Cambios en esta Política', p: [
      'Podemos actualizar esta Política. Indicaremos arriba la fecha de la versión vigente y, si el cambio es importante, te avisaremos dentro de la app o por otro medio razonable antes de que se aplique.',
    ] },
    { h: '16. Contacto', p: [
      `Responsable: ${o.full}.`,
      `Para cualquier duda o solicitud de privacidad: ${contactLine('es')}.`,
    ] },
  ],
};

import { COMPANY, Doc, contactLine, operator } from './company';

const o = operator('es');
const law = COMPANY.law.es.trim();

export const termsEs: Doc = {
  title: 'Términos de uso',
  intro: [
    `Estos Términos de uso («Términos») regulan el uso de CIFRA, la aplicación de mensajería con un espacio Personal y un espacio Business que ofrece ${o.full} («CIFRA», «nosotros»). Al crear una cuenta o usar CIFRA aceptas estos Términos y nuestra Política de privacidad. Si no estás de acuerdo, no uses el servicio.`,
    'Hemos intentado escribirlos con claridad. Los títulos son orientativos y no limitan el contenido de cada apartado.',
  ],
  sections: [
    { h: '1. Qué es CIFRA', p: [
      'CIFRA es un servicio de mensajería para personas y negocios. Incluye chats individuales y de grupo, llamadas de voz y vídeo, estados (publicaciones de 24 horas), notas de voz, archivos, chats incógnito, mensajes temporales, encuestas, un asistente de ayuda y, en el espacio Business, bandeja de clientes, agenda, CRM, catálogo, publicaciones, difusiones, respuestas rápidas, un perfil público y un asistente que ejecuta tareas (Doer).',
      'El servicio se ofrece como aplicación web instalable (PWA) y puede ofrecerse también como aplicación para iOS y Android. Algunas funciones pueden variar según el dispositivo, el navegador o la versión.',
    ] },
    { h: '2. Definiciones', p: [
      '• «Servicio»: CIFRA y todas sus funciones, sitios web, aplicaciones y comunicaciones asociadas.',
      '• «Usuario» o «tú»: la persona que usa CIFRA.',
      '• «Contenido»: todo lo que envías, subes, publicas o compartes (mensajes, fotos, vídeos, audios, archivos, estados, publicaciones, encuestas, nombres, imágenes de perfil, catálogos, notas, etc.).',
      '• «Negocio»: una cuenta de empresa, autónomo u organización creada en el espacio Business.',
      '• «Cliente»: persona que se comunica con un Negocio o figura en su CRM.',
    ] },
    { h: '3. Quién puede usar CIFRA', p: [
      'Debes tener al menos 16 años (o la edad mínima legal para consentir el tratamiento de tus datos en tu país, si es mayor) y capacidad para aceptar estos Términos. Si usas CIFRA en nombre de una empresa, declaras que tienes autoridad para obligarla.',
      'No puedes usar CIFRA si te hemos suspendido o prohibido el acceso, si la ley te lo impide o si usarías el servicio desde un país sujeto a sanciones que lo prohíban.',
      'Si eres madre, padre o tutor y crees que un menor de la edad mínima usa CIFRA, escríbenos por los canales del apartado de contacto y eliminaremos la cuenta.',
    ] },
    { h: '4. Tu cuenta', p: [
      'Te registras con tu número de teléfono, tu nombre y una contraseña. Debes darnos información veraz y mantenerla actualizada. Solo puede haber una cuenta por número de teléfono y debes ser la persona que lo controla.',
      'Eres responsable de la actividad realizada desde tu cuenta y de mantener tu contraseña y tu código de recuperación en secreto. Avísanos sin demora si crees que alguien accede a tu cuenta sin permiso.',
      'Puedes añadir un correo de recuperación verificado y crear un código de recuperación de un solo uso desde Ajustes → Seguridad de la cuenta. Si olvidas tu contraseña y no dispones de ninguno de los dos, no podremos recuperar tu cuenta, porque no podemos verificar de otro modo que eres tú.',
      'Puedes cerrar sesión en cualquier momento y eliminar tu cuenta desde Ajustes → Eliminar mi cuenta (ver apartado 20).',
    ] },
    { h: '5. Uso aceptable', p: [
      'Para que CIFRA sea un lugar seguro, te comprometes a no hacer ni permitir lo siguiente:',
      '• Enviar spam, publicidad no solicitada, cadenas, mensajes masivos o comunicaciones comerciales sin el consentimiento exigido por la ley.',
      '• Acosar, amenazar, intimidar, difamar, humillar o discriminar a otras personas, ni incitar al odio o a la violencia por motivos de origen, raza, religión, sexo, orientación sexual, discapacidad, edad u otras características protegidas.',
      '• Publicar o enviar contenido sexual explícito no consentido, contenido que sexualice a menores (que denunciaremos a las autoridades) o contenido que muestre violencia extrema.',
      '• Hacerte pasar por otra persona, empresa o entidad, ni usar datos de identidad ajenos.',
      '• Cometer o facilitar fraude, estafas, suplantación, «phishing», blanqueo de capitales o la venta de bienes o servicios ilegales.',
      '• Vulnerar derechos de propiedad intelectual, secretos comerciales, privacidad o imagen de terceros.',
      '• Subir malware o código dañino, o intentar acceder sin permiso a cuentas, sistemas o datos; sondear, escanear o probar vulnerabilidades sin nuestra autorización escrita.',
      '• Interferir con el servicio: sobrecargarlo, automatizar el registro de cuentas o el envío de mensajes, recopilar datos de otros usuarios de forma masiva («scraping»), descompilar el código salvo donde la ley lo permita, o eludir límites técnicos, bloqueos o medidas de seguridad.',
      '• Usar CIFRA para recopilar o tratar datos personales de otras personas de forma contraria a la ley aplicable.',
      '• Usar el servicio para fines que la ley prohíba o que pongan en riesgo la seguridad de las personas.',
      'Podemos aplicar límites razonables (por ejemplo, de envíos por hora o de difusiones por día) para proteger el servicio y a sus usuarios.',
    ] },
    { h: '6. Tu contenido y los permisos que nos das', p: [
      'Tu contenido es tuyo. No reclamamos su propiedad. Eres responsable de él y garantizas que tienes los derechos necesarios para enviarlo y que no infringe la ley ni derechos de terceros.',
      'Para poder prestarte el servicio nos concedes una licencia mundial, no exclusiva, gratuita y limitada para alojar, almacenar, transmitir, procesar técnicamente (por ejemplo, redimensionar imágenes, comprimir vídeos o generar vistas previas de enlaces), mostrar a los destinatarios que elijas y copiar tu contenido, únicamente para operar, mantener y mejorar la seguridad y el funcionamiento de CIFRA. La licencia termina cuando el contenido se elimina, salvo las copias de seguridad y los casos descritos en la Política de privacidad.',
      'No usamos el contenido de tus mensajes para publicidad ni lo vendemos a terceros.',
      'Los estados, las publicaciones públicas de un Negocio, las fotos de perfil, las portadas y el perfil público de un Negocio pueden ser visibles para otras personas según los ajustes de visibilidad que elijas. Piensa antes de publicar.',
    ] },
    { h: '7. Mensajes, llamadas y funciones especiales', p: [
      'Los mensajes se entregan a los dispositivos de los destinatarios. Una vez entregado un mensaje, una persona puede copiarlo, reenviarlo o hacer una captura de pantalla; no podemos impedirlo ni controlarlo.',
      'Mensajes temporales: si activas un temporizador en un chat, los mensajes nuevos se ocultan y se eliminan de nuestros sistemas cuando caduca. No podemos garantizar que se eliminen de dispositivos ajenos, de copias que otra persona haya hecho (capturas, reenvíos, copias de seguridad del dispositivo) ni de archivos adjuntos ya descargados.',
      'Chats incógnito: se eliminan automáticamente tras un tiempo de inactividad o cuando ambas personas lo piden. Se aplican las mismas limitaciones que a los mensajes temporales.',
      'Mensajes eliminados: eliminar un mensaje lo retira del chat para los participantes, pero puede conservarse brevemente por razones técnicas o de seguridad.',
      'Llamadas: las llamadas de voz y vídeo usan tecnología de comunicación entre dispositivos (WebRTC) y, cuando hace falta, servidores de retransmisión. Puedes bloquear a quien te llame sin tu consentimiento. No uses CIFRA para llamadas de emergencia: no sustituye a un servicio telefónico y no garantiza la localización de la persona que llama.',
      'Encuestas: las respuestas son privadas (se ven los recuentos, no quién votó qué). Quien crea una encuesta es responsable de su contenido.',
      'Estados: los estados personales duran 24 horas y las publicaciones de Negocio, 7 días, tras los cuales dejan de mostrarse y se eliminan.',
    ] },
    { h: '8. Espacio Business', p: [
      'Si creas un Negocio eres su titular dentro de CIFRA. Eres responsable de la veracidad de su información (nombre, descripción, horarios, precios y catálogo), de las publicaciones, de las respuestas automáticas, de los mensajes de tu equipo y de cumplir la ley aplicable a tu actividad: consumo, publicidad, comercio electrónico, impuestos, protección de datos, etc.',
      'Equipo y roles: puedes invitar a otras personas con los roles de administrador, supervisor, agente o solo lectura. Quien tenga acceso podrá ver las conversaciones y los datos del Negocio según su rol. Eres responsable de lo que hagan las personas a las que das acceso y de retirarles el acceso cuando proceda. Las notas internas solo son visibles para el equipo.',
      'Clientes y datos personales: sobre los datos de tus clientes (conversaciones, fichas del CRM, citas, etiquetas, notas) tú eres, por regla general, el responsable del tratamiento y CIFRA actúa como encargado que los aloja y procesa siguiendo tus instrucciones, según se explica en la Política de privacidad. Debes informar a tus clientes de cómo tratas sus datos, tener una base jurídica para ello y atender sus derechos.',
      'Un Negocio no puede usar CIFRA para contactar con personas que no tengan relación con él, ni para vender, revender o ceder los datos de sus clientes.',
      'Si un Negocio tiene más personas en su equipo, no puedes eliminar tu cuenta mientras seas su propietario hasta traspasarlo o retirar al equipo.',
    ] },
    { h: '9. Difusiones y comunicaciones comerciales', p: [
      'La función de difusión permite a la dirección de un Negocio enviar un mensaje a clientes con cuenta de CIFRA. Solo puedes usarla para comunicaciones relacionadas con tu actividad que los destinatarios razonablemente esperen o hayan aceptado recibir, respetando la normativa de comunicaciones comerciales (por ejemplo, la de comercio electrónico y protección de datos) de los lugares donde estén los destinatarios.',
      'Cada difusión indica que lo es y ofrece un enlace para dejar de recibirlas. Respetamos esa baja y tú debes respetarla también por cualquier otro canal. Aplicamos límites (hoy, tres difusiones por Negocio cada 24 horas) y podemos reducirlos o suspender la función ante abusos.',
    ] },
    { h: '10. Enlaces, vistas previas y contenido de terceros', p: [
      'CIFRA puede mostrar vistas previas de enlaces (título, descripción e imagen de una página). Para generarlas, nuestros servidores consultan la página enlazada con restricciones de seguridad. No controlamos los sitios de terceros ni respondemos de su contenido o sus prácticas de privacidad; si sigues un enlace, lo haces bajo tu responsabilidad.',
      'Los perfiles, catálogos y publicaciones de Negocios son contenido de esos Negocios, no nuestro.',
    ] },
    { h: '11. Asistentes de inteligencia artificial', p: [
      'CIFRA incluye un asistente de ayuda («Maestro CIFRA») y, para Negocios, un asistente que propone y ejecuta tareas (Doer). Pueden apoyarse en modelos de inteligencia artificial de terceros. Cuando usas el asistente, el texto de tu consulta y el contexto mínimo necesario (por ejemplo, la lista de nombres de tus clientes para que Doer entienda a quién te refieres) se envían al proveedor del modelo para generar la respuesta.',
      'Las respuestas pueden ser incorrectas, incompletas o desactualizadas y no constituyen asesoramiento profesional (jurídico, fiscal, médico, financiero ni de otro tipo). Doer te muestra las acciones que propone y solo las ejecuta cuando las confirmas; revisa siempre lo que vas a aprobar. No introduzcas datos especialmente sensibles en consultas al asistente.',
    ] },
    { h: '12. Notificaciones', p: [
      'Si lo activas, te enviaremos notificaciones del sistema (por ejemplo, de mensajes nuevos o recordatorios de citas) mediante los servicios de notificaciones de Apple, Google, Mozilla u otros según tu dispositivo. Puedes activarlas o desactivarlas por separado para tu espacio Personal y para Business en Ajustes y en los ajustes de tu dispositivo. Por privacidad, en los chats incógnito la notificación no muestra el contenido.',
    ] },
    { h: '13. Moderación, reportes y bloqueos', p: [
      'Puedes bloquear a otras personas y reportar contactos, mensajes, Negocios o contenido que incumplan estos Términos. Revisamos los reportes y podemos retirar contenido, limitar funciones, suspender o cerrar cuentas, de forma temporal o definitiva, cuando incumplas estos Términos, cuando lo exija la ley o la seguridad de otras personas, o cuando una autoridad nos lo requiera.',
      'Siempre que sea razonable y legal, te informaremos del motivo de la medida y de cómo puedes responder o pedir su revisión escribiéndonos por los canales de contacto. Los chats son privados: no vigilamos de forma general el contenido de las conversaciones, pero podemos revisar el contenido que se nos reporte y actuar sobre él.',
      'Si creemos de buena fe que existe un riesgo para la vida o la integridad de una persona, o un delito, podremos comunicar la información necesaria a las autoridades competentes.',
    ] },
    { h: '14. Propiedad intelectual y avisos de infracción', p: [
      'CIFRA, su nombre, logotipos, diseño, software y contenidos propios están protegidos por derechos de propiedad intelectual e industrial y pertenecen a sus titulares. Te concedemos una licencia personal, limitada, revocable, no exclusiva e intransferible para usar el servicio conforme a estos Términos. No puedes copiar, modificar, distribuir, vender ni crear obras derivadas del servicio, salvo lo que permita la ley o una licencia de código abierto aplicable a ciertos componentes.',
      `Si crees que algún contenido de CIFRA infringe tus derechos (por ejemplo, de autor o de marca), comunícanoslo con tus datos de contacto, la identificación del contenido, la descripción de tu derecho y una declaración de buena fe, a través de ${contactLine('es')}. Retiraremos o bloquearemos el contenido manifiestamente infractor y podremos cerrar las cuentas de infractores reincidentes.`,
    ] },
    { h: '15. Servicios y proveedores de terceros', p: [
      'Para prestar CIFRA nos apoyamos en proveedores de infraestructura, base de datos y autenticación, alojamiento, correo electrónico, notificaciones, monitorización de errores e inteligencia artificial. Se describen en la Política de privacidad. Su uso puede estar sujeto además a sus propias condiciones (por ejemplo, las de tu navegador, tu sistema operativo o tu tienda de aplicaciones). Apple, Google u otros no son parte de estos Términos ni responsables del servicio.',
    ] },
    { h: '16. Disponibilidad, versión de pruebas y cambios en el servicio', p: [
      'Trabajamos para que CIFRA funcione de forma continua, pero no garantizamos que esté siempre disponible ni libre de errores. Puede haber interrupciones por mantenimiento, fallos de terceros o causas fuera de nuestro control.',
      'Mientras el servicio se indique como versión de pruebas («beta») puede haber cambios, errores, limitaciones o borrado de datos de prueba, y no debes confiarle información que no puedas perder. Haz copia de lo importante.',
      'Podemos añadir, modificar o retirar funciones, aplicar límites de uso o ofrecer planes de pago en el futuro. Si introducimos precios, te lo comunicaremos antes de cobrarte nada y no te cobraremos sin tu consentimiento expreso.',
    ] },
    { h: '17. Pagos', p: [
      'Hoy CIFRA no cobra por el uso del servicio y no procesa pagos entre personas o con Negocios. Si en el futuro se introducen pagos, suscripciones o comisiones, se regirán por condiciones adicionales que te mostraremos antes de que aceptes cualquier cobro. Las compras y pagos que un Negocio acuerde con sus clientes fuera de CIFRA son responsabilidad exclusiva de ambas partes.',
    ] },
    { h: '18. Garantías y límites de responsabilidad', p: [
      'El servicio se ofrece «tal cual» y «según disponibilidad». En la medida permitida por la ley, no damos garantías de que cubra tus necesidades concretas, funcione sin interrupciones o errores, ni de la exactitud del contenido de otras personas o de las respuestas de los asistentes.',
      'En la medida permitida por la ley, no seremos responsables de daños indirectos, lucro cesante, pérdida de datos, de clientes o de oportunidades, ni de daños derivados de contenido o conducta de otros usuarios o de terceros, de accesos no autorizados que no se deban a nuestra negligencia, o de causas de fuerza mayor.',
      'Nuestra responsabilidad total frente a ti por cualquier reclamación relacionada con el servicio se limitará, en la medida permitida por la ley, a lo que hayas pagado a CIFRA en los 12 meses anteriores al hecho o, si no has pagado nada, a 100 euros.',
      'Nada en estos Términos excluye ni limita la responsabilidad que no pueda excluirse o limitarse por ley, incluida la derivada de dolo o negligencia grave, de daños a la vida, la integridad física o la salud, ni los derechos irrenunciables que la normativa de consumidores te reconozca.',
    ] },
    { h: '19. Indemnidad', p: [
      'En la medida permitida por la ley, aceptas mantenernos indemnes frente a reclamaciones, daños y gastos razonables (incluidos honorarios de abogados) de terceros que deriven de tu contenido, de tu incumplimiento de estos Términos o de la ley, o del uso que hagas del servicio para tu actividad. Si eres consumidor, esta cláusula solo se aplica en los límites que permita la normativa de protección de consumidores.',
    ] },
    { h: '20. Terminación y eliminación de la cuenta', p: [
      'Puedes dejar de usar CIFRA cuando quieras y eliminar tu cuenta desde Ajustes → Eliminar mi cuenta. Te pediremos tu contraseña y una confirmación. Al eliminarla se borran tu perfil, tus mensajes, estados, contactos, dispositivos de notificación y los archivos que subiste, y los Negocios de los que seas único miembro. Las conversaciones compartidas continúan para las demás personas, sin tus mensajes. No se puede deshacer. Si eres propietario de un Negocio con equipo, debes antes traspasarlo o retirar al equipo.',
      'Podemos suspender o cerrar tu cuenta o restringir funciones si incumples estos Términos, si hay riesgo para otras personas o para el servicio, si lo exige la ley, o si llevas mucho tiempo sin usarla, avisándote cuando sea razonable. Los apartados que por su naturaleza deban sobrevivir (por ejemplo, propiedad intelectual, límites de responsabilidad y ley aplicable) seguirán vigentes tras la terminación.',
    ] },
    { h: '21. Cambios en estos Términos', p: [
      'Podemos actualizar estos Términos para reflejar cambios del servicio, de la ley o de nuestras prácticas. Si el cambio es importante te avisaremos dentro de la app o por otro medio razonable antes de que entre en vigor. Si sigues usando CIFRA después de esa fecha, entenderemos que aceptas la nueva versión; si no estás de acuerdo, puedes dejar de usar el servicio y eliminar tu cuenta.',
    ] },
    { h: '22. Ley aplicable y resolución de conflictos', p: [
      law
        ? `Estos Términos se rigen por la ley de ${law}, sin perjuicio de las normas imperativas de protección del consumidor del país donde residas, que seguirán aplicándose si te son más favorables. Los tribunales competentes serán los que correspondan conforme a la ley aplicable; si eres consumidor, podrás acudir también a los tribunales de tu país de residencia.`
        : 'Estos Términos se rigen por la ley del país donde esté establecido el titular del servicio, sin perjuicio de las normas imperativas de protección del consumidor del país donde residas, que seguirán aplicándose si te son más favorables. Si eres consumidor, podrás acudir también a los tribunales de tu país de residencia.',
      'Antes de acudir a un tribunal te animamos a escribirnos para intentar resolver el conflicto de buena fe. Si resides en la Unión Europea, también puedes usar los mecanismos de resolución de litigios en línea y las autoridades de consumo de tu país.',
    ] },
    { h: '23. Disposiciones generales', p: [
      'Si alguna parte de estos Términos resulta inválida o inaplicable, el resto seguirá vigente. Que no ejerzamos un derecho no significa que renunciemos a él. No puedes ceder tus derechos u obligaciones sin nuestro consentimiento; nosotros podemos cederlos a una entidad que continúe el servicio, informándote. Estos Términos y la Política de privacidad son el acuerdo completo entre tú y nosotros sobre el servicio. Podemos ofrecértelos en varios idiomas; en caso de discrepancia, prevalece la versión en español salvo que la ley exija otra cosa.',
    ] },
    { h: '24. Contacto', p: [
      `Responsable del servicio: ${o.full}.`,
      `Para consultas, reportes, solicitudes legales o de privacidad, escríbenos mediante ${contactLine('es')}.`,
    ] },
  ],
};

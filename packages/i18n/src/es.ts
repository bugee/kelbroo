import type { Dictionary } from './dictionary';

/**
 * Hiszpański.
 *
 * Forma grzecznościowa: **tú**, nie „usted" — w hiszpańskiej komunikacji
 * biznesowej dla małych firm „usted" brzmi dziś urzędowo i dystansująco.
 * „Comanda" to słowo z kuchni na bon; „ticket" znaczyłoby paragon dla gościa.
 */
export const es: Dictionary = {
  meta: {
    tytul: 'kelbroo — self-service dining',
    opis: 'Los clientes piden desde el móvil tras escanear el código QR de la mesa. El pedido llega directo a la cocina y al camarero. Cuota fija mensual, sin comisión por pedido.',
    ogOpis:
      'Los clientes piden desde el móvil tras escanear el código QR de la mesa. Sin comisión por pedido.',
  },
  nav: {
    jak: 'Cómo funciona',
    modele: 'Pagos',
    funkcje: 'Funciones',
    cennik: 'Precios',
    faq: 'FAQ',
    zaloguj: 'Iniciar sesión',
    wyprobuj: 'Prueba 14 días',
    stronaGlowna: 'kelbroo — inicio',
    jezyk: 'Idioma',
  },
  hero: {
    eyebrow: 'Self-service dining',
    naglowekPrzed: 'Los clientes piden desde el móvil. Los camareros vuelven ',
    naglowekAkcent: 'a la sala',
    lede: 'kelbroo convierte el código QR de la mesa en una carta completa, un pedido y una cuenta. Sin app que descargar, sin registro del cliente y sin tocar tu caja registradora.',
    ctaGlowne: 'Empieza 14 días gratis',
    ctaDrugie: 'Ver la carta de demostración',
    notatkaMocna: 'Sin tarjeta.',
    notatka: 'En marcha en un día.',
    scenaOpis: 'Vista previa: el pedido del cliente llega a la comanda de cocina',
  },
  makieta: {
    lokal: 'Bistró del Río',
    stolik: 'Mesa 12',
    dania: [
      { nazwa: 'Sopa de masa madre', opis: 'huevo, salchicha blanca', cena: '5,60' },
      { nazwa: 'Empanadillas de patata', opis: '8 uds., cebolla frita', cena: '7,40' },
      { nazwa: 'Tarta de queso vienesa', opis: 'salsa de frambuesa', cena: '4,40' },
    ],
    zamawiam: 'Pedir',
    waluta: '€',
    bon: 'COMANDA DE COCINA',
    godzina: '18:42',
    stolikBon: 'MESA 12',
    bezCebulki: 'sin cebolla',
    poz: 'uds.',
    stempel: 'A COCINA',
  },
  segmenty: {
    restauracje: 'Restaurantes',
    kawiarnie: 'Cafeterías',
    bary: 'Bares y pubs',
    hotele: 'Hoteles',
    sieci: 'Cadenas y food courts',
  },
  statystyki: [
    { liczba: '0 %', opis: 'de comisión por pedido: solo pagas la cuota' },
    { liczba: '0 instalaciones', opis: 'el cliente escanea el código y pide en el navegador' },
    { liczba: '6 idiomas', opis: 'la carta traducida para clientes extranjeros' },
    { liczba: '1 día', opis: 'desde el alta hasta el primer pedido' },
  ],
  kroki: {
    eyebrow: 'En la mesa',
    naglowek: 'Cuatro pasos y ningún pedido copiado a mano',
    lede: 'El pedido va directo del móvil del cliente a la pantalla de cocina. Nadie apunta nada en un papel y nadie confunde las mesas.',
    pozycje: [
      {
        krok: 'PASO 01',
        tytul: 'El cliente escanea el código',
        tresc:
          'El código QR de la mesa abre la carta en el navegador. Sin descargar una app, sin crear una cuenta.',
      },
      {
        krok: 'PASO 02',
        tytul: 'Y hace su pedido',
        tresc:
          'Elige platos, extras y comentarios, y ve alérgenos, fotos y tiempos de preparación — en español o en su idioma.',
      },
      {
        krok: 'PASO 03',
        tytul: 'La cocina ve la comanda',
        tresc:
          'El pedido aparece en la pantalla de cocina con el número de mesa y un contador. El camarero puede confirmarlo antes en la mesa.',
      },
      {
        krok: 'PASO 04',
        tytul: 'El camarero sirve',
        tresc:
          'Los platos terminados pasan a la lista «para servir». El camarero los lleva a la mesa y cierra la cuenta.',
      },
    ],
  },
  modele: {
    eyebrow: 'Nada cambia para ti',
    naglowek: 'Los clientes piden desde el móvil y pagan al camarero, como siempre',
    lede: 'El temor más habitual es: «no quiero cambiar la forma de cobrar ni mi caja registradora». No hace falta. kelbroo cambia cómo se pide y deja el cobro exactamente donde está hoy.',
    kartaTag: 'Sin comisiones por transacción',
    kartaTytul: 'Pago al camarero',
    kartaLede:
      'Los clientes solo piden desde el móvil. Todo lo de la visita se suma en una cuenta que el camarero cobra después de la comida — en tu caja y con tu datáfono.',
    zalety: [
      'Emites el ticket como hasta ahora, sin integrar la caja',
      'Cero comisión de pasarela de pago',
      'El camarero puede confirmar cada pedido en la mesa',
      'Informe de cierre de turno para cada camarero',
    ],
    przygotowujemy:
      'El pago del cliente desde la app está en preparación: hoy el cobro sigue en manos del camarero.',
  },
  podzial: {
    eyebrow: 'Se acabaron las discusiones por la cuenta',
    naglowek: 'Todos escanean el mismo código y cada uno paga lo suyo',
    lede: 'Los clientes de una misma mesa se unen a una visita compartida: cada uno recibe un apodo y una marca, y quien quiera escribe su propio nombre. Sin crear cuenta. Después pagan por separado, por artículos, en grupos o a partes iguales — una botella compartida la divide el camarero con un toque.',
    zestawienie:
      'Cuando paga una sola persona, cada uno puede enviarse por correo el resumen de «quién pidió qué», listo para justificar gastos.',
    ctaFunkcje: 'Ver todas las funciones',
    rachunekTytul: 'Cuenta de la mesa',
    rachunekPodpis: 'MESA 12 · 4 personas',
    goscie: [
      { nick: 'Tejón Alegre', dania: 'Sopa, empanadillas', kwota: '13,00 €' },
      { nick: 'Erizo Veloz', dania: 'Escalope, compota', kwota: '14,40 €' },
      { nick: 'Búho Nocturno', dania: 'Tarta de queso, espresso', kwota: '7,20 €' },
      { nick: 'Dividido entre 3', dania: 'Vino de la casa, jarra', kwota: '16,00 €' },
    ],
    razem: 'TOTAL',
    razemKwota: '50,60 €',
  },
  funkcje: {
    eyebrow: 'En todos los planes',
    naglowek: 'Todo lo que necesitan la sala y la cocina',
    pozycje: [
      {
        tytul: 'Carta en varios idiomas',
        tresc:
          'El cliente recibe la carta en su idioma automáticamente. Si falta una traducción, siempre aparece el idioma principal del local: nunca una pantalla en blanco.',
      },
      {
        tytul: 'Pantalla de cocina (KDS)',
        tresc:
          'Columnas «nuevos / en preparación / listos», contador de tiempo y aviso sonoro. El pedido se vuelve rojo cuando lleva demasiado esperando.',
      },
      {
        tytul: 'Códigos QR para las mesas',
        tresc:
          'Los generas en el panel con tu logotipo y descargas una hoja A4 lista para imprimir: pegatinas, expositores o tarjetas.',
      },
      {
        tytul: 'Valoraciones y comentarios',
        tresc:
          'El cliente valora cada plato después de comer. Una crítica llega directamente al responsable, antes de acabar en una reseña pública.',
      },
      {
        tytul: 'Informes y analítica',
        tresc:
          'Qué platos se venden mejor, cuáles no pide nadie, cuándo tienes el pico y cuánto tarda un pedido en salir de cocina.',
      },
      {
        tytul: 'El camarero pide y corrige',
        tresc:
          'El personal puede hacer un pedido por el cliente y corregirlo. En el historial siempre se ve qué añadió el cliente y qué el camarero.',
      },
      {
        tytul: 'Cambio de mesa sin cerrar la cuenta',
        tresc:
          'Los clientes cambian de mesa con un toque: la cuenta, los pedidos y las comandas de cocina van con ellos. La mesa anterior queda libre al instante.',
      },
    ],
  },
  demo: {
    naglowek: 'Míralo con los ojos de un cliente',
    lede: 'Abre la carta del restaurante de demostración igual que lo haría un cliente tras escanear el código QR de la mesa. Sin cuenta y sin instalar nada: es la misma aplicación que recibe tu local.',
    drugi:
      'Podrás ver la carta en dos idiomas, añadir un plato al carrito y hacer un pedido. También verás cómo queda la cuenta compartida cuando hay varias personas en la mesa.',
    kodPodpis: 'Escanea con el móvil',
    kodPodpisStuknij: 'o toca aquí si lees desde el móvil',
    zastrzezenie:
      'Los pedidos de la demo no llegan a ninguna cocina. El panel de sala y el KDS los enseñamos en directo durante la presentación.',
    stolikTytul: 'Bistro Widok — mesa de demostración',
    pokazPanel: 'Enséñame la pantalla de cocina',
  },
  faq: {
    eyebrow: 'Preguntas de hosteleros',
    naglowek: 'Antes de que preguntes',
    pozycje: [
      {
        pytanie: '¿Los clientes tienen que instalar una app?',
        odpowiedz:
          'No. Escanear el código QR abre la carta en el navegador del móvil, como cualquier página web. El cliente no crea ninguna cuenta ni facilita correo o teléfono.',
      },
      {
        pytanie: '¿Tengo que aceptar pagos online?',
        odpowiedz:
          'No, y hoy ni siquiera puedes. Los clientes solo piden desde el móvil y pagan al camarero después de comer, exactamente como hasta ahora. No pagas comisiones por transacción y nada cambia en el circuito del efectivo de tu local.',
      },
      {
        pytanie: '¿Qué pasa con los tickets y la caja registradora?',
        odpowiedz:
          'En el modo de pago al camarero emites el ticket en tu propia caja, como siempre: kelbroo no interviene en absoluto en la facturación fiscal. Con pagos online existe integración con tu caja o impresora fiscal.',
      },
      {
        pytanie: '¿Esto sustituye a los camareros?',
        odpowiedz:
          'No. Les quita tomar comandas y correr a por el datáfono, así que tienen tiempo para lo que los clientes valoran de verdad: aconsejar, estar pendientes de la mesa, conversar. El camarero también puede hacer pedidos desde el panel.',
      },
      {
        pytanie: '¿Puede el camarero corregir el pedido de un cliente?',
        odpowiedz:
          'Sí. Puede añadir un artículo, cambiar la cantidad o reasignar un plato a otra persona de la mesa. Cada cambio queda registrado en el historial del pedido, así que siempre se ve qué añadió el cliente y qué el personal.',
      },
      {
        pytanie: '¿Necesito equipos nuevos?',
        odpowiedz:
          'Basta con cualquier tablet, portátil u ordenador con navegador. El panel de cocina y el de sala se abren en panel.kelbroo.com y funcionan igual en un iPad, en una tablet Android y en un ordenador.',
      },
      {
        pytanie: '¿Qué pasa si se cae internet?',
        odpowiedz:
          'kelbroo necesita conexión: sin internet ni los clientes ni el personal pueden hacer pedidos. Veréis un mensaje claro y no una pantalla en blanco. Si el wifi del local falla a menudo, conviene tener el móvil como conexión de reserva.',
      },
      {
        pytanie: '¿Cómo pago la suscripción?',
        odpowiedz:
          'Tras crear la cuenta eliges un plan en el panel y pagas con BLIK, transferencia o tarjeta, a través de PayU. Puedes pagar por mes o por año (dos meses más barato). Emitimos la factura con los datos indicados en la compra.',
      },
      {
        pytanie: '¿Cuánto tarda la puesta en marcha?',
        odpowiedz:
          'Configurar el local, cargar la carta e imprimir los códigos QR suele llevar un día. También podemos cargar la carta por ti dentro de una puesta en marcha llave en mano.',
      },
    ],
  },
  kontakt: {
    naglowek: 'Hablemos',
    lede: 'Escríbenos si tienes alguna duda, o reserva una presentación en la que mostramos el panel en directo y recorremos un pedido desde el escaneo del QR hasta la salida de cocina. Respondemos en un día laborable.',
    formularzTytul: '¿Prefieres escribir?',
    prezentacja: 'Reservar una presentación',
  },
  formularz: {
    sprawa: '¿De qué se trata?',
    celPytanie: 'Tengo una pregunta',
    celPrezentacja: 'Quiero una demo',
    imie: 'Nombre y apellidos',
    lokal: 'Local o empresa',
    email: 'Correo electrónico',
    telefon: 'Teléfono',
    nieobowiazkowo: 'Opcional',
    kiedy: 'Cuándo es mejor contactarte',
    kiedyPodpowiedz: 'Por ejemplo, martes y jueves antes de las 11. La demo dura unos 20 minutos.',
    wiadomosc: 'Mensaje',
    placeholderPrezentacja: '¿Cuántas mesas tenéis, cómo tomáis los pedidos hoy, qué queréis ver?',
    placeholderPytanie: '¿Qué quieres preguntar?',
    pulapka: 'No rellenes este campo',
    wysylam: 'Enviando…',
    umowPrezentacje: 'Reservar demo',
    wyslijWiadomosc: 'Enviar mensaje',
    zgodaAdres: 'Usaremos tu dirección únicamente para responder a este mensaje. Más detalles en la',
    politykaLink: 'política de privacidad',
    wyslaneTytul: 'Mensaje enviado',
    wyslaneTresc: 'Te responderemos en un día laborable. Hemos enviado una confirmación a la dirección indicada; si no ha llegado, revisa la carpeta de spam.',
    bladOgolny: 'No se ha podido enviar el mensaje.',
  },
  finalCta: {
    naglowek: 'Tu primer pedido de mesa hoy mismo',
    lede: 'Crea la cuenta, añade mesas y carta, imprime los códigos QR. 14 días del plan Pro sin coste y sin tarjeta.',
    przycisk: 'Empieza 14 días gratis',
    notatka: 'Sin tarjeta · sin permanencia · sin comisión por pedido',
  },
  stopka: {
    opis: 'Self-service dining. Los clientes piden desde el móvil y el personal vuelve a la sala.',
    produkt: 'Producto',
    dlaKogo: 'Para quién',
    firma: 'Empresa',
    prawne: 'Documentos',
    regulamin: 'Términos del servicio',
    prywatnosc: 'Privacidad',
    rodo: 'RGPD',
    statystyki: 'Consentimiento de estadísticas',
    pomoc: 'Centro de ayuda',
    kontakt: 'Contacto',
    daneFirmy: 'Datos de la empresa',
    demoMenu: 'Carta de demostración',
    platnoscUKelnera: 'Pago al camarero',
    prawa: 'Todos los derechos reservados.',
    warunki:
      'La colaboración se rige por los términos del servicio y el tratamiento de datos por la política de privacidad.',
  },
  strony: {
    dlaKogo: {
      tytul: 'Para quién es kelbroo — restaurantes, cafeterías, bares, hoteles, cadenas',
      opis: 'Qué cambia el pedido desde el móvil en un restaurante con camareros, en una cafetería, en un bar, en un hotel y en una cadena.',
    },
    rejestracja: {
      tytul: 'Crear una cuenta — kelbroo',
      opis: '14 días del plan Pro, gratis y sin datos de tarjeta.',
    },
    potwierdz: { tytul: 'Confirmar la dirección — kelbroo' },
    regulamin: {
      tytul: 'Términos del servicio — kelbroo',
      opis: 'Las condiciones en las que se presta kelbroo a los locales de hostelería.',
    },
    prywatnosc: {
      tytul: 'Política de privacidad — kelbroo',
      opis: 'Qué datos trata kelbroo, en qué papel y durante cuánto tiempo.',
    },
  },
  dlaKogo: {
    naglowek: 'Para quién es kelbroo',
    lede: 'El mismo producto resuelve un problema distinto en cada local. Abajo tienes cinco situaciones en las que lo hemos visto funcionar, cada una con la objeción que más nos repiten.',
    nawigacja: 'Tipos de local',
    cudzyslow: ['«', '»'],
    segmenty: [
      {
        id: 'restauracje',
        nazwa: 'Restaurantes con camareros',
        kogo: 'Camareros en las mesas, una carta con más de diez platos, noches con la sala llena.',
        obiekcja: {
          pytanie: '¿Esto significa que tengo que cambiar cómo cobro?',
          odpowiedz:
            'No. Puedes mantener exactamente el circuito que tienes hoy: el cliente pide desde el móvil y paga al camarero después de comer, en tu terminal y tu caja. En este modo no hay ninguna comisión por transacción; solo pagas la suscripción.',
        },
        korzysci: [
          {
            tytul: 'El camarero deja de correr a por comandas',
            opis: 'La comanda va de la mesa directa a la pantalla de cocina. Tu equipo se queda con aquello por lo que los clientes de verdad valoran el local: aconsejar y estar pendiente de la mesa.',
          },
          {
            tytul: 'Puedes aprobar cada pedido',
            opis: 'Si prefieres que nada llegue a cocina sin un camarero, activa la confirmación en mesa. El pedido espera en la cola hasta que el equipo lo acepte.',
          },
          {
            tytul: 'Una cuenta por mesa, aunque haya seis móviles',
            opis: 'Todos en la mesa suman a una cuenta común y ven quién ha pedido qué. Al final la dividís por personas, por platos o a partes iguales.',
          },
        ],
        akcja: 'demo',
        ctaEtykieta: 'Verlo con los ojos del cliente',
      },
      {
        id: 'kawiarnie',
        nazwa: 'Cafeterías y locales de barra',
        kogo: 'Rotación rápida, cola en la barra, dos personas por turno.',
        obiekcja: {
          pytanie: 'Tengo una carta corta y dos personas por turno, ¿no es un sistema demasiado grande?',
          odpowiedz:
            'La puesta en marcha es de un día: metes la carta, imprimes los códigos QR y ya está. El plan Starter cubre hasta 12 mesas. También puedes empezar solo con la carta digital, sin pedidos.',
        },
        korzysci: [
          {
            tytul: 'El cliente pide desde la mesa, no desde la cola',
            opis: 'La cola en la barra deja de ser el cuello de botella en las horas punta, y quien está en la máquina no se interrumpe cada minuto para tomar una comanda.',
          },
          {
            tytul: 'Cambiar la carta lleva un minuto',
            opis: '¿Se ha acabado la tarta? Desactivas el plato en el panel y desaparece al instante de la carta de todos. Sin reimprimir nada.',
          },
          {
            tytul: 'Los códigos QR los imprimes tú',
            opis: 'El panel genera una hoja para una impresora normal. Nada que encargar ni que esperar.',
          },
        ],
        akcja: 'cennik',
        ctaEtykieta: 'Ver los precios',
      },
      {
        id: 'bary',
        nazwa: 'Bares y pubs',
        kogo: 'Noches ruidosas, muchas repeticiones, cuentas que se dividen al final.',
        obiekcja: {
          pytanie: 'En mi local por la noche nadie se va a poner con el móvil.',
          odpowiedz:
            'Suele pasar lo contrario: con la música alta, gritar la comanda es la mayor incomodidad de la noche. La siguiente ronda entra con un toque y el camarero no tiene que volver dos veces a por nada.',
        },
        korzysci: [
          {
            tytul: 'Repetir sin buscar al camarero',
            opis: 'Lo mismo que la última vez, con un toque, y llamar al camarero es un clic con aviso visible de que ya viene.',
          },
          {
            tytul: 'La cuenta se divide sola',
            opis: 'Al final de la noche cada uno ve lo que ha pedido. División por platos, por personas o a partes iguales, sin cuentas en una servilleta.',
          },
          {
            tytul: 'Límite de la cuenta abierta',
            opis: 'Fijas el importe a partir del cual una mesa tiene que pagar antes de seguir pidiendo. La noche no acaba con sorpresas.',
          },
        ],
        akcja: 'demo',
        ctaEtykieta: 'Verlo con los ojos del cliente',
      },
      {
        id: 'hotele',
        nazwa: 'Hoteles',
        kogo: 'Desayunos, restaurante del hotel, clientes que hablan varios idiomas.',
        obiekcja: {
          pytanie: 'La mitad de mis clientes no habla el idioma del país.',
          odpowiedz:
            'Mantienes la carta en varios idiomas a la vez y cada cliente recibe el suyo según los ajustes de su móvil. Una traducción que falte nunca deja la pantalla en blanco: mostramos el idioma por defecto del local.',
        },
        korzysci: [
          {
            tytul: 'Carta multilingüe sin cartas separadas',
            opis: 'Una carta, varias versiones de idioma. Un precio cambiado en un sitio pasa a todas.',
          },
          {
            tytul: 'Alérgenos e ingredientes en cada plato',
            opis: 'El cliente lo comprueba solo, sin preguntar al equipo y sin que recepción traduzca.',
          },
          {
            tytul: 'Códigos QR allí donde haya una mesa',
            opis: 'Restaurante, lobby, terraza. Cada mesa tiene su código, así que se sabe de inmediato adónde llevar el pedido.',
          },
        ],
        akcja: 'prezentacja',
        ctaEtykieta: 'Reservar demo',
      },
      {
        id: 'sieci',
        nazwa: 'Cadenas y food courts',
        kogo: 'Varios locales bajo una marca, informes comunes, procedimientos propios.',
        obiekcja: {
          pytanie: 'Tenemos nuestro propio TPV y procedimientos que no vamos a cambiar.',
          odpowiedz:
            'De eso hablamos antes de la implantación, no después. Las implantaciones en cadena las llevamos una a una, con integración por vuestro lado, precio conjunto y una persona de contacto. El plan Enterprise se presupuesta según el alcance.',
        },
        korzysci: [
          {
            tytul: 'Una implantación guiada por una persona',
            opis: 'Cargar la carta, imprimir y colocar los códigos, formar al equipo. No dejamos a una cadena sola con un panel y un manual.',
          },
          {
            tytul: 'Una carta, muchos locales',
            opis: 'El alcance y el reparto se acuerdan en la implantación: no es lo mismo un food court que una cadena con una sola carta para todos los puntos.',
          },
          {
            tytul: 'Una conversación antes de la firma',
            opis: 'Enseñamos el panel en directo y recorremos vuestro escenario antes de que contratéis nada.',
          },
        ],
        akcja: 'prezentacja',
        ctaEtykieta: 'Reservar demo',
      },
    ],
    band: {
      naglowek: '¿No está aquí tu local?',
      tresc: 'Cuéntanos cómo tomáis los pedidos hoy. Te diremos claramente si kelbroo cambia algo o no merece la pena.',
      napisz: 'Escríbenos',
      zacznij: 'Empezar gratis',
      drobne: '14 días del plan Pro, gratis y sin datos de tarjeta',
    },
  },
  rejestracjaStrona: {
    naglowek: 'Crear una cuenta',
    lede: '14 días del plan Pro, gratis y sin datos de tarjeta. Creas la cuenta para un local; los demás los añades después.',
  },
  rejestracjaForm: {
    nazwaLokalu: 'Nombre del local',
    imie: 'Nombre y apellidos',
    nip: 'NIF polaco (NIP)',
    nipPodpowiedz: 'Diez cifras. El servicio es solo para empresas.',
    email: 'Correo electrónico',
    haslo: 'Contraseña',
    hasloPodpowiedz: 'Al menos {min} caracteres.',
    bledy: {
      nazwaLokalu: 'Indica el nombre del local.',
      imie: 'Indica tu nombre y apellidos.',
      email: 'Esto no parece una dirección de correo válida.',
      haslo: 'La contraseña debe tener al menos {min} caracteres.',
      nip: 'Revisa el NIF: esas cifras no cuadran.',
    },
    zgodaRegulamin: 'Acepto los {link} de kelbroo.',
    zgodaPrywatnosc: 'He leído la {link}.',
    zakladam: 'Creando la cuenta…',
    zacznij: 'Empezar 14 días gratis',
    bladOgolny: 'No se ha podido crear la cuenta. Inténtalo de nuevo.',
    sukcesTytul: 'Revisa tu correo',
    sukcesKonto: 'La cuenta de «{nazwa}» está creada. Hemos enviado un mensaje a:',
    sukcesKlik: 'Pulsa el enlace del mensaje para confirmar la dirección y entrar en el panel.',
    sukcesSpam: '¿No ha llegado el mensaje? Mira en la carpeta de spam o escribe a kontakt@kelbroo.com.',
  },
  potwierdzenie: {
    sprawdzam: 'Comprobando el enlace…',
    bladNiekompletny: 'Este enlace está incompleto.',
    bladOgolny: 'No se ha podido confirmar la dirección.',
    gotoweTytul: 'Dirección confirmada',
    gotoweTresc: 'Ya puedes entrar en el panel y añadir los primeros platos de la carta.',
    doPanelu: 'Ir al panel',
    nieudaneTytul: 'No se ha podido confirmar',
    ponowioneInfo: 'Si existe una cuenta con esa dirección, ya le hemos enviado un enlace nuevo.',
    etykietaPonow: 'Te enviaremos un enlace nuevo',
    placeholderEmail: 'correo electrónico de la cuenta',
    wyslijPonownie: 'Enviar de nuevo',
  },
  zgoda: {
    tytul: 'Estadísticas de visitas.',
    tresc:
      'Queremos saber qué partes de esta página se leen: nos ayuda a mejorarla. Sin tu consentimiento no cargamos ningún script de analítica.',
    drobne: 'Solo esta página. La aplicación para clientes no tiene analítica, y no la tendrá.',
    tak: 'Acepto',
    nie: 'No, gracias',
    wyslane: 'Más detalles en la política de privacidad.',
  },
  cennik: {
    eyebrow: 'Precios',
    naglowek: 'Cuota fija. Sin comisión por pedido.',
    lede: 'Pagas por local, no por facturación. Precios sin IVA: se añade en el momento del pago.',
    miesiecznie: 'Mensual',
    rocznie: 'Anual −17 %',
    zaMiesiac: '/ mes',
    rozliczenieMiesieczne: 'facturación mensual',
    rozliczenieRoczne: '{kwota} al año',
    naZawsze: 'gratis para siempre',
    wycena: 'presupuesto a medida',
    najlepszy: 'El más elegido',
    oszczednoscMiesiecznie: 'Pagando al año ahorras un 17 %: dos meses gratis.',
    oszczednoscRocznie: 'Facturación anual: dos meses gratis incluidos.',
    notatki: [
      { tytul: 'Descuentos para cadenas:', tresc: '3–9 locales −15 %, 10+ locales −25 %' },
      { tytul: 'Extras:', tresc: '+10 mesas 12 € · idioma adicional 9 €' },
      { tytul: 'Todos los precios', tresc: 'son sin IVA' },
    ],
    walutaUwaga:
      'Los precios en euros son orientativos. La facturación y el pago se realizan actualmente en eslotis polacos.',
    plany: [
      {
        id: 'menu',
        dlaKogo: 'Carta digital con código QR, sin pedidos',
        cechy: [
          'Códigos QR sin límite',
          '1 idioma, hasta 10 platos',
          'Carta actualizada en un minuto',
        ],
        cta: 'Crear una cuenta',
      },
      {
        id: 'starter',
        dlaKogo: 'Cafetería, local pequeño, food truck',
        cechy: [
          'Hasta 12 mesas, 2 idiomas, 50 platos',
          'Pedido a la mesa, pago al camarero',
          'Pantalla de cocina y panel de sala',
          'División «cada uno lo suyo»',
          '3 cuentas de personal',
        ],
        cta: 'Elegir Starter',
      },
      {
        id: 'pro',
        dlaKogo: 'Restaurante con servicio de sala completo',
        cechy: [
          'Hasta 40 mesas, 6 idiomas, carta sin límite',
          'Fotos de los platos en la carta',
          'División de la cuenta por artículos y por grupos',
          'Valoraciones y comentarios al responsable',
          'Analítica y exportación a CSV',
          'Cuentas de personal sin límite',
          'Soporte en 4 horas',
        ],
        cta: 'Probar 14 días',
      },
      {
        id: 'enterprise',
        dlaKogo: 'Cadena de restaurantes, hotel, food court',
        cechy: [
          'Varios locales, sin límites',
          'Integración con caja registradora y TPV',
          'Dominio y marca propios',
          'Gestor de cuenta y SLA del 99,9 %',
        ],
        cta: 'Hablemos',
      },
    ],
  },
};

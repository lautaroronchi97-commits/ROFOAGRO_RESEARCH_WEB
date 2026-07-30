import Link from "next/link";
import { ContactoForm } from "@/components/landing/contacto-form";

/**
 * Landing institucional de ROFO AGRO (ítem 3 del backlog) — página de VENTA.
 * Estructura tipo producto: hero (promesa) → problema → cómo funciona (01·02·03) →
 * servicios → vistazo al tablero (llamador) → por qué → para acopios → equipo (sin
 * nombres) → FAQ → contacto (formulario). Los mockups son ilustrativos: sin datos
 * reales, solo para dar el gusto visual (no copiables). Textos = borrador para editar.
 */

const SERVICIOS = [
  {
    icon: "grid",
    titulo: "Research de mercado",
    texto:
      "Todo lo que una mesa mira antes de decidir, actualizado varias veces por día y en un solo lugar.",
  },
  {
    icon: "arb",
    titulo: "Lectura en tiempo real",
    texto:
      "Sabés al instante qué te conviene más: vender ahora o esperar. La misma lectura que usa una mesa profesional.",
  },
  {
    icon: "calc",
    titulo: "Herramientas a medida",
    texto:
      "Corré tus propios números con la misma lógica que usa una mesa de granos, para cada tipo de negocio.",
  },
  {
    icon: "chart",
    titulo: "Qué se viene",
    texto:
      "Los organismos que mueven el precio mundial, comparados y con calendario. Te enterás antes de que impacte.",
  },
  {
    icon: "news",
    titulo: "Noticias del agro al momento",
    texto: "Lo que mueve el mercado, filtrado para vos. Sin ruido, sin perder tiempo buscando.",
  },
  {
    icon: "wa",
    titulo: "Informes diarios y semanales",
    texto: "El resumen que importa, directo a tu WhatsApp, todos los días.",
  },
] as const;

const DIFERENCIALES = [
  {
    titulo: "La mirada de una mesa, no una planilla",
    texto:
      "Miramos tu negocio como lo mira una mesa de granos: tasas, carry, exposición, momentum. No es un servicio de datos, es criterio.",
  },
  {
    titulo: "A medida, siempre",
    texto:
      "Para todos los clientes es un servicio premium armado con la información de tu empresa y tu objetivo. No hay dos estrategias iguales.",
  },
  {
    titulo: "Técnica y mercado en el mismo equipo",
    texto:
      "Gran formación técnica y años operando el mercado. Que ambas cosas convivan es lo difícil de encontrar.",
  },
  {
    titulo: "Alineados con tu resultado",
    texto:
      "Nuestro foco está puesto en donde vos decidas ponerlo: en tu rentabilidad, en tu volumen de operaciones, o en las dos cosas.",
  },
] as const;

const FAQ = [
  {
    q: "¿Esto reemplaza a mi corredor?",
    a: "No, lo complementa. Le vendas a tu acopio, tu cooperativa, un exportador o un corredor, nosotros te damos el research, el criterio y la estrategia para que llegues a esa operación sabiendo qué te conviene. Vas a negociar con más información y mejor parado.",
  },
  {
    q: "¿Qué incluye el acceso?",
    a: "El tablero de research completo (arbitrajes, pizarra, dólar y tasas, calculadoras, estimaciones y noticias), los informes por WhatsApp y el acompañamiento de nuestro equipo para armar tu estrategia.",
  },
  {
    q: "¿Los datos son en tiempo real?",
    a: "El tablero está conectado a mercado en tiempo real durante la rueda, y esa información llega actualizada e interpretada por nuestros especialistas — no son números sueltos. No es un tick a tick de trader: es la lectura que necesitás para decidir bien, varias veces al día.",
  },
  {
    q: "¿Sirve para productores y para acopios?",
    a: "Para los dos. El productor decide mejor cuándo y cómo vender; el acopio, además, puede armar condiciones de originación para sus clientes replicando el modelo de un correacopio.",
  },
  {
    q: "¿Cómo accedo?",
    a: "El acceso al tablero es para clientes que tienen contratado el asesoramiento. Dejanos tus datos en el formulario y coordinamos tu servicio a medida.",
  },
  {
    q: "¿Cuánto cuesta?",
    a: "Cada presupuesto es a medida, según el tamaño y el objetivo de tu empresa. Escribinos y lo conversamos.",
  },
] as const;

export default function BienvenidaPage() {
  return (
    <>
      {/* ===== HERO ===== */}
      <section className="lp-hero">
        <div className="lp-wrap lp-hero-in">
          <span className="lp-eyebrow">Consultora de agronegocios · Granos</span>
          <h1 className="lp-h1">
            Dejá de tomar<br />
            decisiones a ciegas.
          </h1>
          <p className="lp-lead">
            Accedé a las mismas herramientas y al mismo criterio que usan las mesas de trading de
            granos de Rosario. Un equipo con <strong>más de 10 años</strong> de experiencia te
            acompaña a decidir cuándo, cómo y a qué precio comprar o vender, evaluando todas las
            alternativas para elegir la mejor.
          </p>
          <div className="lp-hero-cta">
            <a href="#contacto" className="auth-btn auth-btn-primary lp-btn-lg">
              Quiero asesoramiento
            </a>
            <a href="#servicios" className="auth-btn auth-btn-ghost lp-btn-lg">
              Ver qué incluye
            </a>
          </div>
          <p className="lp-hero-foot">
            <span className="lp-hero-foot-dot" aria-hidden="true" />
            Servicio a medida para productores y acopios
          </p>
        </div>
      </section>

      {/* ===== PROBLEMA ===== */}
      <section className="lp-section lp-problema">
        <div className="lp-wrap">
          <h2 className="lp-h2">
            Cada decisión de venta que tomás sin información, la paga tu rentabilidad.
          </h2>
          <p className="lp-p">
            El productor y el acopio deciden cuándo y cómo vender sin ver lo que ve una mesa de
            trading: el carry entre posiciones, los spreads, las tasas implícitas, el momentum del
            mercado. Así se pierde plata, por timing y por no comparar todas las alternativas antes
            de cerrar.
          </p>
          <ul className="lp-pain">
            <li>Vendés hoy sin saber si conviene esperar y capturar tasa.</li>
            <li>No tenés con qué comparar: pizarra, futuro, a fijar, canje… ¿cuál rinde más?</li>
            <li>Te enterás tarde de lo que el mercado ya movió.</li>
            <li>Decidís por intuición, no por número.</li>
          </ul>
        </div>
      </section>

      {/* ===== CÓMO FUNCIONA ===== */}
      <section id="como-funciona" className="lp-section lp-alt">
        <div className="lp-wrap">
          <h2 className="lp-h2 lp-center">Cómo te acompañamos</h2>
          <div className="lp-steps">
            <article className="lp-step">
              <span className="lp-step-num">01</span>
              <h3 className="lp-step-t">Accedés al tablero</h3>
              <p className="lp-step-p">
                Un panel de research que se actualiza varias veces por día: arbitrajes, pizarra,
                dólar y tasas, curvas, estimaciones de producción y noticias. Todo lo que mira una
                mesa, en un solo lugar.
              </p>
            </article>
            <article className="lp-step">
              <span className="lp-step-num">02</span>
              <h3 className="lp-step-t">Interpretamos juntos</h3>
              <p className="lp-step-p">
                No te dejamos solo con los números. Analizamos los informes con vos y te marcamos
                dónde están las oportunidades y qué está por venir.
              </p>
            </article>
            <article className="lp-step">
              <span className="lp-step-num">03</span>
              <h3 className="lp-step-t">Armamos tu estrategia a medida</h3>
              <p className="lp-step-p">
                Diseñamos tu estrategia de comercialización con la información de tu empresa y tu
                objetivo: maximizar rentabilidad, mejorar la financiación o aumentar la originación.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* ===== SERVICIOS ===== */}
      <section id="servicios" className="lp-section">
        <div className="lp-wrap">
          <h2 className="lp-h2 lp-center">Todo lo que necesitás para decidir mejor</h2>
          <p className="lp-p lp-center lp-narrow">
            Tené a tu alcance el momentum del mercado: qué se está negociando, dónde están las
            oportunidades y qué está por venir.
          </p>
          <div className="lp-services">
            {SERVICIOS.map((s) => (
              <article key={s.titulo} className="lp-card">
                <span className="lp-card-icon" aria-hidden="true">
                  <SvcIcon name={s.icon} />
                </span>
                <h3 className="lp-card-t">{s.titulo}</h3>
                <p className="lp-card-p">{s.texto}</p>
              </article>
            ))}
          </div>
          <p className="lp-services-foot">
            Y, sobre todo, especialistas en estrategia que te ayudan a diagramar tu jugada — no
            solo datos.
          </p>
        </div>
      </section>

      {/* ===== VISTAZO AL TABLERO (llamador) ===== */}
      <section className="lp-section lp-alt">
        <div className="lp-wrap">
          <h2 className="lp-h2 lp-center">Así se ve por dentro</h2>
          <p className="lp-p lp-center lp-narrow">
            Un vistazo al tablero. El acceso completo, con tus datos y en tiempo real, es para
            clientes con asesoramiento contratado.
          </p>
          <Teaser />
        </div>
      </section>

      {/* ===== POR QUÉ ROFO AGRO ===== */}
      <section id="por-que" className="lp-section">
        <div className="lp-wrap">
          <h2 className="lp-h2 lp-center">¿Por qué ROFO AGRO?</h2>
          <div className="lp-why">
            {DIFERENCIALES.map((d) => (
              <article key={d.titulo} className="lp-why-item">
                <h3 className="lp-why-t">{d.titulo}</h3>
                <p className="lp-why-p">{d.texto}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PARA ACOPIOS ===== */}
      <section className="lp-section lp-acopios">
        <div className="lp-wrap lp-acopios-in">
          <span className="lp-eyebrow lp-eyebrow-gold">Para acopios</span>
          <h2 className="lp-h2">Profesionalizá tu mesa de negocios</h2>
          <p className="lp-p">
            Te ayudamos a potenciar tu originación: diseñamos e instrumentamos con vos tus propias
            condiciones para tus clientes — a fijar, a precio, canje, cartas de garantía — con el
            mismo criterio que usa una mesa profesional. Le agregás valor a tu cartera, con nuestro
            acompañamiento.
          </p>
          <a href="#contacto" className="auth-btn auth-btn-primary lp-btn-lg lp-btn-inline">
            Quiero asesoramiento
          </a>
        </div>
      </section>

      {/* ===== EQUIPO ===== */}
      <section className="lp-section lp-alt">
        <div className="lp-wrap lp-narrow lp-center">
          <h2 className="lp-h2">Quiénes estamos detrás</h2>
          <p className="lp-p lp-quote">
            Detrás de ROFO AGRO hay un equipo con <strong>más de 10 años</strong> manejando una mesa
            de granos especializada en originación y rentabilidad. Gran formación técnica y
            experiencia real de mercado y, sobre todo, ambas cosas conviviendo en el mismo equipo,
            que es lo más difícil de encontrar.
          </p>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="preguntas" className="lp-section">
        <div className="lp-wrap lp-narrow">
          <h2 className="lp-h2 lp-center">Preguntas frecuentes</h2>
          <div className="lp-faq">
            {FAQ.map((f) => (
              <details key={f.q} className="lp-faq-item">
                <summary className="lp-faq-q">{f.q}</summary>
                <p className="lp-faq-a">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CONTACTO ===== */}
      <section id="contacto" className="lp-section lp-alt">
        <div className="lp-wrap lp-contacto">
          <div className="lp-contacto-copy">
            <h2 className="lp-h2">Sumá toda nuestra experiencia a tu equipo</h2>
            <p className="lp-p">
              Contanos de tu empresa y qué querés lograr. Con eso armamos tu servicio a medida.
            </p>
            <p className="lp-nota">
              El acceso a la web es para clientes con asesoramiento contratado.
            </p>
            <p className="lp-nota">
              ¿Ya sos cliente? <Link href="/ingresar">Ingresá a la web</Link>.
            </p>
          </div>
          <div className="lp-contacto-form">
            <ContactoForm />
          </div>
        </div>
      </section>

      {/* ===== CIERRE ===== */}
      <section className="lp-cierre">
        <div className="lp-wrap lp-center">
          <h2 className="lp-h2 lp-cierre-t">Dejá de decidir a ciegas.</h2>
          <p className="lp-p lp-center lp-narrow">
            Tomá cada decisión con un equipo de profesionales de tu lado.
          </p>
          <a href="#contacto" className="auth-btn auth-btn-primary lp-btn-lg lp-btn-inline">
            Quiero asesoramiento
          </a>
        </div>
      </section>
    </>
  );
}

/* ---------- Iconos de servicios (line icons minimalistas) ---------- */
function SvcIcon({ name }: { name: string }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "grid":
      return (
        <svg viewBox="0 0 24 24" {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
      );
    case "arb":
      return (
        <svg viewBox="0 0 24 24" {...p}><path d="M3 17l5-6 4 3 5-8" /><path d="M17 6h4v4" /></svg>
      );
    case "calc":
      return (
        <svg viewBox="0 0 24 24" {...p}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15v3M8 18h4" /></svg>
      );
    case "chart":
      return (
        <svg viewBox="0 0 24 24" {...p}><path d="M4 20V4M4 20h16" /><path d="M8 16v-4M12 16V8M16 16v-6" /></svg>
      );
    case "news":
      return (
        <svg viewBox="0 0 24 24" {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 9h6M7 13h10M7 16h5" /></svg>
      );
    case "wa":
      return (
        <svg viewBox="0 0 24 24" {...p}><rect x="6" y="2" width="12" height="20" rx="3" /><path d="M11 18h2" /></svg>
      );
    default:
      return null;
  }
}

/* ---------- Vistazo al tablero: mockups ilustrativos (sin datos reales) ---------- */
function Teaser() {
  return (
    <div className="lp-teaser">
      <span className="lp-teaser-chip">Vista previa</span>
      <div className="lp-teaser-grid">
        {/* Arbitrajes */}
        <div className="lp-mock">
          <div className="lp-mock-hd">Arbitrajes</div>
          <table className="lp-mock-tbl">
            <thead>
              <tr><th>Grano</th><th>Pos</th><th>Pizarra</th><th>Futuro</th><th>TNA USD</th></tr>
            </thead>
            <tbody>
              <tr><td>Soja</td><td>JUL</td><td>305</td><td>312</td><td className="pos">+18%</td></tr>
              <tr><td>Maíz</td><td>ABR</td><td>175</td><td>181</td><td className="pos">+14%</td></tr>
              <tr><td>Trigo</td><td>ENE</td><td>210</td><td>214</td><td className="pos">+9%</td></tr>
            </tbody>
          </table>
        </div>

        {/* Curva de spreads */}
        <div className="lp-mock">
          <div className="lp-mock-hd">Spread por posición</div>
          <svg viewBox="0 0 240 96" className="lp-mock-chart" preserveAspectRatio="none" aria-hidden="true">
            <polyline points="4,70 40,58 76,62 112,40 148,44 184,24 220,30" />
            <polyline className="b" points="4,80 40,74 76,68 112,66 148,54 184,52 220,42" />
          </svg>
        </div>

        {/* Calculadora */}
        <div className="lp-mock">
          <div className="lp-mock-hd">Calculadora · A fijar</div>
          <div className="lp-mock-calc">
            <div><span>Disponible USD</span><b>305</b></div>
            <div><span>Tasa (TNA)</span><b>16%</b></div>
            <div className="res"><span>Precio a fijar</span><b>298</b></div>
          </div>
        </div>

        {/* Noticias */}
        <div className="lp-mock">
          <div className="lp-mock-hd">Noticias del agro</div>
          <ul className="lp-mock-news">
            <li><span>La exportación mejora la pizarra de soja</span><em>Mercado</em></li>
            <li><span>USDA recorta la producción de maíz de EEUU</span><em>Informes</em></li>
            <li><span>El dólar futuro comprime tasas en la rueda</span><em>Dólar</em></li>
          </ul>
        </div>

        {/* Comercio exterior: line-up de buques */}
        <div className="lp-mock lp-mock-wide">
          <div className="lp-mock-hd">Comercio exterior · Line-up de puertos</div>
          <table className="lp-mock-tbl">
            <thead>
              <tr><th>Buque</th><th>Zona</th><th>Producto</th><th>Ton</th></tr>
            </thead>
            <tbody>
              <tr><td>MV Delta</td><td>Up River N</td><td>Soja</td><td>32.400</td></tr>
              <tr><td>MV Aurora</td><td>Up River S</td><td>Maíz</td><td>28.100</td></tr>
              <tr><td>MV Cobre</td><td>Bahía</td><td>Trigo</td><td>19.700</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="lp-teaser-fade" aria-hidden="true" />
    </div>
  );
}

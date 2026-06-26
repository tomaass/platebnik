import Link from 'next/link'
import s from './page.module.css'

export default function Home() {
  return (
    <main className={s.page}>
      <nav className={s.nav}>
        <span className={s.logo}>Platebník<span className={s.dot}>.</span></span>
        <Link className={s.login} href="/signin">Přihlásit</Link>
      </nav>

      <section className={s.hero}>
        <span className={s.kicker}>🍺 Pro grilovačky a sešlosti</span>
        <h1 className={s.h1}>Naťukej, co sis dal. Zbytek zařídí QR.</h1>
        <p className={s.lead}>
          Udělej ceník, nasdílej QR a nech partu naťukat, co si dali.
          Každý zaplatí přímo tobě — bez kalkulačky.
        </p>
        <Link className={s.cta} href="/boards">Vytvořit akci →</Link>
        <div className={s.ctaSub}>Zdarma · bez instalace · platba přes QR do tvé banky</div>
      </section>

      <section className={s.steps}>
        <h2 className={s.stepsTitle}>Jak to chodí</h2>
        <div className={s.step}>
          <span className={s.stepN}>1</span>
          <span className={s.stepText}><b>Sepíšeš ceník</b><span>Pivo 40, klobása 60… nebo jen „dýško za grill".</span></span>
        </div>
        <div className={s.step}>
          <span className={s.stepN}>2</span>
          <span className={s.stepText}><b>Nasdílíš QR / odkaz</b><span>Parta ho naskenuje. Žádná registrace pro hosty.</span></span>
        </div>
        <div className={s.step}>
          <span className={s.stepN}>3</span>
          <span className={s.stepText}><b>Každý zaplatí sobě</b><span>Naťuká co měl → QR Platba → hotovo. Peníze jdou rovnou tobě.</span></span>
        </div>
      </section>

      <section className={s.trust}>
        <div className={s.tcard}>
          <span className={s.ic}>🏦</span>
          <b>Peníze jdou přímo k tobě</b>
          <span>Přes QR Platbu do tvé banky. Žádná brána, žádný poplatek, nic si nebereme.</span>
        </div>
        <div className={s.tcard}>
          <span className={s.ic}>📱</span>
          <b>Host nic neinstaluje</b>
          <span>Otevře odkaz, naťuká, naskenuje QR ve své bankovní appce. Funguje i na mobilních datech.</span>
        </div>
        <div className={s.tcard}>
          <span className={s.ic}>✍️</span>
          <b>Víš, kdo zaplatil</b>
          <span>Hosté se ti můžou podepsat a nechat vzkaz. Konec dohadování.</span>
        </div>
      </section>

      <div className={s.foot}>Platebník.cz · vyrobeno v Česku 🇨🇿</div>
    </main>
  )
}

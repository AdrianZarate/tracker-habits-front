import { ArrowRight, Check, CheckCheck, History, Leaf, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300';
const primaryLink = `inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-indigo-500 ${focus}`;
const benefits = [
  { icon: Plus, title: 'Crea tus hábitos', text: 'Ponle nombre a lo que quieres hacer. Tus hábitos, en un mismo lugar.' },
  { icon: CheckCheck, title: 'Completa tu día', text: 'Marca los hábitos que hayas completado hoy y lleva el registro de cada día.' },
  { icon: History, title: 'Consulta tu historial', text: 'Abre un hábito para revisar las fechas en las que lo completaste.' },
];
const steps = [
  { title: 'Inicia sesión', text: 'Accede con tu cuenta de Google.' },
  { title: 'Crea tu primer hábito', text: 'Elige una acción concreta que quieras repetir.' },
  { title: 'Vuelve y registra', text: 'Marca lo que completes y consulta tu historial.' },
];
const sampleHabits = [
  { title: 'Leer 10 minutos', done: true },
  { title: 'Dar un paseo', done: true },
  { title: 'Estirar al despertar', done: false },
];

export default function Landing() {
  return (
    <div className='min-h-screen bg-slate-950 text-slate-100'>
      <a href='#contenido' className={`sr-only z-50 rounded-lg bg-slate-100 p-3 text-slate-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4 ${focus}`}>
        Saltar al contenido
      </a>
      <header className='border-b border-slate-800'>
        <nav aria-label='Navegación principal' className='mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8'>
          <Link to='/' aria-label='HabitTracker, inicio' className={`flex items-center gap-2 rounded-md font-semibold tracking-tight ${focus}`}>
            <span className='rounded-lg bg-emerald-400/10 p-2 text-emerald-300'><Leaf size={20} aria-hidden='true' /></span>
            HabitTracker
          </Link>
          <div className='flex flex-wrap items-center gap-5 text-sm'>
            <a href='#como-funciona' className={`hidden rounded-md text-slate-300 hover:text-white sm:inline ${focus}`}>Cómo funciona</a>
            <Link to='/login' className={`rounded-lg border border-slate-600 px-4 py-2 font-medium hover:border-indigo-400 hover:bg-indigo-400/10 ${focus}`}>Iniciar sesión</Link>
          </div>
        </nav>
      </header>

      <main id='contenido' tabIndex={-1} className='focus:outline-none'>
        <section aria-labelledby='hero-title' className='bg-gradient-to-br from-indigo-950/60 via-slate-950 to-slate-950'>
          <div className='mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-2 lg:gap-16'>
            <div className='min-w-0'>
              <p className='mb-5 flex items-center gap-2 text-sm font-medium text-emerald-300'>
                <span aria-hidden='true' className='h-2 w-2 rounded-full bg-emerald-400' />Un día. Una acción. Tu ritmo.
              </p>
              <h1 id='hero-title' className='text-4xl font-bold leading-tight tracking-tight sm:text-5xl'>
                <span className='mb-4 block text-lg font-medium tracking-normal text-indigo-300'>HabitTracker</span>
                Haz espacio para<br className='hidden sm:block' /> tus hábitos.
              </h1>
              <p className='mt-6 max-w-md text-lg leading-relaxed text-slate-300'>
                Crea hábitos, registra lo que completas cada día y consulta tu historial. Un lugar sencillo para volver a lo que te importa.
              </p>
              <div className='mt-8 flex flex-wrap items-center gap-5'>
                <Link to='/login' className={primaryLink}>Empezar con Google <ArrowRight size={18} aria-hidden='true' /></Link>
                <a href='#como-funciona' className={`rounded-md py-3 text-sm font-medium text-slate-300 hover:text-white ${focus}`}>Ver cómo funciona ↓</a>
              </div>
              <p className='mt-4 text-xs text-slate-400'>El siguiente paso es iniciar sesión con Google.</p>
            </div>

            <figure aria-labelledby='preview-caption' className='min-w-0 rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl shadow-indigo-950/50 sm:p-7'>
              <figcaption id='preview-caption' className='mb-6 border-b border-slate-700 pb-4 text-xs font-medium text-indigo-300'>
                Vista ilustrativa · datos de ejemplo
              </figcaption>
              <div className='mb-5 flex flex-wrap items-center justify-between gap-3'>
                <h2 className='text-lg font-semibold'>Tus hábitos de hoy</h2>
                <span className='rounded-full bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300'>Paso a paso</span>
              </div>
              <ul className='space-y-3'>
                {sampleHabits.map(({ title, done }) => (
                  <li key={title} className='flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/60 p-4'>
                    <span aria-hidden='true' className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${done ? 'bg-emerald-300 text-slate-950' : 'border border-slate-500'}`}>
                      {done && <Check size={17} />}
                    </span>
                    <div className='min-w-0'>
                      <p className='text-sm font-medium'>{title}</p>
                      <p className={`mt-1 text-xs ${done ? 'text-emerald-300' : 'text-slate-400'}`}>{done ? 'Completado hoy' : 'Sin completar hoy'}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className='mt-6 rounded-xl border border-slate-700 p-4'>
                <p className='flex items-center gap-2 text-sm font-medium'><History size={16} aria-hidden='true' className='text-indigo-300' />Historial · Leer 10 minutos</p>
                <p className='mt-3 text-xs leading-relaxed text-slate-400'>Ejemplo de registros completados: 12 y 13 de mayo.</p>
              </div>
              <p className='mt-4 text-xs leading-relaxed text-slate-400'>Esta muestra no es interactiva ni contiene datos de tu cuenta.</p>
            </figure>
          </div>
        </section>

        <section aria-labelledby='benefits-title' className='mx-auto max-w-6xl px-5 py-16 sm:px-8'>
          <p className='text-sm font-medium text-emerald-300'>Lo esencial, a mano</p>
          <h2 id='benefits-title' className='mt-3 text-3xl font-semibold tracking-tight'>Menos vueltas. Más intención.</h2>
          <div className='mt-8 grid gap-5 md:grid-cols-3'>
            {benefits.map(({ icon: Icon, title, text }) => (
              <article key={title} className='rounded-2xl border border-slate-800 bg-slate-900/60 p-6'>
                <Icon size={24} aria-hidden='true' className='mb-5 text-indigo-300' />
                <h3 className='text-lg font-semibold'>{title}</h3>
                <p className='mt-3 text-sm leading-relaxed text-slate-300'>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id='como-funciona' aria-labelledby='steps-title' className='scroll-mt-8 border-y border-slate-800 bg-slate-900/40'>
          <div className='mx-auto max-w-6xl px-5 py-16 sm:px-8'>
            <h2 id='steps-title' className='text-3xl font-semibold tracking-tight'>Cómo funciona</h2>
            <p className='mt-3 text-slate-300'>De la intención al registro, en tres pasos.</p>
            <ol className='mt-10 grid gap-8 md:grid-cols-3'>
              {steps.map(({ title, text }, index) => (
                <li key={title}>
                  <span aria-hidden='true' className='mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-400/40 bg-indigo-400/10 font-semibold text-indigo-200'>0{index + 1}</span>
                  <h3 className='text-lg font-semibold'>{title}</h3>
                  <p className='mt-2 text-sm leading-relaxed text-slate-300'>{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby='start-title' className='mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20'>
          <div className='rounded-3xl border border-indigo-400/30 bg-gradient-to-br from-indigo-950 to-slate-900 px-6 py-12 text-center sm:px-12'>
            <Leaf size={28} aria-hidden='true' className='mx-auto mb-5 text-emerald-300' />
            <h2 id='start-title' className='text-3xl font-semibold tracking-tight'>Tu próximo hábito empieza contigo.</h2>
            <p className='mx-auto mb-7 mt-4 max-w-lg leading-relaxed text-slate-300'>Elige algo pequeño, hazlo tuyo y vuelve para registrar tu día.</p>
            <Link to='/login' className={primaryLink}>Crear mi primer hábito <ArrowRight size={18} aria-hidden='true' /></Link>
          </div>
        </section>
      </main>

      <footer className='border-t border-slate-800'>
        <div className='mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-7 text-sm sm:px-8'>
          <p className='font-semibold'>HabitTracker <span className='ml-2 font-normal text-slate-400'>A tu ritmo, día a día.</span></p>
          <a href='#contenido' className={`rounded-md text-slate-300 hover:text-white ${focus}`}>Volver al inicio ↑</a>
        </div>
      </footer>
    </div>
  );
}

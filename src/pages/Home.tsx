import { motion } from 'framer-motion'

interface HomeProps {
  onPlayNow: () => void
}

export function Home({ onPlayNow }: HomeProps) {
  return (
    <div className="home-stage flex min-h-screen items-center justify-center px-6 py-6 text-ink">
      <motion.main
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mesh-panel w-full max-w-3xl rounded-[32px] px-8 py-14 text-center"
      >
        <h1 className="font-display text-5xl font-black tracking-[-0.04em] text-ink md:text-7xl">
          Bloc Duel
        </h1>
        <button
          onClick={onPlayNow}
          className="mt-8 rounded-[20px] bg-[linear-gradient(135deg,#112038,#295382)] px-7 py-3.5 font-display text-base font-black text-white shadow-[0_24px_40px_rgba(17,32,56,0.24)] transition hover:-translate-y-0.5 hover:brightness-105"
        >
          Play Now
        </button>
      </motion.main>
    </div>
  )
}

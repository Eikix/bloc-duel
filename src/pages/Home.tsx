import { motion } from 'framer-motion'
import { useAccount } from '@starknet-react/core'
import { getDojoConfig } from '../dojo/config'
import { shortAddress } from '../dojo/torii'
import { useBurnerWallet } from '../providers/burnerWallet'

interface HomeProps {
  onPlayNow: () => void
}

const briefingCards = [
  {
    eyebrow: 'Live World',
    title: 'Create an onchain duel',
    copy: 'Spin up a contract-backed lobby, publish the game id, and let another commander join from the same world.',
  },
  {
    eyebrow: 'Torii Sync',
    title: 'Read the board in real time',
    copy: 'The frontend watches lobby state, match state, AGI pressure, escalation, hero pools, and drafted cards directly from indexed entities.',
  },
  {
    eyebrow: 'Action Flow',
    title: 'Execute every turn from the client',
    copy: 'Create, join, play, discard, invoke heroes, choose bonuses, and advance the age from the hooked Dojo actions.',
  },
] as const

const steps = [
  {
    number: '01',
    title: 'Enter the command room',
    body: 'Launch the live lobby, connect the active wallet strategy, and prepare a commander seat.',
  },
  {
    number: '02',
    title: 'Create or join a match',
    body: 'Open a fresh game for a rival or jump into an existing lobby with a known game id.',
  },
  {
    number: '03',
    title: 'Draft onchain and resolve the war',
    body: 'Every card pick, sale, hero play, and system choice executes against the world and streams back into the UI.',
  },
] as const

function getWalletReadinessLabel(
  walletMode: ReturnType<typeof getDojoConfig>['walletMode'],
  isConnected: boolean,
  address: string | undefined,
  burnerIndex: number | null,
  burnerCount: number,
) {
  if (!isConnected || !address) {
    return walletMode === 'burner' ? 'Local burner seat waiting' : 'Controller session waiting'
  }

  if (walletMode === 'burner') {
    return `Burner ${(burnerIndex ?? 0) + 1}/${Math.max(1, burnerCount)} active`
  }

  return `Controller ready ${shortAddress(address)}`
}

export function Home({ onPlayNow }: HomeProps) {
  const config = getDojoConfig()
  const { isConnected, address } = useAccount()
  const { burnerAddresses, burnerIndex } = useBurnerWallet()
  const walletLabel = getWalletReadinessLabel(
    config.walletMode,
    Boolean(isConnected),
    address,
    burnerIndex,
    burnerAddresses.length,
  )

  return (
    <div className="home-stage min-h-screen px-4 py-4 text-ink md:px-6 md:py-6">
      <div className="home-orbit home-orbit-left" />
      <div className="home-orbit home-orbit-right" />

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="mesh-panel relative overflow-hidden rounded-[34px] px-5 py-6 md:px-8 md:py-8 lg:px-10 lg:py-10">
          <div className="hero-glow hero-glow-blue" />
          <div className="hero-glow hero-glow-orange" />

          <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-center">
            <div>
              <div className="mb-5 flex flex-wrap gap-2">
                <span className="command-chip rounded-full px-3 py-1 font-mono text-[11px] font-semibold text-ink-muted">
                  Dojo world wired
                </span>
                <span className="command-chip rounded-full px-3 py-1 font-mono text-[11px] font-semibold text-ink-muted">
                  {config.network.toUpperCase()}
                </span>
                <span className="command-chip rounded-full px-3 py-1 font-mono text-[11px] font-semibold text-ink-muted">
                  {config.walletMode === 'burner' ? 'Burner flow' : 'Controller flow'}
                </span>
              </div>

              <p className="section-label mb-3">Strategic Command Interface</p>
              <h1 className="max-w-4xl font-display text-[2.85rem] font-black leading-[0.92] tracking-[-0.03em] text-ink md:text-[4.15rem] lg:text-[5.2rem]">
                Build the lobby.
                <br />
                Draft the future.
                <br />
                Resolve the duel onchain.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-muted md:text-lg">
                Bloc Duel now opens with a real front door: a sharp landing experience, a clear get started path, and a direct route into the contract-backed game room where two players can create, join, and play live matches.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <button
                  onClick={onPlayNow}
                  className="rounded-[20px] bg-[linear-gradient(135deg,#112038,#295382)] px-6 py-3.5 font-display text-base font-black text-white shadow-[0_24px_40px_rgba(17,32,56,0.24)] transition hover:-translate-y-0.5 hover:brightness-105"
                >
                  Play Now
                </button>
                <a
                  href="#get-started"
                  className="command-chip rounded-[20px] px-5 py-3 font-mono text-sm font-semibold text-ink-muted transition hover:-translate-y-0.5 hover:text-ink"
                >
                  Get Started
                </a>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <div className="home-pill">
                  <span className="home-pill-label">Wallet</span>
                  <span className="home-pill-value">{walletLabel}</span>
                </div>
                <div className="home-pill">
                  <span className="home-pill-label">World</span>
                  <span className="home-pill-value">{shortAddress(config.worldAddress)}</span>
                </div>
                <div className="home-pill">
                  <span className="home-pill-label">Actions</span>
                  <span className="home-pill-value">{shortAddress(config.actionsAddress)}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              {briefingCards.map((card, index) => (
                <motion.article
                  key={card.title}
                  initial={{ opacity: 0, y: 22 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 * index, duration: 0.4 }}
                  className="home-card rounded-[28px] p-5 md:p-6"
                >
                  <p className="section-label mb-3">{card.eyebrow}</p>
                  <h2 className="font-display text-2xl font-black leading-tight text-ink">{card.title}</h2>
                  <p className="mt-3 text-sm leading-relaxed text-ink-muted md:text-[15px]">{card.copy}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="get-started"
          className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
        >
          <div className="panel-glass rounded-[30px] p-6 md:p-7">
            <p className="section-label mb-3">Get Started</p>
            <h2 className="font-display text-3xl font-black text-ink md:text-[2.5rem]">
              From landing page to live match in three moves.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-muted md:text-[15px]">
              The site now leads with a clear entry point, but the game room still stays focused on the core flow: create a lobby, share the id, and execute every turn against the deployed world.
            </p>

            <div className="mt-5 grid gap-3">
              {steps.map((step, index) => (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, x: -18 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.06 * index, duration: 0.35 }}
                  className="rounded-[24px] border border-white/75 bg-white/70 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]"
                >
                  <div className="flex items-start gap-4">
                    <span className="rounded-2xl bg-[linear-gradient(135deg,#112038,#2f6df6)] px-3 py-2 font-mono text-xs font-bold text-white shadow-[0_14px_24px_rgba(17,32,56,0.18)]">
                      {step.number}
                    </span>
                    <div>
                      <h3 className="font-display text-xl font-black text-ink">{step.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-ink-muted">{step.body}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <article className="home-card rounded-[30px] p-6">
              <p className="section-label mb-3">Create Match</p>
              <h3 className="font-display text-2xl font-black text-ink">Open a fresh lobby</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                Hit `New Game` inside the command room, let the frontend submit `create_game`, and wait for Torii to index the new match id.
              </p>
              <div className="mt-5 rounded-[24px] border border-blue-200/70 bg-blue-50/65 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-blue-600">Contract action</p>
                <p className="mt-2 font-display text-xl font-black text-blue-900">`create_game`</p>
              </div>
            </article>

            <article className="home-card rounded-[30px] p-6">
              <p className="section-label mb-3">Join Match</p>
              <h3 className="font-display text-2xl font-black text-ink">Bring in the second player</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                Use an open lobby card or paste a known game id, then submit `join_game` to move the board from lobby state into drafting.
              </p>
              <div className="mt-5 rounded-[24px] border border-amber-200/70 bg-amber-50/65 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-amber-600">Contract action</p>
                <p className="mt-2 font-display text-xl font-black text-amber-900">`join_game`</p>
              </div>
            </article>

            <article className="panel-glass rounded-[30px] p-6 md:col-span-2">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="section-label mb-3">Ready Room</p>
                  <h3 className="font-display text-3xl font-black text-ink">The game loop is the priority.</h3>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted md:text-[15px]">
                    The UI polish matters, but the command room is still built around live reads, reliable action execution, and visible transaction feedback first.
                  </p>
                </div>

                <button
                  onClick={onPlayNow}
                  className="rounded-[20px] bg-[linear-gradient(135deg,#c85d2f,#d98746)] px-6 py-3 font-display text-base font-black text-white shadow-[0_22px_36px_rgba(200,93,47,0.2)] transition hover:-translate-y-0.5 hover:brightness-105"
                >
                  Enter Command Room
                </button>
              </div>
            </article>
          </div>
        </section>
      </main>
    </div>
  )
}

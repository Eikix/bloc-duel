import { AnimatePresence, motion } from 'framer-motion'
import { getTransactionExplorerUrl } from '../dojo/config'
import { useTransactionStore, type TransactionStatus } from '../store/transactionStore'

const STATUS_STYLES: Record<TransactionStatus, { border: string; badge: string; glow: string }> = {
  pending: {
    border: 'border-blue-200/80',
    badge: 'bg-blue-100 text-blue-700',
    glow: 'shadow-[0_18px_32px_rgba(47,109,246,0.14)]',
  },
  success: {
    border: 'border-emerald-200/85',
    badge: 'bg-emerald-100 text-emerald-700',
    glow: 'shadow-[0_18px_32px_rgba(16,185,129,0.14)]',
  },
  error: {
    border: 'border-red-200/85',
    badge: 'bg-red-100 text-red-700',
    glow: 'shadow-[0_18px_32px_rgba(239,68,68,0.14)]',
  },
}

function shortHash(value: string) {
  return `${value.slice(0, 8)}...${value.slice(-6)}`
}

export function TransactionToaster() {
  const items = useTransactionStore((state) => state.items)
  const dismiss = useTransactionStore((state) => state.dismiss)

  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-[80] flex w-[min(92vw,24rem)] flex-col gap-3 md:bottom-5 md:right-5">
      <AnimatePresence initial={false}>
        {items.map((item) => {
          const explorerUrl = item.txHash ? getTransactionExplorerUrl(item.txHash) : null
          const style = STATUS_STYLES[item.status]

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className={`pointer-events-auto rounded-[24px] border bg-[linear-gradient(180deg,rgba(249,252,255,0.94),rgba(233,239,246,0.9))] p-4 backdrop-blur-xl ${style.border} ${style.glow}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] ${style.badge}`}>
                      {item.status}
                    </span>
                    {item.txHash && (
                      <span className="rounded-full bg-white/75 px-2.5 py-1 font-mono text-[10px] font-semibold text-ink-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.84)]">
                        {shortHash(item.txHash)}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 font-display text-xl font-black text-ink">{item.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-muted">{item.description}</p>
                </div>

                <button
                  onClick={() => dismiss(item.id)}
                  className="rounded-full bg-white/75 px-2 py-1 font-mono text-[10px] font-semibold text-ink-faint shadow-[inset_0_1px_0_rgba(255,255,255,0.84)] transition hover:text-ink"
                >
                  Close
                </button>
              </div>

              {explorerUrl && (
                <div className="mt-3">
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-full bg-white/75 px-3 py-1.5 font-mono text-[11px] font-semibold text-ink-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.84)] transition hover:-translate-y-0.5 hover:text-ink"
                  >
                    View transaction
                  </a>
                </div>
              )}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

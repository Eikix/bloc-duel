import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import CardPyramid from '../components/CardPyramid'
import CardZoom from '../components/CardZoom'
import DiscardZone from '../components/DiscardZone'
import HeroPicker from '../components/HeroPicker'
import PlayField from '../components/PlayField'
import StrategicMapBackground from '../components/StrategicMapBackground'
import SystemBonusChoice from '../components/SystemBonusChoice'
import { useBlocDuelLifecycle } from '../hooks/useBlocDuel'
import { RESOURCE_ICONS } from '../game/format'
import { ALL_SYSTEM_TYPES } from '../game/systems'
import {
  isZeroAddress,
  normalizeAddress,
  shortAddress,
  type GamePhase,
  type GameSummary,
  type WinCondition,
} from '../dojo/torii'
import { canAfford, getEffectiveCost, getSellValue, useGameStore } from '../store/gameStore'

const AGE_LABELS = { 1: 'I', 2: 'II', 3: 'III' } as const

const PHASE_LABELS: Record<GamePhase, string> = {
  LOBBY: 'Lobby',
  DRAFTING: 'Drafting',
  AGE_TRANSITION: 'Age Transition',
  GAME_OVER: 'Game Over',
}

const WIN_CONDITION_LABELS: Record<WinCondition, string> = {
  None: 'No result yet',
  AgiBreakthrough: 'AGI Breakthrough',
  EscalationDominance: 'Escalation Dominance',
  SystemsDominance: 'Systems Dominance',
  Points: 'Points Victory',
}

const TURN_FLOW = [
  'Draft any revealed card in the center pyramid.',
  'Deploy it to your lane or sell it for capital.',
  'Clear the pyramid to trigger the next age.',
] as const

const WIN_PATHS = [
  'AGI to 6',
  'Escalation to your edge',
  'All 4 system types',
  'Most points after Age III',
] as const

const COLOR_GUIDE = [
  { label: 'AI', detail: 'Pushes AGI', chip: 'bg-blue-500 text-white' },
  { label: 'MIL', detail: 'Pushes escalation', chip: 'bg-red-500 text-white' },
  { label: 'ECO', detail: 'Builds production', chip: 'bg-amber-500 text-white' },
  { label: 'SYS', detail: 'Builds symbol sets', chip: 'bg-emerald-500 text-white' },
] as const

const HUD_GLYPHS = {
  atlantic: '▲',
  continental: '◆',
  capital: '◈',
  agi: '◎',
  systems: '⬢',
  escalation: '✦',
  points: '★',
  mission: '▶',
  guide: '⌘',
  board: '⌬',
  live: '◉',
  selection: '◌',
} as const

type GamePlayer = ReturnType<typeof useGameStore.getState>['players'][number]

function getWinnerLabel(
  winner: 0 | 1 | 'tie' | null,
  players: ReturnType<typeof useGameStore.getState>['players'],
): string {
  if (winner === 0) return players[0].name
  if (winner === 1) return players[1].name
  if (winner === 'tie') return 'Tie Game'
  return 'Pending Result'
}

function isMyGame(game: GameSummary, walletAddress: string | null): boolean {
  if (!walletAddress) return false

  const normalized = normalizeAddress(walletAddress)
  return normalizeAddress(game.playerOne) === normalized || normalizeAddress(game.playerTwo) === normalized
}

function canJoinGame(game: GameSummary, walletAddress: string | null): boolean {
  if (!walletAddress) return false

  return isZeroAddress(game.playerTwo) && normalizeAddress(game.playerOne) !== normalizeAddress(walletAddress)
}

function getBurnerIndexForAddress(address: string, burnerAddresses: string[]): number {
  const normalizedAddress = normalizeAddress(address)
  return burnerAddresses.findIndex((burnerAddress) => normalizeAddress(burnerAddress) === normalizedAddress)
}

function countDistinctSystems(player: Pick<GamePlayer, 'systems'>): number {
  return new Set(player.systems).size
}

function getPointsProjection(player: GamePlayer, agiValue: number): number {
  return agiValue + countDistinctSystems(player) + player.heroCount
}

function getEscalationPressure(playerIndex: 0 | 1, escalation: number): number {
  return playerIndex === 0 ? Math.max(0, -escalation) : Math.max(0, escalation)
}

function CommanderHudCard({
  player,
  agi,
  escalation,
  systems,
  projectedPoints,
  isActive,
  isLocal,
  onHeroClick,
  canInvokeHero,
  heroSurcharge,
}: {
  player: GamePlayer
  agi: number
  escalation: number
  systems: number
  projectedPoints: number
  isActive: boolean
  isLocal: boolean
  onHeroClick?: () => void
  canInvokeHero?: boolean
  heroSurcharge?: number
}) {
  const isAtlantic = player.faction === 'ATLANTIC'
  const accentText = isAtlantic ? 'text-atlantic' : 'text-continental'
  const cardTone = isAtlantic ? 'hud-panel-atlantic' : 'hud-panel-continental'
  const accentDot = isAtlantic ? 'bg-atlantic' : 'bg-continental'
  const factionGlyph = isAtlantic ? HUD_GLYPHS.atlantic : HUD_GLYPHS.continental

  return (
    <div className={`hud-command-plate ${cardTone}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="hud-icon-badge text-white/80">{factionGlyph}</span>
            <span className={`h-2.5 w-2.5 rounded-full ${accentDot}`} />
            <p className="section-label text-white/50">{isLocal ? 'Your bloc' : 'Enemy bloc'}</p>
          </div>
          <h3 className={`mt-1.5 truncate font-display text-[1.15rem] font-black ${accentText}`}>{player.name}</h3>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span className={`hud-status-pill ${isActive ? 'hud-status-pill-live' : ''}`}>
            {isActive ? 'Active' : 'Standby'}
          </span>
          {isLocal && onHeroClick && (
            <button
              onClick={onHeroClick}
              disabled={!canInvokeHero}
              className={`rounded-xl px-3 py-2 font-mono text-[11px] font-semibold transition ${
                canInvokeHero
                  ? 'border border-amber-300 bg-[linear-gradient(135deg,#fff1bf,#ffd46a)] text-amber-900 shadow-[0_12px_20px_rgba(245,158,11,0.2)] hover:-translate-y-0.5'
                  : 'border border-white/18 bg-white/8 text-white/40'
              }`}
            >
              Hero +{heroSurcharge ?? 0}
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        <div className="hud-resource-cell hud-resource-cell-compact">
          <span className="hud-resource-label">{HUD_GLYPHS.capital} Cap</span>
          <span className="hud-resource-value">{player.capital}</span>
        </div>
        <div className="hud-resource-cell hud-resource-cell-compact">
          <span className="hud-resource-label">{HUD_GLYPHS.agi} AGI</span>
          <span className="hud-resource-value">{agi}/6</span>
        </div>
        <div className="hud-resource-cell hud-resource-cell-compact">
          <span className="hud-resource-label">{HUD_GLYPHS.systems} Sys</span>
          <span className="hud-resource-value">{systems}/{ALL_SYSTEM_TYPES.length}</span>
        </div>
        <div className="hud-resource-cell hud-resource-cell-compact">
          <span className="hud-resource-label">{HUD_GLYPHS.escalation} Esc</span>
          <span className="hud-resource-value">{escalation}/6</span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2 font-mono text-[11px] text-white/72">
        <span className="hud-inline-chip">{RESOURCE_ICONS.energy} {player.production.energy}</span>
        <span className="hud-inline-chip">{RESOURCE_ICONS.materials} {player.production.materials}</span>
        <span className="hud-inline-chip">{RESOURCE_ICONS.compute} {player.production.compute}</span>
        <span className="hud-inline-chip">{HUD_GLYPHS.points} {projectedPoints}</span>
      </div>
    </div>
  )
}

function clampHudProgress(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function GuideSidebar({
  open,
  onClose,
  missionQuestion,
  missionAnswer,
}: {
  open: boolean
  onClose: () => void
  missionQuestion: string
  missionAnswer: string
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.2 }}
          className="hud-guide fixed bottom-3 right-3 top-24 z-40 w-[min(320px,calc(100vw-1.5rem))] overflow-y-auto rounded-[30px] p-5 md:top-[6.5rem]"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="section-label text-white/60">{HUD_GLYPHS.guide} Guide</p>
              <h3 className="mt-2 font-display text-2xl font-black text-white">How it works</h3>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl border border-white/12 bg-white/8 px-3 py-2 font-mono text-[11px] font-semibold text-white/72 transition hover:bg-white/12 hover:text-white"
            >
              Hide
            </button>
          </div>

          <div className="space-y-3">
            <section className="hud-guide-card">
              <p className="section-label mb-2 text-white/50">{HUD_GLYPHS.mission} Current prompt</p>
              <h4 className="font-display text-xl font-black text-white">{missionQuestion}</h4>
              <p className="mt-2 text-sm leading-relaxed text-white/72">{missionAnswer}</p>
            </section>

            <section className="hud-guide-card">
              <p className="section-label mb-2 text-white/50">{HUD_GLYPHS.live} Turn flow</p>
              <div className="space-y-2">
                {TURN_FLOW.map((step, index) => (
                  <div key={step} className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-atlantic font-mono text-[11px] font-bold text-white">
                      {index + 1}
                    </span>
                    <p className="text-sm text-white/72">{step}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="hud-guide-card">
              <p className="section-label mb-2 text-white/50">{HUD_GLYPHS.points} Win paths</p>
              <div className="flex flex-wrap gap-2">
                {WIN_PATHS.map((path) => (
                  <span key={path} className="hud-inline-chip text-white/80">
                    {path}
                  </span>
                ))}
              </div>
            </section>

            <section className="hud-guide-card">
              <p className="section-label mb-2 text-white/50">{HUD_GLYPHS.selection} Color read</p>
              <div className="space-y-2">
                {COLOR_GUIDE.map((entry) => (
                  <div key={entry.label} className="flex items-center justify-between gap-3">
                    <span className={`rounded-full px-3 py-1 font-mono text-[11px] font-bold ${entry.chip}`}>{entry.label}</span>
                    <span className="text-sm text-white/68">{entry.detail}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

interface GameProps {
  onBackHome?: () => void
}

export function Game({ onBackHome }: GameProps) {
  const [joinGameId, setJoinGameId] = useState('')
  const [isGuideOpen, setIsGuideOpen] = useState(true)
  const {
    address,
    burnerAddresses,
    burnerIndex,
    connect,
    connectors,
    disconnect,
    isBootstrappingRuntime,
    isConnected,
    isDisconnecting,
    isPending,
    refreshGame,
    refreshGames,
    reloadRuntime,
    runtimeError,
    runtimeReady,
    switchBurner,
    walletMode,
  } = useBlocDuelLifecycle()

  const {
    games,
    selectedGameId,
    localPlayerIndex,
    isCurrentUserTurn,
    players,
    currentPlayer,
    phase,
    age,
    agiTrack,
    escalationTrack,
    selectedCard,
    pyramid,
    availableHeroes,
    systemBonusChoice,
    isLoadingGames,
    isLoadingGame,
    isSubmitting,
    error,
    winner,
    winCondition,
    createGame,
    joinGame,
    playCard,
    discardCard,
    playCardAt,
    discardCardAt,
    toggleHeroPicker,
    chooseSystemBonus,
    nextAge,
    setSelectedGameId,
    clearError,
  } = useGameStore()

  const bottomPlayer = localPlayerIndex ?? currentPlayer
  const topPlayer: 0 | 1 = bottomPlayer === 0 ? 1 : 0

  const playFieldRef = useRef<HTMLDivElement>(null)
  const discardRef = useRef<HTMLDivElement>(null)
  const [activeDragZone, setActiveDragZone] = useState<'play' | 'discard' | null>(null)
  const dropRefs = { playField: playFieldRef, discard: discardRef }

  const current = players[currentPlayer]
  const currentPlayerAddress = current.address
  const selectedNode = selectedCard !== null ? pyramid.find((node) => node.position === selectedCard) ?? null : null
  const isFreeViaChain = selectedNode?.card.chainFrom !== undefined
    ? current.playedCards.includes(selectedNode.card.chainFrom)
    : false
  const selectedEffectiveCost = selectedNode ? getEffectiveCost(selectedNode.card) : undefined
  const canAffordCard = selectedNode ? isFreeViaChain || canAfford(current, selectedEffectiveCost ?? {}) : false
  const sellValue = getSellValue(age)
  const winnerLabel = getWinnerLabel(winner, players)
  const myGames = games.filter((game) => isMyGame(game, address ?? null))
  const openLobbies = games.filter((game) => isZeroAddress(game.playerTwo))
  const selectedSummary = games.find((game) => game.gameId === selectedGameId) ?? null
  const controllerConnector = walletMode === 'controller' ? connectors[0] ?? null : null
  const currentTurnIsLocalWallet = address !== undefined
    && normalizeAddress(address) === normalizeAddress(currentPlayerAddress)
  const currentTurnBurnerIndex = walletMode === 'burner'
    ? getBurnerIndexForAddress(currentPlayerAddress, burnerAddresses)
    : -1
  const currentTurnLabel = selectedGameId === null
    ? null
    : isZeroAddress(currentPlayerAddress)
      ? 'Waiting for opponent'
      : walletMode === 'burner'
        ? `${currentTurnBurnerIndex >= 0 ? `Burner ${currentTurnBurnerIndex + 1}` : shortAddress(currentPlayerAddress)}`
        : current.name
  const stageAnimationKey = `${selectedGameId ?? 'lobby'}-${age}-${phase}-${currentPlayer}`
  const nextAgeValue = Math.min(age + 1, 3) as 1 | 2 | 3

  const missionQuestion =
    phase === 'DRAFTING'
      ? isCurrentUserTurn
        ? selectedNode ? `Should I deploy ${selectedNode.card.name}?` : 'What do I do on this turn?'
        : 'Why am I waiting?'
      : phase === 'AGE_TRANSITION'
        ? 'What happens next?'
        : phase === 'GAME_OVER'
          ? 'What now?'
          : 'How does the match start?'

  const missionAnswer =
    phase === 'DRAFTING'
      ? isCurrentUserTurn
        ? selectedNode
          ? canAffordCard
            ? 'Deploy it if it advances AGI, escalation, or your system set. Sell it if capital matters more this round.'
            : `You cannot afford the deployment cleanly right now, but selling still gives +${sellValue} capital.`
          : 'Take any revealed card in the center pyramid. Then deploy it to your lane or sell it for capital.'
        : 'Only the active commander can act. Watch what opens in the pyramid and plan the next tempo swing.'
      : phase === 'AGE_TRANSITION'
        ? isCurrentUserTurn
          ? `Start Age ${AGE_LABELS[nextAgeValue]} when you are ready for the next pyramid.`
          : 'The board is between ages. Wait for the active commander to continue.'
        : phase === 'GAME_OVER'
          ? 'Return to the lobby or launch a fresh match.'
          : 'Create or join a game. The draft begins as soon as both commanders are seated.'

  const localPlayer = localPlayerIndex !== null ? players[localPlayerIndex] : null
  const localHeroSurcharge = localPlayer?.heroCount ? localPlayer.heroCount * 2 : 0
  const canInvokeHero = localPlayer !== null
    && isCurrentUserTurn
    && phase === 'DRAFTING'
    && availableHeroes.length > 0
    && availableHeroes.some((hero) => canAfford(localPlayer, hero.cost, localHeroSurcharge))
  const hudFocusPlayer = localPlayer ?? players[bottomPlayer]
  const hudFocusPlayerIndex: 0 | 1 = localPlayerIndex ?? bottomPlayer

  const commanderCards = ([0, 1] as const).map((playerIndex) => ({
    playerIndex,
    player: players[playerIndex],
    agi: agiTrack[playerIndex],
    systems: countDistinctSystems(players[playerIndex]),
    escalation: getEscalationPressure(playerIndex, escalationTrack),
    projectedPoints: getPointsProjection(players[playerIndex], agiTrack[playerIndex]),
    isLocal: localPlayerIndex === playerIndex,
    isActive: currentPlayer === playerIndex,
  }))
  const atlanticHud = commanderCards[0]
  const continentalHud = commanderCards[1]
  const hudFocusCommander = commanderCards[hudFocusPlayerIndex]
  const hudFocusRivalCommander = commanderCards[hudFocusPlayerIndex === 0 ? 1 : 0]
  const battleSceneTeams = commanderCards.map((card) => ({
    active: card.isActive,
    agi: card.agi,
    capital: card.player.capital,
    escalation: card.escalation,
    faction: card.player.faction,
    heroCount: card.player.heroCount,
    projectedPoints: card.projectedPoints,
    production: card.player.production,
    systems: card.systems,
  })) as [{
    active: boolean
    agi: number
    capital: number
    escalation: number
    faction: 'ATLANTIC' | 'CONTINENTAL'
    heroCount: number
    projectedPoints: number
    production: {
      energy: number
      materials: number
      compute: number
    }
    systems: number
  }, {
    active: boolean
    agi: number
    capital: number
    escalation: number
    faction: 'ATLANTIC' | 'CONTINENTAL'
    heroCount: number
    projectedPoints: number
    production: {
      energy: number
      materials: number
      compute: number
    }
    systems: number
  }]
  const pointsLeader = Math.max(...commanderCards.map((card) => card.projectedPoints), 1)
  const pointsDelta = hudFocusCommander.projectedPoints - hudFocusRivalCommander.projectedPoints
  const pointsStatus = pointsDelta > 0
    ? `Leading by ${pointsDelta}`
    : pointsDelta < 0
      ? `Behind by ${Math.abs(pointsDelta)}`
      : 'Tied right now'
  const victoryTracks = [
    {
      key: 'agi',
      glyph: HUD_GLYPHS.agi,
      label: 'AGI breakthrough',
      rule: 'Reach 6 AGI to win immediately.',
      value: `${hudFocusCommander.agi}/6`,
      progress: clampHudProgress(hudFocusCommander.agi / 6),
      fillClass: 'hud-victory-fill-agi',
      winType: 'Instant',
      isFinalScoring: false,
    },
    {
      key: 'esc',
      glyph: HUD_GLYPHS.escalation,
      label: 'Escalation edge',
      rule: 'Push escalation to your end of the track.',
      value: `${hudFocusCommander.escalation}/6`,
      progress: clampHudProgress(hudFocusCommander.escalation / 6),
      fillClass: 'hud-victory-fill-esc',
      winType: 'Instant',
      isFinalScoring: false,
    },
    {
      key: 'sys',
      glyph: HUD_GLYPHS.systems,
      label: 'System set',
      rule: 'Collect all 4 system types.',
      value: `${hudFocusCommander.systems}/${ALL_SYSTEM_TYPES.length}`,
      progress: clampHudProgress(hudFocusCommander.systems / ALL_SYSTEM_TYPES.length),
      fillClass: 'hud-victory-fill-sys',
      winType: 'Instant',
      isFinalScoring: false,
    },
    {
      key: 'pts',
      glyph: HUD_GLYPHS.points,
      label: 'Points lead',
      rule: 'Only decides the match after Age III ends.',
      value: `${hudFocusCommander.projectedPoints} pts`,
      progress: clampHudProgress(hudFocusCommander.projectedPoints / pointsLeader),
      fillClass: 'hud-victory-fill-pts',
      winType: 'Final',
      isFinalScoring: true,
      status: pointsStatus,
      statusClass: pointsDelta > 0
        ? 'hud-victory-score-chip-lead'
        : pointsDelta < 0
          ? 'hud-victory-score-chip-trail'
          : 'hud-victory-score-chip-tied',
    },
  ] as const

  const handleJoinById = async () => {
    const parsed = Number(joinGameId)
    if (!Number.isFinite(parsed) || parsed <= 0) return
    await joinGame(parsed)
    setJoinGameId('')
  }

  const showLobbyScreen = selectedGameId === null
  const showLoadingState = isLoadingGame && selectedSummary?.phase !== 'LOBBY' && pyramid.length === 0
  const showLobbyWaitingState = Boolean(selectedSummary && selectedSummary.phase === 'LOBBY')
  const showWaitingChoice =
    systemBonusChoice !== null && (!isCurrentUserTurn || localPlayerIndex !== systemBonusChoice.playerIndex)
  const isBattleView = !showLobbyScreen && !showLoadingState && !showLobbyWaitingState

  useEffect(() => {
    document.body.classList.toggle('game-active', isBattleView)
    return () => {
      document.body.classList.remove('game-active')
    }
  }, [isBattleView])

  return (
    <div className={`game-shell relative isolate flex flex-col text-ink ${isBattleView ? 'h-screen overflow-hidden' : 'min-h-screen gap-4 pb-6'}`}>
      {isBattleView && (
        <StrategicMapBackground
          age={age}
          className="absolute inset-0 -z-10"
          phase={phase}
          selectedType={selectedNode?.card.type ?? null}
          teams={battleSceneTeams}
          variant="battle"
          winner={winner}
        />
      )}
      {!isBattleView && (
      <header className="game-topbar rounded-[30px] px-4 py-4 md:px-6 md:py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-3 md:gap-4">
            <div>
              <p className="section-label mb-1">Strategic Command Simulator</p>
              <h1 className="font-display text-2xl font-black tracking-[0.02em] text-ink md:text-[2rem]">
                BLOC<span className="text-continental">:</span>DUEL
              </h1>
            </div>

            {selectedGameId !== null && (
              <span className="command-chip rounded-full px-3 py-1 font-mono text-xs font-bold text-ink-muted">
                Game #{selectedGameId}
              </span>
            )}
            {selectedGameId !== null && (
              <span className="command-chip rounded-full px-3 py-1 font-mono text-xs text-ink-muted">
                {PHASE_LABELS[phase]}
              </span>
            )}
            {selectedGameId !== null && phase !== 'LOBBY' && (
              <span className="command-chip rounded-full px-3 py-1 font-mono text-xs font-bold text-ink-muted">
                Age {AGE_LABELS[age]}
              </span>
            )}
            {currentTurnLabel && (
              <motion.span
                key={stageAnimationKey}
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                className={
                  `rounded-full border px-3 py-1 font-mono text-xs ${
                    currentTurnIsLocalWallet
                      ? 'border-emerald-300 bg-emerald-50/90 text-emerald-700 shadow-[0_8px_24px_rgba(16,185,129,0.16)]'
                      : 'border-white/70 bg-white/60 text-ink-muted'
                  }`
                }
              >
                Turn: {currentTurnLabel}
                {currentTurnIsLocalWallet && phase !== 'GAME_OVER' ? ' - your move' : ''}
              </motion.span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {onBackHome && (
              <button
                onClick={() => {
                  setSelectedGameId(null)
                  onBackHome()
                }}
                className="command-chip rounded-xl px-3 py-2 font-mono text-[11px] font-medium text-ink-muted transition hover:-translate-y-0.5 hover:text-ink"
              >
                Home
              </button>
            )}
            {selectedGameId !== null && (
              <button
                onClick={() => setSelectedGameId(null)}
                className="command-chip rounded-xl px-3 py-2 font-mono text-[11px] font-medium text-ink-muted transition hover:-translate-y-0.5 hover:text-ink"
              >
                Lobby
              </button>
            )}
            <button
              onClick={() => {
                clearError()
                if (!runtimeReady) {
                  reloadRuntime()
                  return
                }
                void refreshGames()
                void refreshGame(selectedGameId)
              }}
              className="command-chip rounded-xl px-3 py-2 font-mono text-[11px] font-medium text-ink-muted transition hover:-translate-y-0.5 hover:text-ink"
            >
              Refresh
            </button>
            <button
              onClick={() => void createGame()}
              disabled={!runtimeReady || !isConnected || isSubmitting}
              className="rounded-xl border border-transparent bg-[linear-gradient(135deg,#112038,#24446f)] px-4 py-2 font-mono text-[11px] font-semibold text-white shadow-[0_12px_24px_rgba(17,32,56,0.22)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
            >
              New Match
            </button>
            {walletMode === 'burner' ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="command-chip rounded-xl px-3 py-2 font-mono text-[11px] font-medium text-ink-muted">
                  {isConnected
                    ? `Seat ${String((burnerIndex ?? 0) + 1).padStart(2, '0')}/${String(Math.max(1, burnerAddresses.length)).padStart(2, '0')} ${shortAddress(address)}`
                    : 'Preparing burner seat...'}
                </span>
                {burnerAddresses.length > 1 && (
                  <select
                    value={burnerIndex ?? 0}
                    onChange={(event) => switchBurner(Number(event.target.value))}
                    className="command-chip rounded-xl px-3 py-2 font-mono text-[11px] font-medium text-ink-muted outline-none transition hover:text-ink"
                  >
                    {burnerAddresses.map((burnerAddress, index) => (
                      <option key={burnerAddress} value={index}>
                        {`Seat ${index + 1} ${shortAddress(burnerAddress)}`}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : isConnected ? (
              <button
                onClick={() => disconnect()}
                disabled={isDisconnecting}
                className="command-chip rounded-xl px-3 py-2 font-mono text-[11px] font-medium text-ink-muted transition hover:-translate-y-0.5 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                Controller {shortAddress(address)}
              </button>
            ) : (
              <button
                onClick={() => {
                  if (controllerConnector) {
                    void connect({ connector: controllerConnector })
                  }
                }}
                disabled={!controllerConnector || isPending}
                className="command-chip rounded-xl px-3 py-2 font-mono text-[11px] font-medium text-ink-muted transition hover:-translate-y-0.5 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                Connect Controller
              </button>
            )}
          </div>
        </div>
      </header>
      )}

      {error && (
        <div className="mx-auto w-full max-w-[1760px] px-4 md:px-6">
          <div className="rounded-2xl border border-red-200/80 bg-red-50/90 px-4 py-3 font-mono text-xs text-red-700 shadow-[0_10px_30px_rgba(239,68,68,0.1)]">
            {error}
          </div>
        </div>
      )}

      {runtimeError && (
        <div className="mx-auto w-full max-w-[1760px] px-4 md:px-6">
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 font-mono text-xs text-amber-700 shadow-[0_10px_30px_rgba(245,158,11,0.12)]">
            {runtimeError}
          </div>
        </div>
      )}

      {isBootstrappingRuntime && (
        <div className="mx-auto w-full max-w-[1760px] px-4 md:px-6">
          <div className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3 font-mono text-xs text-ink-faint shadow-[0_10px_28px_rgba(73,92,120,0.08)]">
            Initializing Dojo and Torii...
          </div>
        </div>
      )}

      {showLobbyScreen ? (
        <div className="mx-auto flex w-full max-w-[1760px] flex-col gap-6 px-4 py-2 md:px-6">
          <section className="panel-steel rounded-[34px] p-6 md:p-8">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
              <div>
                <p className="section-label mb-2">War Room</p>
                <h2 className="font-display text-3xl font-black text-ink md:text-5xl">Launch a new bloc skirmish</h2>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-muted md:text-base">
                  Create a live match, share the game id, and jump into the three-age draft as soon as both commanders are seated.
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/75 bg-white/82 px-3 py-1 font-mono text-[11px] font-semibold text-ink-muted">3 ages</span>
                  <span className="rounded-full border border-white/75 bg-white/82 px-3 py-1 font-mono text-[11px] font-semibold text-ink-muted">10-card pyramid</span>
                  <span className="rounded-full border border-white/75 bg-white/82 px-3 py-1 font-mono text-[11px] font-semibold text-ink-muted">4 win paths</span>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <input
                    value={joinGameId}
                    onChange={(event) => setJoinGameId(event.target.value)}
                    placeholder="Enter a game id"
                    className="rounded-[22px] border border-white/80 bg-white/80 px-4 py-3 font-mono text-sm text-ink outline-none transition focus:border-atlantic focus:ring-2 focus:ring-atlantic/20"
                  />
                  <button
                    onClick={() => void handleJoinById()}
                    disabled={!runtimeReady || !isConnected || isSubmitting}
                    className="rounded-[22px] bg-[linear-gradient(135deg,#112038,#2a537f)] px-5 py-3 font-mono text-sm font-semibold text-white shadow-[0_18px_28px_rgba(17,32,56,0.18)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Join by id
                  </button>
                </div>
              </div>

              <div className="panel-glass rounded-[28px] p-5">
                <p className="section-label mb-2">Fast Briefing</p>
                <h3 className="font-display text-2xl font-black text-ink">Match flow</h3>
                <div className="mt-4 space-y-3">
                  {TURN_FLOW.map((step, index) => (
                    <div
                      key={step}
                      className="rounded-[22px] border border-white/75 bg-white/76 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)]"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-atlantic text-sm font-black text-white">
                          {index + 1}
                        </span>
                        <p className="text-sm text-ink-muted">{step}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <div className="panel-glass rounded-[28px] p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-2xl font-black text-ink">My Games</h3>
                <span className="font-mono text-[11px] text-ink-faint">{myGames.length}</span>
              </div>

              {isLoadingGames && games.length === 0 ? (
                <p className="font-mono text-xs text-ink-faint">Loading games...</p>
              ) : myGames.length === 0 ? (
                <p className="font-mono text-xs text-ink-faint">No games linked to this wallet yet.</p>
              ) : (
                <div className="space-y-3">
                  {myGames.map((game) => (
                    <button
                      key={game.gameId}
                      onClick={() => setSelectedGameId(game.gameId)}
                      className="flex w-full items-center justify-between rounded-[24px] border border-white/75 bg-white/78 px-4 py-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.76)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_28px_rgba(65,84,110,0.12)]"
                    >
                      <div>
                        <p className="font-display text-xl font-black text-ink">#{game.gameId}</p>
                        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">{PHASE_LABELS[game.phase]}</p>
                      </div>
                      <div className="text-right font-mono text-[11px] text-ink-muted">
                        <p>{shortAddress(game.playerOne)}</p>
                        <p>{isZeroAddress(game.playerTwo) ? 'waiting for opponent' : shortAddress(game.playerTwo)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="panel-glass rounded-[28px] p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-2xl font-black text-ink">Open Lobbies</h3>
                <span className="font-mono text-[11px] text-ink-faint">{openLobbies.length}</span>
              </div>

              {openLobbies.length === 0 ? (
                <p className="font-mono text-xs text-ink-faint">No waiting lobbies right now.</p>
              ) : (
                <div className="space-y-3">
                  {openLobbies.map((game) => (
                    <div
                      key={game.gameId}
                      className="flex items-center justify-between rounded-[24px] border border-white/75 bg-white/78 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.76)]"
                    >
                      <div>
                        <p className="font-display text-xl font-black text-ink">#{game.gameId}</p>
                        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
                          Host {shortAddress(game.playerOne)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedGameId(game.gameId)}
                          className="command-chip rounded-xl px-3 py-2 font-mono text-[11px] text-ink-muted transition hover:-translate-y-0.5 hover:text-ink"
                        >
                          View
                        </button>
                        <button
                          onClick={() => void joinGame(game.gameId)}
                          disabled={!runtimeReady || !canJoinGame(game, address ?? null) || isSubmitting}
                          className="rounded-xl bg-[linear-gradient(135deg,#112038,#2a537f)] px-3.5 py-2 font-mono text-[11px] font-semibold text-white shadow-[0_12px_20px_rgba(17,32,56,0.16)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          Join
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      ) : showLoadingState ? (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8 md:px-6">
          <section className="panel-steel rounded-[30px] p-8 text-center">
            <p className="section-label">Syncing</p>
            <h2 className="mt-2 font-display text-3xl font-black text-ink">Loading live theater state</h2>
            <p className="mt-2 text-sm text-ink-muted">Fetching the latest board, dossiers, and faction telemetry from Torii.</p>
          </section>
        </div>
      ) : showLobbyWaitingState ? (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-8 md:px-6">
          <section className="panel-steel rounded-[32px] p-8 text-center">
            <p className="section-label">Lobby</p>
            <h2 className="mt-2 font-display text-4xl font-black text-ink">Waiting for a rival commander</h2>
            <p className="mt-3 text-sm text-ink-muted">
              Share game id <span className="font-mono font-bold text-ink">#{selectedSummary!.gameId}</span> with your opponent.
            </p>

            <div className="mt-6 grid gap-3 rounded-[28px] border border-white/80 bg-white/78 p-5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.76)] sm:grid-cols-2">
              <div>
                <p className="section-label mb-2">Atlantic</p>
                <p className="font-mono text-sm font-bold text-ink">{shortAddress(players[0].address)}</p>
              </div>
              <div>
                <p className="section-label mb-2">Continental</p>
                <p className="font-mono text-sm font-bold text-ink">
                  {isZeroAddress(players[1].address) ? 'Waiting...' : shortAddress(players[1].address)}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => setSelectedGameId(null)}
                className="command-chip rounded-2xl px-4 py-2 font-mono text-sm text-ink-muted transition hover:-translate-y-0.5 hover:text-ink"
              >
                Back to lobby list
              </button>
              <button
                onClick={() => void joinGame(selectedSummary!.gameId)}
                disabled={!runtimeReady || !canJoinGame(selectedSummary!, address ?? null) || isSubmitting}
                className="rounded-2xl bg-[linear-gradient(135deg,#112038,#2a537f)] px-5 py-2.5 font-mono text-sm font-semibold text-white shadow-[0_18px_28px_rgba(17,32,56,0.18)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Join this match
              </button>
            </div>
          </section>
        </div>
      ) : (
        <div className="flex-1 min-h-0 px-2 pb-2 pt-2 md:px-3">
          {isLoadingGame && (
            <div className="mb-3 w-full rounded-2xl border border-white/70 bg-white/72 px-4 py-3 font-mono text-xs text-ink-faint shadow-[0_12px_22px_rgba(72,93,119,0.08)]">
              Syncing live game state...
            </div>
          )}

          <div className="flex h-full w-full flex-col gap-3 overflow-hidden">
            <section className="hud-compact-bar rounded-[20px] px-2.5 py-1.5 md:px-3 md:py-1.5">
              <div className="flex items-center gap-2">
                <div className="flex shrink-0 items-center gap-2">
                  {(onBackHome || selectedGameId !== null) && (
                    <button
                      onClick={() => {
                        setSelectedGameId(null)
                        onBackHome?.()
                      }}
                      className="hud-utility-btn"
                    >
                      Back
                    </button>
                  )}
                </div>

                <div className="scrollbar-hidden flex min-w-0 flex-1 items-center justify-center gap-2 overflow-x-auto whitespace-nowrap">
                  <span className="hud-status-pill">{PHASE_LABELS[phase]}</span>
                  <span className="hud-status-pill">Age {AGE_LABELS[age]}</span>
                  <span className={`hud-status-pill ${currentTurnIsLocalWallet ? 'hud-status-pill-live' : ''}`}>
                    Turn: {currentTurnLabel ?? 'Awaiting seat'}
                  </span>
                  <span className="hud-status-pill">Sell +{sellValue}</span>
                  <span className="hud-status-pill">Win: {winner === null ? 'Live' : WIN_CONDITION_LABELS[winCondition]}</span>
                  <span className="hud-top-divider" />
                  <div className="hud-top-stat">
                    <span className="hud-top-stat-label">{HUD_GLYPHS.capital} Capital</span>
                    <span className="hud-top-stat-value">{hudFocusPlayer.capital}</span>
                  </div>
                  <div className="hud-top-stat">
                    <span className="hud-top-stat-label">{RESOURCE_ICONS.energy} Energy</span>
                    <span className="hud-top-stat-value">{hudFocusPlayer.production.energy}</span>
                  </div>
                  <div className="hud-top-stat">
                    <span className="hud-top-stat-label">{RESOURCE_ICONS.materials} Materials</span>
                    <span className="hud-top-stat-value">{hudFocusPlayer.production.materials}</span>
                  </div>
                  <div className="hud-top-stat">
                    <span className="hud-top-stat-label">{RESOURCE_ICONS.compute} Compute</span>
                    <span className="hud-top-stat-value">{hudFocusPlayer.production.compute}</span>
                  </div>
                  <div className="hud-top-stat">
                    <span className="hud-top-stat-label">{HUD_GLYPHS.selection} Selected</span>
                    <span className="hud-top-stat-value hud-top-stat-value-card">{selectedNode ? selectedNode.card.type : 'None'}</span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {walletMode === 'burner' ? (
                    <>
                      <span className="hud-inline-chip text-white/80">
                        Seat {String((burnerIndex ?? 0) + 1).padStart(2, '0')}/{String(Math.max(1, burnerAddresses.length)).padStart(2, '0')} {shortAddress(address)}
                      </span>
                      {burnerAddresses.length > 1 && (
                        <select
                          value={burnerIndex ?? 0}
                          onChange={(event) => switchBurner(Number(event.target.value))}
                          className="hud-select"
                        >
                          {burnerAddresses.map((burnerAddress, index) => (
                            <option key={burnerAddress} value={index}>
                              {`Seat ${index + 1} ${shortAddress(burnerAddress)}`}
                            </option>
                          ))}
                        </select>
                      )}
                    </>
                  ) : isConnected ? (
                    <button
                      onClick={() => disconnect()}
                      disabled={isDisconnecting}
                      className="hud-utility-btn"
                    >
                      {shortAddress(address)}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (controllerConnector) {
                          void connect({ connector: controllerConnector })
                        }
                      }}
                      disabled={!controllerConnector || isPending}
                      className="hud-utility-btn"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>
            </section>

            <div className="min-h-0 grid flex-1 gap-3 xl:grid-cols-[288px_minmax(0,1fr)]">
              <aside className="hidden min-h-0 xl:flex xl:flex-col xl:gap-3">
                <div className="hud-panel rounded-[26px] p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="section-label text-white/50">{HUD_GLYPHS.points} How to win</p>
                    <span className="hud-inline-chip text-[10px] text-white/68">
                      {hudFocusCommander.isLocal ? 'Your commander' : 'Enemy commander'}
                    </span>
                  </div>
                  <div className="hud-victory-guide">
                    {victoryTracks.map((track) => (
                      <div key={track.key} className="hud-victory-row">
                        <span className="hud-victory-glyph hud-victory-glyph-row">{track.glyph}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="hud-victory-title">{track.label}</span>
                            <span className="hud-victory-kind">{track.winType}</span>
                          </div>
                          <p className="hud-victory-rule">{track.rule}</p>
                          {track.isFinalScoring ? (
                            <div className="hud-victory-progress hud-victory-progress-final">
                              <span className="hud-victory-value">{track.value}</span>
                              <span className={`hud-victory-score-chip ${track.statusClass}`}>{track.status}</span>
                            </div>
                          ) : (
                            <div className="hud-victory-progress">
                              <div className="hud-victory-progress-track">
                                <div
                                  className={`hud-victory-fill ${track.fillClass}`}
                                  style={{ width: `${track.progress * 100}%` }}
                                />
                              </div>
                              <span className="hud-victory-value">{track.value}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <CommanderHudCard
                  player={atlanticHud.player}
                  agi={atlanticHud.agi}
                  escalation={atlanticHud.escalation}
                  systems={atlanticHud.systems}
                  projectedPoints={atlanticHud.projectedPoints}
                  isActive={atlanticHud.isActive}
                  isLocal={atlanticHud.isLocal}
                  onHeroClick={atlanticHud.isLocal && canInvokeHero ? toggleHeroPicker : undefined}
                  canInvokeHero={atlanticHud.isLocal ? canInvokeHero : false}
                  heroSurcharge={atlanticHud.isLocal ? localHeroSurcharge : undefined}
                />

                <CommanderHudCard
                  player={continentalHud.player}
                  agi={continentalHud.agi}
                  escalation={continentalHud.escalation}
                  systems={continentalHud.systems}
                  projectedPoints={continentalHud.projectedPoints}
                  isActive={continentalHud.isActive}
                  isLocal={continentalHud.isLocal}
                  onHeroClick={continentalHud.isLocal && canInvokeHero ? toggleHeroPicker : undefined}
                  canInvokeHero={continentalHud.isLocal ? canInvokeHero : false}
                  heroSurcharge={continentalHud.isLocal ? localHeroSurcharge : undefined}
                />
              </aside>

              <section className="table-surface table-surface-battle relative min-h-0 overflow-hidden rounded-[34px] px-4 py-4 md:px-6 md:py-5">
                <div className="relative z-10 flex h-full min-h-0 flex-col">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="section-label mb-1 text-white/45">{HUD_GLYPHS.board} Operational Theater</p>
                      <h2 className="font-display text-[1.45rem] font-black leading-none text-white md:text-[1.8rem]">
                        Battle board
                      </h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-white/80 bg-white/86 px-3 py-1 font-mono text-[11px] font-semibold text-continental">
                        Sell +{sellValue}
                      </span>
                      <span className="rounded-full border border-white/80 bg-white/86 px-3 py-1 font-mono text-[11px] font-semibold text-ink-muted">
                        {currentTurnIsLocalWallet ? 'Your move' : 'Observe'}
                      </span>
                      <button
                        onClick={() => setIsGuideOpen((currentOpen) => !currentOpen)}
                        className="rounded-full border border-atlantic/25 bg-atlantic/10 px-3 py-1 font-mono text-[11px] font-semibold text-atlantic transition hover:-translate-y-0.5"
                      >
                        {isGuideOpen ? 'Hide guide' : 'Show guide'}
                      </button>
                    </div>
                  </div>

                  <PlayField
                    playerIndex={topPlayer}
                    label="Enemy network"
                    emptyHint="Enemy deployments appear here."
                    compact
                    immersive
                  />

                  <div className="relative my-4 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[30px] border border-white/16 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.06),rgba(8,18,34,0.04)_36%,rgba(8,18,34,0.16)_100%)] px-4 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]">
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_30%,rgba(8,18,34,0.12))]" />
                    <div className="relative z-10 flex w-full justify-center">
                      <CardPyramid
                        key={`${selectedGameId ?? 'none'}-${age}`}
                        dropRefs={dropRefs}
                        onPlay={(position) => void playCardAt(position)}
                        onDiscard={(position) => void discardCardAt(position)}
                        onDragOverZone={setActiveDragZone}
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_260px]">
                    <PlayField
                      ref={playFieldRef}
                      playerIndex={bottomPlayer}
                      isHighlighted={activeDragZone === 'play'}
                      label="Your network"
                      emptyHint="Deploy drafted cards here."
                      targetLabel="Drop to deploy"
                      compact
                      immersive
                    />
                    <DiscardZone
                      ref={discardRef}
                      sellValue={sellValue}
                      isHighlighted={activeDragZone === 'discard'}
                      compact
                      immersive
                    />
                  </div>
                </div>
              </section>

            </div>

            <GuideSidebar
              open={isGuideOpen}
              onClose={() => setIsGuideOpen(false)}
              missionQuestion={missionQuestion}
              missionAnswer={missionAnswer}
            />
          </div>

          <AnimatePresence>
            {selectedNode && phase === 'DRAFTING' && (
              <CardZoom
                card={selectedNode.card}
                affordable={canAffordCard}
                isFreeViaChain={isFreeViaChain}
                effectiveCost={selectedEffectiveCost}
                sellValue={sellValue}
                onPlay={() => { void playCard() }}
                onDiscard={() => { void discardCard() }}
                onClose={() => useGameStore.getState().selectCard(selectedNode.position)}
              />
            )}
          </AnimatePresence>

          <HeroPicker />

          {systemBonusChoice && localPlayerIndex === systemBonusChoice.playerIndex && (
            <SystemBonusChoice
              playerName={players[systemBonusChoice.playerIndex].name}
              options={systemBonusChoice.options}
              onChoose={(symbol) => { void chooseSystemBonus(symbol) }}
            />
          )}

          <AnimatePresence>
            {showWaitingChoice && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 flex items-center justify-center bg-[radial-gradient(circle,rgba(17,32,56,0.18),rgba(17,32,56,0.5))] px-4 backdrop-blur-sm"
              >
                <div className="panel-steel rounded-[30px] px-8 py-6 text-center">
                  <p className="font-display text-xl font-black text-ink">Waiting for system bonus</p>
                  <p className="mt-2 font-mono text-xs text-ink-muted">
                    {players[systemBonusChoice.playerIndex].name} is choosing a permanent bonus.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {phase === 'AGE_TRANSITION' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-[radial-gradient(circle,rgba(17,32,56,0.18),rgba(17,32,56,0.56))] px-4 backdrop-blur-sm"
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="panel-steel rounded-[32px] p-10 text-center"
                >
                  <h2 className="mb-2 font-display text-3xl font-black text-ink">
                    Age {AGE_LABELS[age]} Complete
                  </h2>
                  <p className="mb-6 text-sm text-ink-muted">
                    {isCurrentUserTurn
                      ? 'Advance the contracts to the next age when ready.'
                      : 'Waiting for the active player to start the next age.'}
                  </p>
                  <button
                    onClick={() => { void nextAge() }}
                    disabled={!isCurrentUserTurn || isSubmitting}
                    className="rounded-2xl bg-[linear-gradient(135deg,#112038,#2a537f)] px-8 py-3 font-display text-sm font-bold text-white shadow-[0_20px_32px_rgba(17,32,56,0.22)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Begin Age {AGE_LABELS[nextAgeValue]}
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {phase === 'GAME_OVER' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-[radial-gradient(circle,rgba(17,32,56,0.18),rgba(17,32,56,0.56))] px-4 backdrop-blur-sm"
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="panel-steel rounded-[32px] p-10 text-center"
                >
                  <h2 className="mb-2 font-display text-3xl font-black text-ink">Game Over</h2>
                  <p className="mb-1 font-display text-lg font-bold text-ink">{winnerLabel}</p>
                  <p className="mb-6 text-sm text-ink-muted">{WIN_CONDITION_LABELS[winCondition]}</p>
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => setSelectedGameId(null)}
                      className="command-chip rounded-2xl px-5 py-3 font-display text-sm font-bold text-ink-muted transition hover:-translate-y-0.5 hover:text-ink"
                    >
                      Lobby
                    </button>
                    <button
                      onClick={() => void createGame()}
                      disabled={!runtimeReady || !isConnected || isSubmitting}
                      className="rounded-2xl bg-[linear-gradient(135deg,#112038,#2a537f)] px-5 py-3 font-display text-sm font-bold text-white shadow-[0_20px_32px_rgba(17,32,56,0.22)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      New Match
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

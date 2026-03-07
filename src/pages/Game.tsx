import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useConnect, useDisconnect } from "@starknet-react/core";
import { canAfford, getSellValue, useUIStore } from "../store/gameStore";
import { useDojo } from "../dojo/useDojo";
import { useGameState } from "../dojo/useGameState";
import { toSystemTypeEnum, useGameActions } from "../dojo/useGameActions";
import CardPyramid from "../components/CardPyramid";
import AGITrack from "../components/AGITrack";
import EscalationTrack from "../components/EscalationTrack";
import PlayerStatsBar from "../components/PlayerStatsBar";
import PlayField from "../components/PlayField";
import DiscardZone from "../components/DiscardZone";
import HeroPicker from "../components/HeroPicker";
import CardZoom from "../components/CardZoom";
import SystemBonusChoice from "../components/SystemBonusChoice";

const AGE_LABELS = { 1: "I", 2: "II", 3: "III" } as const;

export function Game() {
  const { account } = useDojo();
  const { connect, connectors, pendingConnector, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  const { gameId, setGameId, selectedCard, selectCard } = useUIStore();
  const {
    createGame,
    joinGame,
    playCard,
    discardCard,
    chooseSystemBonus,
    nextAge,
  } = useGameActions();
  const {
    players,
    currentPlayer,
    phase,
    age,
    pyramid,
    agiTrack,
    escalationTrack,
    systemBonusChoice,
  } = useGameState(gameId);

  const [joinInput, setJoinInput] = useState("");

  const bottomPlayer = currentPlayer;
  const topPlayer: 0 | 1 = currentPlayer === 0 ? 1 : 0;

  const playFieldRef = useRef<HTMLDivElement>(null);
  const discardRef = useRef<HTMLDivElement>(null);

  const [activeDragZone, setActiveDragZone] = useState<"play" | "discard" | null>(null);

  const dropRefs = { playField: playFieldRef, discard: discardRef };

  const current = players[currentPlayer];
  const selectedNode = selectedCard !== null ? pyramid.find((n) => n.position === selectedCard) : null;

  const isFreeViaChain = selectedNode?.card.chainFrom
    ? current.playedCards.includes(selectedNode.card.chainFrom)
    : false;

  const canAffordCard = selectedNode
    ? isFreeViaChain || canAfford(current, selectedNode.card.cost)
    : false;

  const sellValue = getSellValue(age);

  const getVictoryInfo = () => {
    const p0unique = new Set(players[0].systems).size;
    const p1unique = new Set(players[1].systems).size;
    if (p0unique >= 4) return { winner: players[0].name, reason: "Systems Dominance" };
    if (p1unique >= 4) return { winner: players[1].name, reason: "Systems Dominance" };
    if (agiTrack[0] >= 6) return { winner: players[0].name, reason: "AGI Breakthrough" };
    if (agiTrack[1] >= 6) return { winner: players[1].name, reason: "AGI Breakthrough" };
    if (escalationTrack >= 6) return { winner: players[0].name, reason: "Escalation Dominance" };
    if (escalationTrack <= -6) return { winner: players[1].name, reason: "Escalation Dominance" };
    const score = (idx: 0 | 1) => agiTrack[idx] + players[idx].systems.length + players[idx].heroes.length;
    const s0 = score(0);
    const s1 = score(1);
    if (s0 > s1) return { winner: players[0].name, reason: `Points ${s0}-${s1}` };
    if (s1 > s0) return { winner: players[1].name, reason: `Points ${s1}-${s0}` };
    return { winner: "Nobody", reason: `Tie ${s0}-${s1}` };
  };

  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-4">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-surface-raised p-6 shadow-xl">
          <h1 className="font-display text-xl font-black text-ink">BLOC:DUEL</h1>
          <p className="mt-2 font-body text-sm text-ink-muted">Connect your wallet to start a game on Katana.</p>
          <div className="mt-4 flex flex-col gap-2">
            {connectors.map((connector) => (
              <button
                key={connector.id}
                onClick={() => connect({ connector })}
                disabled={!connector.available() || isPending}
                className="rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-ink transition hover:border-ink-faint disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending && pendingConnector?.id === connector.id ? "Connecting..." : `Connect ${connector.name}`}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (gameId === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-4">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-surface-raised p-6 shadow-xl">
          <h1 className="font-display text-xl font-black text-ink">BLOC:DUEL Lobby</h1>
          <p className="mt-2 font-body text-sm text-ink-muted">Create a game or join an existing game id.</p>

          <button
            onClick={() => {
              void createGame();
            }}
            className="mt-4 w-full rounded-lg bg-ink px-3 py-2 font-mono text-xs font-semibold text-white transition hover:bg-ink/80"
          >
            Create Game
          </button>

          <div className="mt-3 flex gap-2">
            <input
              value={joinInput}
              onChange={(event) => setJoinInput(event.target.value)}
              placeholder="Game ID"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-ink"
            />
            <button
              onClick={() => {
                const parsed = Number.parseInt(joinInput, 10);
                if (Number.isNaN(parsed)) return;
                void joinGame(parsed);
              }}
              className="rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-ink transition hover:border-ink-faint"
            >
              Join
            </button>
          </div>

          <button
            onClick={() => {
              disconnect();
            }}
            className="mt-3 w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-ink-muted transition hover:text-ink"
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="md:h-screen md:overflow-hidden min-h-screen flex flex-col bg-surface">
      <header className="flex items-center justify-between px-3 py-2 shrink-0">
        <h1 className="font-display text-lg font-black tracking-tight text-ink">
          BLOC<span className="text-ink-faint">:</span>DUEL
        </h1>
        <span className="rounded-md bg-ink/5 px-2 py-0.5 font-mono text-xs font-bold text-ink-muted">
          Age {AGE_LABELS[age]}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              void createGame();
            }}
            className="rounded-md border border-border bg-surface-raised px-2.5 py-1 font-mono text-[10px] font-medium text-ink-muted transition hover:border-ink-faint hover:text-ink"
          >
            New Game
          </button>
          <button
            onClick={() => setGameId(null)}
            className="rounded-md border border-border bg-surface-raised px-2.5 py-1 font-mono text-[10px] font-medium text-ink-muted transition hover:border-ink-faint hover:text-ink"
          >
            Lobby
          </button>
        </div>
      </header>

      <div className="flex flex-col flex-1 px-2 md:px-3 pb-2 gap-1.5 md:gap-2 md:overflow-hidden">
        <PlayerStatsBar playerIndex={topPlayer} isBottom={false} />
        <PlayField playerIndex={topPlayer} />

        <div className="flex flex-col md:flex-row gap-1.5 md:gap-3 px-1">
          <div className="flex-1">
            <p className="font-mono text-[8px] uppercase tracking-wider text-ink-faint mb-0.5 text-center">AGI</p>
            <AGITrack />
          </div>
          <div className="flex-1">
            <p className="font-mono text-[8px] uppercase tracking-wider text-ink-faint mb-0.5 text-center">Escalation</p>
            <EscalationTrack />
          </div>
        </div>

        <DiscardZone ref={discardRef} sellValue={sellValue} isHighlighted={activeDragZone === "discard"} />

        <div className="flex-1 flex items-center justify-center min-h-0 py-1">
          <CardPyramid
            dropRefs={dropRefs}
            onPlay={(position) => {
              void playCard(position);
            }}
            onDiscard={(position) => {
              void discardCard(position);
            }}
            onDragOverZone={setActiveDragZone}
          />
        </div>

        <PlayField
          ref={playFieldRef}
          playerIndex={bottomPlayer}
          isHighlighted={activeDragZone === "play"}
        />

        <PlayerStatsBar playerIndex={bottomPlayer} isBottom={true} />
      </div>

      <AnimatePresence>
        {selectedNode && phase === "DRAFTING" && (
          <CardZoom
            card={selectedNode.card}
            affordable={canAffordCard}
            isFreeViaChain={isFreeViaChain}
            sellValue={sellValue}
            onPlay={() => {
              void playCard(selectedNode.position);
            }}
            onDiscard={() => {
              void discardCard(selectedNode.position);
            }}
            onClose={() => selectCard(selectedNode.position)}
          />
        )}
      </AnimatePresence>

      <HeroPicker />

      {systemBonusChoice && (
        <SystemBonusChoice
          playerName={players[systemBonusChoice.playerIndex].name}
          options={systemBonusChoice.options}
          onChoose={(symbol) => {
            void chooseSystemBonus(toSystemTypeEnum(symbol));
          }}
        />
      )}

      <AnimatePresence>
        {phase === "AGE_TRANSITION" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="rounded-3xl bg-surface-raised p-10 text-center shadow-2xl border border-border"
            >
              <h2 className="font-display text-3xl font-black text-ink mb-2">
                Age {AGE_LABELS[age]} Complete
              </h2>
              <p className="text-sm text-ink-muted mb-6">Prepare for the next age.</p>
              <button
                onClick={() => {
                  void nextAge();
                }}
                className="rounded-xl bg-ink px-8 py-3 font-display text-sm font-bold text-white shadow-lg transition hover:bg-ink/80"
              >
                Begin Age {AGE_LABELS[(age + 1) as 1 | 2 | 3] ?? "III"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase === "GAME_OVER" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="rounded-3xl bg-surface-raised p-10 text-center shadow-2xl border border-border"
            >
              <h2 className="font-display text-3xl font-black text-ink mb-2">Game Over</h2>
              <p className="font-display text-lg font-bold text-ink mb-1">{getVictoryInfo().winner} Wins!</p>
              <p className="text-sm text-ink-muted mb-6">{getVictoryInfo().reason}</p>
              <button
                onClick={() => {
                  void createGame();
                }}
                className="rounded-xl bg-ink px-8 py-3 font-display text-sm font-bold text-white shadow-lg transition hover:bg-ink/80"
              >
                Play Again
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

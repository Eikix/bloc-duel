import { useEffect, useState } from 'react'
import type { Card } from '../game/cards'
import { getCardArtSources } from '../game/cardArt'

interface CardArtworkProps {
  card: Card
  className?: string
  imgClassName?: string
  fallbackClassName?: string
  loading?: 'eager' | 'lazy'
}

export default function CardArtwork({
  card,
  className = '',
  imgClassName = '',
  fallbackClassName = 'bg-slate-900',
  loading = 'lazy',
}: CardArtworkProps) {
  const [hasError, setHasError] = useState(false)
  const [currentFormat, setCurrentFormat] = useState<'webp' | 'png'>('webp')
  const art = getCardArtSources(card.name)
  const showArt = art && !hasError

  useEffect(() => {
    setHasError(false)
    setCurrentFormat('webp')
  }, [card.name])

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {showArt ? (
        <div className="block h-full w-full">
          <img
            src={currentFormat === 'webp' ? art.webp : art.png}
            alt=""
            loading={loading}
            draggable={false}
            className={`block h-full w-full object-cover object-center ${imgClassName}`}
            onError={() => {
              if (currentFormat === 'webp') {
                setCurrentFormat('png')
                return
              }

              setHasError(true)
            }}
          />
        </div>
      ) : (
        <div className={`h-full w-full ${fallbackClassName}`} />
      )}

      <div className="pointer-events-none absolute bottom-0 right-0 h-14 w-14 bg-[radial-gradient(circle_at_bottom_right,rgba(3,9,18,0.94),rgba(3,9,18,0.68)_32%,transparent_72%)]" />
    </div>
  )
}

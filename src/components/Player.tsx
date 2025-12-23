import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Repeat, Repeat1, Shuffle, Sparkles, Maximize2 } from 'lucide-react'
import { usePlayerStore } from '../store/playerStore'
import { formatTime } from '../utils/formatTime'
import { audioRef } from '../hooks/useAudioPlayer'
import { useState, useEffect } from 'react'
import './Player.css'

// Cache de imágenes de anime para el player
const playerAnimeCache = new Map<number, string>()

// Convertir ruta de archivo a local-file:// URL (protocolo registrado en Electron)
function toFileUrl(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, '/')
  return `local-file://${encodeURIComponent(normalizedPath)}`
}

// Componente de imagen con fallback de anime para el player
function PlayerCoverImage({ src, alt, trackId }: { src?: string; alt: string; trackId?: number }) {
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const [hasError, setHasError] = useState(false)
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null)

  // Obtener imagen de anime como fallback
  useEffect(() => {
    const id = trackId || 0
    
    if (playerAnimeCache.has(id)) {
      setFallbackUrl(playerAnimeCache.get(id)!)
      return
    }

    const fetchAnimeImage = async () => {
      try {
        const result = await window.electron.anime.getRandomImage()
        if (result.success && result.url) {
          playerAnimeCache.set(id, result.url)
          setFallbackUrl(result.url)
        }
      } catch (error) {
        setFallbackUrl('https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop')
      }
    }

    fetchAnimeImage()
  }, [trackId])

  // Procesar src cuando cambia
  useEffect(() => {
    setHasError(false)
    
    if (!src) {
      setImgSrc(null)
      return
    }

    // Si es URL HTTP, usar directamente
    if (src.startsWith('http://') || src.startsWith('https://')) {
      setImgSrc(src)
      return
    }

    // Si es base64 válido
    if (src.startsWith('data:image/') && src.length > 100) {
      setImgSrc(src)
      return
    }

    // Si es ruta de archivo local
    if (src.includes(':\\') || src.includes(':/') || src.startsWith('/')) {
      setImgSrc(toFileUrl(src))
      return
    }

    setImgSrc(null)
  }, [src])

  const handleError = () => {
    console.log(`[PlayerCoverImage] Error cargando imagen para: ${alt}`)
    setHasError(true)
  }

  if (hasError || !imgSrc) {
    return (
      <img 
        src={fallbackUrl || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop'} 
        alt={alt} 
        className="player-cover"
      />
    )
  }

  return (
    <img 
      src={imgSrc} 
      alt={alt} 
      className="player-cover" 
      onError={handleError}
    />
  )
}

interface PlayerProps {
  onOpenAnimeMode?: () => void
  onOpenFullscreenMode?: () => void
}

export default function Player({ onOpenAnimeMode, onOpenFullscreenMode }: PlayerProps) {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    repeatMode,
    isShuffled,
    setIsPlaying,
    setVolume,
    toggleMute,
    setRepeatMode,
    toggleShuffle,
    playNext,
    playPrevious,
    seek,
  } = usePlayerStore()

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = time
      seek(time)
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value))
  }

  const handleRepeatClick = () => {
    const modes: Array<'off' | 'all' | 'one'> = ['off', 'all', 'one']
    const currentIndex = modes.indexOf(repeatMode)
    const nextMode = modes[(currentIndex + 1) % modes.length]
    setRepeatMode(nextMode)
  }

  const getRepeatIcon = () => {
    if (repeatMode === 'one') return <Repeat1 size={20} />
    return <Repeat size={20} />
  }

  return (
    <div className="player">
      <div className="player-track-info">
        {currentTrack ? (
          <>
            <PlayerCoverImage 
              src={currentTrack.coverArt} 
              alt={currentTrack.album}
              trackId={currentTrack.id}
            />
            <div className="player-text">
              <div className="player-title">{currentTrack.title}</div>
              <div className="player-artist">{currentTrack.artist}</div>
            </div>
          </>
        ) : (
          <div className="player-text">
            <div className="player-title">No hay reproducción</div>
            <div className="player-artist">Selecciona una canción</div>
          </div>
        )}
      </div>

      <div className="player-controls">
        <div className="player-buttons">
          <button
            className={`control-btn ${isShuffled ? 'active' : ''}`}
            onClick={toggleShuffle}
            title="Aleatorio"
          >
            <Shuffle size={20} />
          </button>
          
          <button 
            className="control-btn"
            onClick={playPrevious}
            disabled={!currentTrack}
          >
            <SkipBack size={24} />
          </button>
          
          <button
            className="play-btn"
            onClick={() => setIsPlaying(!isPlaying)}
            disabled={!currentTrack}
          >
            {isPlaying ? <Pause size={24} /> : <Play size={24} />}
          </button>
          
          <button
            className="control-btn"
            onClick={playNext}
            disabled={!currentTrack}
          >
            <SkipForward size={24} />
          </button>
          
          <button
            className={`control-btn ${repeatMode !== 'off' ? 'active' : ''}`}
            onClick={handleRepeatClick}
            title={`Repetir: ${repeatMode}`}
          >
            {getRepeatIcon()}
          </button>
        </div>

        <div className="player-progress">
          <span className="time">{formatTime(currentTime)}</span>
          <input
            type="range"
            className="progress-bar"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            disabled={!currentTrack}
            style={{ '--progress': `${duration ? (currentTime / duration) * 100 : 0}%` } as React.CSSProperties}
          />
          <span className="time">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="player-volume">
        <button 
          onClick={onOpenFullscreenMode} 
          className={`control-btn fullscreen-mode-btn ${!currentTrack ? 'disabled' : ''}`}
          disabled={!currentTrack}
          title="Modo Pantalla Completa - Visualizador de música"
        >
          <Maximize2 size={20} />
        </button>
        <button 
          onClick={onOpenAnimeMode} 
          className={`control-btn anime-mode-btn ${!currentTrack ? 'disabled' : ''}`}
          disabled={!currentTrack}
          title="Modo Anime - Visualizador con imágenes"
        >
          <Sparkles size={20} />
        </button>
        <button onClick={toggleMute} className="control-btn">
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
        <input
          type="range"
          className="volume-bar"
          min="0"
          max="1"
          step="0.01"
          value={isMuted ? 0 : volume}
          onChange={handleVolumeChange}
          style={{ '--volume': `${(isMuted ? 0 : volume) * 100}%` } as React.CSSProperties}
        />
      </div>
    </div>
  )
}

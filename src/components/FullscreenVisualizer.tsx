import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Minimize2, Maximize2, SkipForward, SkipBack, Pause, Play, Repeat, Repeat1, Shuffle, ListMusic, ChevronRight } from 'lucide-react'
import { usePlayerStore } from '../store/playerStore'
import { audioRef } from '../hooks/useAudioPlayer'
import { CoverImage, VolumeSlider, ProgressBar } from './common'
import './FullscreenVisualizer.css'

interface FullscreenVisualizerProps {
  isOpen: boolean
  onClose: () => void
}

export default function FullscreenVisualizer({ isOpen, onClose }: FullscreenVisualizerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [showQueue, setShowQueue] = useState(true)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    repeatMode,
    isShuffled,
    queue,
    currentIndex,
    setIsPlaying,
    setVolume,
    toggleMute,
    setRepeatMode,
    toggleShuffle,
    playNext,
    playPrevious,
    playTrackAtIndex,
  } = usePlayerStore()

  // Obtener las próximas canciones en la cola
  const getUpcomingTracks = () => {
    if (queue.length === 0) return []
    const upcoming = []
    for (let i = 1; i <= 5; i++) {
      const nextIndex = (currentIndex + i) % queue.length
      if (queue[nextIndex] && nextIndex !== currentIndex) {
        upcoming.push({ track: queue[nextIndex], index: nextIndex })
      }
    }
    return upcoming
  }

  const upcomingTracks = getUpcomingTracks()

  // Los controles siempre visibles - no ocultar automáticamente
  const handleMouseMove = useCallback(() => {
    setShowControls(true)
  }, [])

  // Limpiar timeout al desmontar
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [])

  const toggleFullscreen = () => {
    if (!containerRef.current) return
    
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen()
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      }
    }
    setIsFullscreen(!isFullscreen)
  }

  // Escuchar cambios de fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Manejar seek en la barra de progreso
  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time
    }
  }

  const handleRepeatClick = () => {
    const modes: Array<'off' | 'all' | 'one'> = ['off', 'all', 'one']
    const currentModeIndex = modes.indexOf(repeatMode)
    const nextMode = modes[(currentModeIndex + 1) % modes.length]
    setRepeatMode(nextMode)
  }

  const getRepeatIcon = () => {
    if (repeatMode === 'one') return <Repeat1 size={24} />
    return <Repeat size={24} />
  }

  // Manejar teclas
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case ' ':
          e.preventDefault()
          setIsPlaying(!isPlaying)
          break
        case 'ArrowRight':
          playNext()
          break
        case 'ArrowLeft':
          playPrevious()
          break
        case 'f':
        case 'F':
          toggleFullscreen()
          break
        case 'q':
        case 'Q':
          setShowQueue(!showQueue)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isPlaying, showQueue])

  if (!isOpen) return null

  return (
    <div 
      ref={containerRef}
      className={`fullscreen-visualizer ${isFullscreen ? 'fullscreen' : ''}`}
      onMouseMove={handleMouseMove}
      onClick={() => setShowControls(true)}
    >
      {/* Fondo con blur de la carátula */}
      <div className="fs-background">
        {currentTrack?.coverArt && (
          <CoverImage 
            src={currentTrack.coverArt} 
            alt="" 
            className="fs-background-img"
          />
        )}
        <div className="fs-background-overlay" />
      </div>

      {/* Contenido principal */}
      <div className={`fs-content ${showControls ? 'visible' : 'hidden'}`}>
        {/* Header */}
        <div className="fs-header">
          <div className="fs-header-left">
            <span className="fs-now-playing">Reproduciendo ahora</span>
          </div>
          
          <div className="fs-header-actions">
            <button 
              onClick={() => setShowQueue(!showQueue)} 
              className={`fs-btn ${showQueue ? 'active' : ''}`}
              title="Mostrar/ocultar cola (Q)"
            >
              <ListMusic size={20} />
            </button>
            <button onClick={toggleFullscreen} title={isFullscreen ? 'Salir de pantalla completa (F)' : 'Pantalla completa (F)'}>
              {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
            <button onClick={onClose} title="Cerrar (Esc)">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Main area */}
        <div className="fs-main">
          {/* Cover y info de la canción */}
          <div className="fs-track-section">
            <div className="fs-cover-container">
              <CoverImage 
                src={currentTrack?.coverArt} 
                alt={currentTrack?.album || ''} 
                className="fs-cover"
              />
            </div>
            
            <div className="fs-track-info">
              <h1 className="fs-track-title">{currentTrack?.title || 'Sin canción'}</h1>
              <h2 className="fs-track-artist">{currentTrack?.artist || 'Artista desconocido'}</h2>
              {currentTrack?.album && (
                <p className="fs-track-album">{currentTrack.album}</p>
              )}
            </div>
          </div>

          {/* Cola de reproducción */}
          {showQueue && upcomingTracks.length > 0 && (
            <div className="fs-queue-section">
              <h3 className="fs-queue-title">
                <ChevronRight size={18} />
                A continuación
              </h3>
              <div className="fs-queue-list">
                {upcomingTracks.map(({ track, index }, i) => (
                  <button 
                    key={`${track.id}-${index}`}
                    className="fs-queue-item"
                    onClick={() => playTrackAtIndex(index)}
                  >
                    <span className="fs-queue-number">{i + 1}</span>
                    <CoverImage 
                      src={track.coverArt} 
                      alt={track.album || ''} 
                      className="fs-queue-cover"
                    />
                    <div className="fs-queue-info">
                      <span className="fs-queue-track-title">{track.title}</span>
                      <span className="fs-queue-track-artist">{track.artist}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Controles de reproducción */}
        <div className="fs-controls">
          {/* Barra de progreso */}
          <ProgressBar
            currentTime={currentTime}
            duration={duration}
            onSeek={handleSeek}
            variant="visualizer"
            size="lg"
            className="fs-progress"
          />

          {/* Botones de control */}
          <div className="fs-control-buttons">
            <button 
              className={`fs-control-btn ${isShuffled ? 'active' : ''}`}
              onClick={toggleShuffle}
              title="Aleatorio"
            >
              <Shuffle size={22} />
            </button>
            
            <button 
              className="fs-control-btn"
              onClick={playPrevious}
              title="Anterior"
            >
              <SkipBack size={28} />
            </button>
            
            <button 
              className="fs-play-btn"
              onClick={() => setIsPlaying(!isPlaying)}
              title={isPlaying ? 'Pausar (Espacio)' : 'Reproducir (Espacio)'}
            >
              {isPlaying ? <Pause size={36} /> : <Play size={36} />}
            </button>
            
            <button 
              className="fs-control-btn"
              onClick={playNext}
              title="Siguiente"
            >
              <SkipForward size={28} />
            </button>
            
            <button 
              className={`fs-control-btn ${repeatMode !== 'off' ? 'active' : ''}`}
              onClick={handleRepeatClick}
              title={`Repetir: ${repeatMode}`}
            >
              {getRepeatIcon()}
            </button>
          </div>

          {/* Volumen */}
          <VolumeSlider
            volume={volume}
            isMuted={isMuted}
            onVolumeChange={setVolume}
            onToggleMute={toggleMute}
            variant="visualizer"
            size="md"
            className="fs-volume"
          />
        </div>
      </div>

      {/* Hint para mostrar controles */}
      {!showControls && (
        <div className="fs-hint">
          Mueve el mouse para ver los controles
        </div>
      )}
    </div>
  )
}

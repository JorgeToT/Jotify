import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Minimize2, Maximize2, SkipForward, Pause, Play, Volume2, VolumeX, RefreshCw, Clock, Repeat } from 'lucide-react'
import { usePlayerStore } from '../store/playerStore'
import { formatTime } from '../utils/formatTime'
import { audioRef } from '../hooks/useAudioPlayer'
import './AnimeVisualizer.css'

// APIs de imágenes anime
const ANIME_APIS = [
  // 'https://api.waifu.pics/sfw/waifu',
  // 'https://api.waifu.pics/sfw/dance',
  // 'https://api.waifu.pics/sfw/neko',
  // 'https://api.waifu.pics/sfw/shinobu',
  // 'https://api.waifu.pics/sfw/megumin',
  'https://api.waifu.pics/sfw/kill',
  // 'https://api.waifu.pics/sfw/smile',
]

// Componente de imagen con manejo de rutas de archivo
function AnimeCoverImage({ src, alt }: { src?: string; alt: string }) {
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const [hasError, setHasError] = useState(false)

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

    // Si es ruta de archivo local (como D:\Música\song.jpg)
    if (src.includes(':\\') || src.startsWith('/')) {
      // Usar protocolo local-file:// registrado en Electron
      const normalizedPath = src.replace(/\\/g, '/')
      const fileUrl = `local-file://${encodeURIComponent(normalizedPath)}`
      setImgSrc(fileUrl)
      return
    }

    setImgSrc(null)
  }, [src])

  if (hasError || !imgSrc) {
    // Mostrar icono de música como fallback
    return (
      <div className="anime-cover anime-cover-fallback">
        🎵
      </div>
    )
  }

  return (
    <img 
      src={imgSrc} 
      alt={alt} 
      className="anime-cover"
      onError={() => setHasError(true)}
    />
  )
}

interface AnimeVisualizerProps {
  isOpen: boolean
  onClose: () => void
  loopDuration?: number // en minutos, 0 = infinito
}

export default function AnimeVisualizer({ isOpen, onClose, loopDuration = 0 }: AnimeVisualizerProps) {
  const [currentImage, setCurrentImage] = useState<string>('')
  const [nextImage, setNextImage] = useState<string>('')
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [imageCache, setImageCache] = useState<string[]>([])
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isLoadingImages, setIsLoadingImages] = useState(true)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [showControls, setShowControls] = useState(true)
  const [loopCount, setLoopCount] = useState(0)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const imageIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const elapsedIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    setIsPlaying,
    toggleMute,
    setAnimeMode,
  } = usePlayerStore()

  // Activar/desactivar modo anime cuando se abre/cierra
  useEffect(() => {
    if (isOpen) {
      setAnimeMode(true)
    }
    
    return () => {
      setAnimeMode(false)
    }
  }, [isOpen, setAnimeMode])

  // Cargar imágenes al abrir
  useEffect(() => {
    if (isOpen) {
      loadImages()
      setElapsedTime(0)
      setLoopCount(0)
      
      // Iniciar contador de tiempo transcurrido
      elapsedIntervalRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1)
      }, 1000)
    }
    
    return () => {
      if (elapsedIntervalRef.current) {
        clearInterval(elapsedIntervalRef.current)
      }
    }
  }, [isOpen])

  // Verificar si se alcanzó el tiempo límite
  useEffect(() => {
    if (loopDuration > 0 && elapsedTime >= loopDuration * 60) {
      onClose()
    }
  }, [elapsedTime, loopDuration, onClose])

  // Cambiar imagen cada 30 segundos
  useEffect(() => {
    if (isOpen && imageCache.length > 0) {
      imageIntervalRef.current = setInterval(() => {
        changeImage()
      }, 30000) // 30 segundos
    }
    
    return () => {
      if (imageIntervalRef.current) {
        clearInterval(imageIntervalRef.current)
      }
    }
  }, [isOpen, imageCache])

  // Ocultar controles después de inactividad
  const handleMouseMove = useCallback(() => {
    setShowControls(true)
    
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    
    // controlsTimeoutRef.current = setTimeout(() => {
    //   if (isPlaying) {
    //     setShowControls(false)
    //   }
    // }, 3000)
  }, [isPlaying])

  // Cargar imágenes de las APIs
  const loadImages = async () => {
    setIsLoadingImages(true)
    const images: string[] = []
    
    // Cargar 10 imágenes iniciales
    for (let i = 0; i < 10; i++) {
      try {
        const apiUrl = ANIME_APIS[i % ANIME_APIS.length]
        const response = await fetch(apiUrl)
        const data = await response.json()
        if (data.url) {
          images.push(data.url)
        }
      } catch (error) {
        console.error('Error loading anime image:', error)
      }
    }
    
    setImageCache(images)
    if (images.length > 0) {
      setCurrentImage(images[0])
      if (images.length > 1) {
        setNextImage(images[1])
      }
    }
    setIsLoadingImages(false)
    
    // Continuar cargando más imágenes en background
    loadMoreImages(images)
  }

  const loadMoreImages = async (existingImages: string[]) => {
    const newImages = [...existingImages]
    
    for (let i = 0; i < 20; i++) {
      try {
        const apiUrl = ANIME_APIS[Math.floor(Math.random() * ANIME_APIS.length)]
        const response = await fetch(apiUrl)
        const data = await response.json()
        if (data.url && !newImages.includes(data.url)) {
          newImages.push(data.url)
        }
      } catch (error) {
        // Ignorar errores silenciosamente
      }
    }
    
    setImageCache(newImages)
  }

  const changeImage = () => {
    if (imageCache.length < 2) return
    
    setIsTransitioning(true)
    
    setTimeout(() => {
      const nextIndex = (currentImageIndex + 1) % imageCache.length
      setCurrentImage(imageCache[nextIndex])
      setCurrentImageIndex(nextIndex)
      setNextImage(imageCache[(nextIndex + 1) % imageCache.length])
      setIsTransitioning(false)
    }, 1000) // Duración de la transición
  }

  const handleSkipImage = () => {
    changeImage()
  }

  const handleRefreshImages = () => {
    loadImages()
  }

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
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = time
    }
  }

  const formatElapsedTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!isOpen) return null

  return (
    <div 
      ref={containerRef}
      className={`anime-visualizer ${isFullscreen ? 'fullscreen' : ''}`}
      onMouseMove={handleMouseMove}
      onClick={() => setShowControls(true)}
    >
      {/* Fondo de imágenes */}
      <div className="anime-background">
        <div 
          className={`anime-image current ${isTransitioning ? 'fade-out' : ''}`}
          style={{ backgroundImage: `url(${currentImage})` }}
        />
        <div 
          className={`anime-image next ${isTransitioning ? 'fade-in' : ''}`}
          style={{ backgroundImage: `url(${nextImage})` }}
        />
        <div className="anime-overlay" />
      </div>

      {/* Loading */}
      {isLoadingImages && (
        <div className="anime-loading">
          <RefreshCw size={48} className="spinning" />
          <p>Cargando imágenes de anime...</p>
        </div>
      )}

      {/* Controles */}
      <div className={`anime-controls ${showControls ? 'visible' : 'hidden'}`}>
        {/* Header */}
        <div className="anime-header">
          <div className="anime-timer">
            <Clock size={16} />
            <span>{formatElapsedTime(elapsedTime)}</span>
            {loopDuration > 0 && (
              <span className="anime-timer-limit">/ {loopDuration} min</span>
            )}
            {loopCount > 0 && (
              <span className="anime-loop-count">
                <Repeat size={14} />
                {loopCount}
              </span>
            )}
          </div>
          
          <div className="anime-header-actions">
            <button onClick={handleRefreshImages} title="Nuevas imágenes">
              <RefreshCw size={20} />
            </button>
            <button onClick={toggleFullscreen} title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}>
              {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
            <button onClick={onClose} title="Cerrar">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Track info */}
        <div className="anime-track-info">
          <AnimeCoverImage src={currentTrack?.coverArt} alt={currentTrack?.album || ''} />
          <div className="anime-track-text">
            <h2>{currentTrack?.title || 'Sin canción'}</h2>
            <p>{currentTrack?.artist || 'Artista desconocido'}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="anime-progress">
          <span>{formatTime(currentTime)}</span>
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="anime-progress-bar"
            style={{ '--progress': `${duration ? (currentTime / duration) * 100 : 0}%` } as React.CSSProperties}
          />
          <span>{formatTime(duration)}</span>
        </div>

        {/* Playback controls */}
        <div className="anime-playback">
          <button onClick={handleSkipImage} title="Siguiente imagen">
            <SkipForward size={20} />
            <span>Siguiente imagen</span>
          </button>
          
          <button 
            className="anime-play-btn"
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? <Pause size={32} /> : <Play size={32} />}
          </button>
          
          <button onClick={toggleMute} title={isMuted ? 'Activar sonido' : 'Silenciar'}>
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </div>
      </div>

      {/* Hint para mostrar controles */}
      {!showControls && (
        <div className="anime-hint">
          Mueve el mouse para ver los controles
        </div>
      )}
    </div>
  )
}

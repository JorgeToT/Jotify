import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Minimize2, Maximize2, Pause, Play, RefreshCw, Clock, Repeat } from 'lucide-react'
import { usePlayerStore } from '../store/playerStore'
import { audioRef } from '../hooks/useAudioPlayer'
import { CoverImage, VolumeSlider, ProgressBar } from './common'
import './AnimeVisualizer.css'

// Función para mezclar un array aleatoriamente (Fisher-Yates shuffle)
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// Función para verificar si una URL es una imagen (no GIF)
const isStaticImage = (url: string): boolean => {
  const lowercaseUrl = url.toLowerCase()
  return !lowercaseUrl.endsWith('.gif') && 
         (lowercaseUrl.endsWith('.jpg') || 
          lowercaseUrl.endsWith('.jpeg') || 
          lowercaseUrl.endsWith('.png') || 
          lowercaseUrl.endsWith('.webp') ||
          !lowercaseUrl.match(/\.(gif|mp4|webm)$/))
}

// Función para convertir ruta local a URL válida para CSS
const toImageUrl = (src: string): string => {
  if (!src) return ''
  
  // Si ya es URL HTTP, usar directamente
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return src
  }
  
  // Si es ruta local de Windows (D:\folder\image.jpg)
  if (src.includes(':\\') || src.startsWith('/')) {
    const normalizedPath = src.replace(/\\/g, '/')
    return `local-file://${encodeURIComponent(normalizedPath)}`
  }
  
  return src
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
  const [, setCurrentImageIndex] = useState(0)
  const [isLoadingImages, setIsLoadingImages] = useState(true)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [showControls, setShowControls] = useState(true)
  const [loopCount, setLoopCount] = useState(0)
  
  // Settings from configuration
  const [categories, setCategories] = useState<string[]>(['waifu', 'neko'])
  const [allowGifs, setAllowGifs] = useState(false)
  const [imageSource, setImageSource] = useState<string>('waifupics')
  const [safebooruTags, setSafebooruTags] = useState<string[]>([])
  const [nekosCategories, setNekosCategories] = useState<string[]>(['neko'])
  const [localFolderPath, setLocalFolderPath] = useState<string>('')
  const settingsLoadedRef = useRef(false)
  
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
    setVolume,
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
      // Load settings first, then load images
      const loadSettingsAndImages = async () => {
        try {
          const settings = await window.electron.settings.get()
          if (settings.animeVisualizer) {
            const loadedCategories = settings.animeVisualizer.categories || ['waifu', 'neko']
            const loadedAllowGifs = settings.animeVisualizer.allowGifs || false
            const loadedImageSource = settings.animeVisualizer.imageSource || 'waifupics'
            const loadedSafebooruTags = settings.animeVisualizer.safebooruTags || []
            const loadedNekosCategories = settings.animeVisualizer.nekosCategories || ['neko']
            const loadedLocalFolderPath = settings.animeVisualizer.localFolderPath || ''
            
            setCategories(loadedCategories)
            setAllowGifs(loadedAllowGifs)
            setImageSource(loadedImageSource)
            setSafebooruTags(loadedSafebooruTags)
            setNekosCategories(loadedNekosCategories)
            setLocalFolderPath(loadedLocalFolderPath)
            settingsLoadedRef.current = true
            
            // Load images with the loaded settings
            await loadImagesFromSource(loadedImageSource, {
              categories: loadedCategories,
              allowGifs: loadedAllowGifs,
              safebooruTags: loadedSafebooruTags,
              nekosCategories: loadedNekosCategories,
              localFolderPath: loadedLocalFolderPath,
            })
          } else {
            settingsLoadedRef.current = true
            await loadImagesFromSource('waifupics', {
              categories: ['waifu', 'neko'],
              allowGifs: false,
              safebooruTags: [],
              nekosCategories: ['neko'],
              localFolderPath: '',
            })
          }
        } catch (error) {
          console.error('Error loading settings:', error)
          settingsLoadedRef.current = true
          await loadImagesFromSource('waifupics', {
            categories: ['waifu', 'neko'],
            allowGifs: false,
            safebooruTags: [],
            nekosCategories: ['neko'],
            localFolderPath: '',
          })
        }
      }
      
      loadSettingsAndImages()
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
    if (isOpen && imageCache.length > 0 && !isLoadingImages) {
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
    
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false)
      }
    }, 3000)
  }, [isPlaying])

  // Cargar imágenes de las APIs con configuración específica
  const loadImagesFromSource = async (source: string, config: {
    categories: string[],
    allowGifs: boolean,
    safebooruTags: string[],
    nekosCategories: string[],
    localFolderPath: string,
  }) => {
    setIsLoadingImages(true)
    let images: string[] = []
    
    switch (source) {
      case 'waifupics':
        images = await loadFromWaifuPics(config.categories, config.allowGifs)
        break
      case 'safebooru':
        images = await loadFromSafebooru(config.safebooruTags, config.allowGifs)
        break
      case 'nekosbest':
        images = await loadFromNekosBest(config.nekosCategories, config.allowGifs)
        break
      case 'localfolder':
        images = await loadFromLocalFolder(config.localFolderPath, config.allowGifs)
        break
      default:
        images = await loadFromWaifuPics(config.categories, config.allowGifs)
    }
    
    // Mezclar las imágenes aleatoriamente
    images = shuffleArray(images)
    
    setImageCache(images)
    setCurrentImageIndex(0)
    if (images.length > 0) {
      setCurrentImage(images[0])
      if (images.length > 1) {
        setNextImage(images[1])
      }
    }
    setIsLoadingImages(false)
    
    // Continuar cargando más imágenes en background (solo para APIs online)
    if (source !== 'localfolder') {
      loadMoreImagesFromSource(images, source, config)
    }
  }

  // Cargar desde carpeta local
  const loadFromLocalFolder = async (folderPath: string, gifs: boolean): Promise<string[]> => {
    if (!folderPath) return []
    
    try {
      const result = await window.electron.anime.getLocalImages(folderPath, 50)
      if (result.success && result.images) {
        return result.images.filter(path => gifs ? true : isStaticImage(path))
      }
    } catch (error) {
      console.error('Error loading from local folder:', error)
    }
    return []
  }

  // Cargar desde Waifu.pics (usando IPC de Electron)
  const loadFromWaifuPics = async (cats: string[], gifs: boolean): Promise<string[]> => {
    try {
      const result = await window.electron.anime.getWaifuPicsImages(cats, 15)
      if (result.success && result.images) {
        return result.images.filter(url => gifs ? true : isStaticImage(url))
      }
    } catch (error) {
      console.error('Error loading from waifu.pics:', error)
    }
    return []
  }

  // Cargar desde Safebooru (usando IPC de Electron - evita CORS)
  const loadFromSafebooru = async (tags: string[], gifs: boolean): Promise<string[]> => {
    if (tags.length === 0) return []
    
    try {
      const result = await window.electron.anime.getSafebooruImages(tags, 30)
      if (result.success && result.images) {
        return result.images.filter(url => gifs ? true : isStaticImage(url)).slice(0, 15)
      }
    } catch (error) {
      console.error('Error loading from Safebooru:', error)
    }
    return []
  }

  // Cargar desde Nekos.best (usando IPC de Electron)
  const loadFromNekosBest = async (cats: string[], gifs: boolean): Promise<string[]> => {
    try {
      const result = await window.electron.anime.getNekosBestImages(cats, 15)
      if (result.success && result.images) {
        return result.images.filter(url => gifs ? true : isStaticImage(url))
      }
    } catch (error) {
      console.error('Error loading from nekos.best:', error)
    }
    return []
  }

  // Wrapper function that uses current state
  const loadImages = async () => {
    await loadImagesFromSource(imageSource, {
      categories,
      allowGifs,
      safebooruTags,
      nekosCategories,
      localFolderPath,
    })
  }

  const loadMoreImagesFromSource = async (existingImages: string[], source: string, config: {
    categories: string[],
    allowGifs: boolean,
    safebooruTags: string[],
    nekosCategories: string[],
    localFolderPath: string,
  }) => {
    let moreImages: string[] = []
    
    switch (source) {
      case 'waifupics':
        moreImages = await loadMoreFromWaifuPics(existingImages, config.categories, config.allowGifs)
        break
      case 'safebooru':
        moreImages = await loadMoreFromSafebooru(existingImages, config.safebooruTags, config.allowGifs)
        break
      case 'nekosbest':
        moreImages = await loadMoreFromNekosBest(existingImages, config.nekosCategories, config.allowGifs)
        break
    }
    
    // Mezclar las nuevas imágenes y agregarlas
    moreImages = shuffleArray(moreImages)
    setImageCache([...existingImages, ...moreImages])
  }

  const loadMoreFromWaifuPics = async (existingImages: string[], cats: string[], gifs: boolean): Promise<string[]> => {
    try {
      const result = await window.electron.anime.getWaifuPicsImages(cats, 25)
      if (result.success && result.images) {
        return result.images
          .filter(url => gifs ? true : isStaticImage(url))
          .filter(url => !existingImages.includes(url))
      }
    } catch (error) {
      // Ignore errors
    }
    return []
  }

  const loadMoreFromSafebooru = async (existingImages: string[], tags: string[], gifs: boolean): Promise<string[]> => {
    if (tags.length === 0) return []
    
    try {
      const result = await window.electron.anime.getSafebooruImages(tags, 40)
      if (result.success && result.images) {
        return result.images
          .filter(url => gifs ? true : isStaticImage(url))
          .filter(url => !existingImages.includes(url))
          .slice(0, 25)
      }
    } catch (error) {
      // Ignore errors
    }
    return []
  }

  const loadMoreFromNekosBest = async (existingImages: string[], cats: string[], gifs: boolean): Promise<string[]> => {
    try {
      const result = await window.electron.anime.getNekosBestImages(cats, 25)
      if (result.success && result.images) {
        return result.images
          .filter(url => gifs ? true : isStaticImage(url))
          .filter(url => !existingImages.includes(url))
      }
    } catch (error) {
      // Ignore errors
    }
    return []
  }

  const changeImage = useCallback(() => {
    if (imageCache.length < 2 || isTransitioning) return
    
    setIsTransitioning(true)
    
    // Usar callback en setCurrentImageIndex para evitar problemas de closure
    setCurrentImageIndex(prevIndex => {
      const nextIndex = (prevIndex + 1) % imageCache.length
      
      // Precargar la siguiente imagen
      const imgToPreload = new Image()
      imgToPreload.src = toImageUrl(imageCache[(nextIndex + 1) % imageCache.length])
      
      // Actualizar imágenes después de un pequeño delay para la transición
      setTimeout(() => {
        setCurrentImage(imageCache[nextIndex])
        setNextImage(imageCache[(nextIndex + 1) % imageCache.length])
        setIsTransitioning(false)
      }, 500)
      
      return nextIndex
    })
  }, [imageCache, isTransitioning])

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

  // Manejar teclas de atajo
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
        case 'f':
        case 'F':
          toggleFullscreen()
          break
        case 'n':
        case 'N':
          changeImage()
          break
        case 'm':
        case 'M':
          toggleMute()
          break
        case 'ArrowUp':
          e.preventDefault()
          setVolume(Math.min(1, volume + 0.1))
          break
        case 'ArrowDown':
          e.preventDefault()
          setVolume(Math.max(0, volume - 0.1))
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isPlaying, volume, changeImage])

  // Manejar seek en la barra de progreso
  const handleSeek = (time: number) => {
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
          style={{ backgroundImage: `url(${toImageUrl(currentImage)})` }}
        />
        <div 
          className={`anime-image next ${isTransitioning ? 'fade-in' : ''}`}
          style={{ backgroundImage: `url(${toImageUrl(nextImage)})` }}
        />
        <div className="anime-overlay" />
      </div>

      {/* Loading */}
      {isLoadingImages && (
        <div className="anime-loading">
          <RefreshCw size={48} className="spinning" />
          <p>Cargando imágenes...</p>
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
          <CoverImage 
            src={currentTrack?.coverArt} 
            alt={currentTrack?.album || ''} 
            className="anime-cover"
          />
          <div className="anime-track-text">
            <h2>{currentTrack?.title || 'Sin canción'}</h2>
            <p>{currentTrack?.artist || 'Artista desconocido'}</p>
          </div>
        </div>

        {/* Progress bar */}
        <ProgressBar
          currentTime={currentTime}
          duration={duration}
          onSeek={handleSeek}
          variant="visualizer"
          size="lg"
          className="anime-progress"
        />

        {/* Playback controls */}
        <div className="anime-playback">
          <button 
            className="anime-play-btn"
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? <Pause size={32} /> : <Play size={32} />}
          </button>
        </div>

        {/* Secondary controls: volume and image skip */}
        <div className="anime-secondary-controls">
          <button onClick={handleSkipImage} className="anime-skip-image-btn" title="Siguiente imagen (N)">
            <RefreshCw size={16} />
            <span>Cambiar imagen</span>
          </button>
          
          <VolumeSlider
            volume={volume}
            isMuted={isMuted}
            onVolumeChange={setVolume}
            onToggleMute={toggleMute}
            variant="visualizer"
            size="sm"
          />
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

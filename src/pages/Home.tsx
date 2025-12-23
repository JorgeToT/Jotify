import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLibraryStore } from '../store/libraryStore'
import { usePlayerStore } from '../store/playerStore'
import './Home.css'

// Cache de imágenes de anime para evitar múltiples requests
const animeImageCache = new Map<number, string>()

// Componente de imagen con fallback de anime para las tarjetas
function TrackCardImage({ src, alt, trackId }: { src?: string; alt: string; trackId?: number }) {
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const [hasError, setHasError] = useState(false)
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null)

  // Obtener imagen de anime como fallback
  useEffect(() => {
    const id = trackId || 0
    
    // Verificar si ya tenemos la imagen en cache
    if (animeImageCache.has(id)) {
      setFallbackUrl(animeImageCache.get(id)!)
      return
    }

    // Obtener nueva imagen de anime
    const fetchAnimeImage = async () => {
      try {
        const result = await window.electron.anime.getRandomImage()
        if (result.success && result.url) {
          animeImageCache.set(id, result.url)
          setFallbackUrl(result.url)
        }
      } catch (error) {
        // Usar placeholder si falla
        setFallbackUrl('https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=180&h=180&fit=crop')
      }
    }

    fetchAnimeImage()
  }, [trackId])

  useEffect(() => {
    setHasError(false)
    
    if (!src) {
      setImgSrc(null)
      return
    }

    // Si es una URL HTTP válida, usarla directamente
    if (src.startsWith('http://') || src.startsWith('https://')) {
      setImgSrc(src)
      return
    }

    // Si es base64, validar que tenga el formato correcto y longitud mínima
    if (src.startsWith('data:image/') && src.length > 100) {
      setImgSrc(src)
      return
    }

    // Si es ruta de archivo local (Windows: D:\path o Unix: /path)
    if (src.includes(':\\') || src.includes(':/') || src.startsWith('/')) {
      // Usar protocolo local-file:// registrado en Electron
      const normalizedPath = src.replace(/\\/g, '/')
      const fileUrl = `local-file://${encodeURIComponent(normalizedPath)}`
      setImgSrc(fileUrl)
      return
    }

    // URL no reconocida o base64 muy corto
    setImgSrc(null)
  }, [src])

  const handleError = () => {
    setHasError(true)
  }

  if (hasError || !imgSrc) {
    return (
      <img
        src={fallbackUrl || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=180&h=180&fit=crop'}
        alt={alt}
        className="track-card-cover"
      />
    )
  }

  return (
    <img
      src={imgSrc}
      alt={alt}
      className="track-card-cover"
      onError={handleError}
    />
  )
}

export default function Home() {
  const { tracks, playlists } = useLibraryStore()
  const { setQueue, setIsPlaying } = usePlayerStore()
  const navigate = useNavigate()

  const recentTracks = tracks.slice(0, 10)
  const artistCount = new Set(tracks.map(t => t.artist)).size
  const albumCount = new Set(tracks.map(t => t.album)).size

  const handlePlayTrack = (track: typeof tracks[0], index: number) => {
    setQueue(recentTracks, index)
    setIsPlaying(true)
  }

  return (
    <div className="home">
      <h1 className="page-title">Inicio</h1>

      <section className="home-section">
        <h2 className="section-title">Bienvenido a Jotify</h2>
        <p className="section-description">
          Tu reproductor de música HiFi para archivos FLAC. Disfruta de audio sin pérdidas con calidad de estudio.
        </p>

        <div className="stats">
          <div className="stat-card clickable" onClick={() => navigate('/library')}>
            <div className="stat-number">{tracks.length}</div>
            <div className="stat-label">Canciones</div>
          </div>
          <div className="stat-card clickable" onClick={() => navigate('/library?view=playlists')}>
            <div className="stat-number">{playlists.length}</div>
            <div className="stat-label">Playlists</div>
          </div>
          <div className="stat-card clickable" onClick={() => navigate('/library?view=artists')}>
            <div className="stat-number">{artistCount}</div>
            <div className="stat-label">Artistas</div>
          </div>
          <div className="stat-card clickable" onClick={() => navigate('/library?view=albums')}>
            <div className="stat-number">{albumCount}</div>
            <div className="stat-label">Álbumes</div>
          </div>
        </div>
      </section>

      {recentTracks.length > 0 && (
        <section className="home-section">
          <h2 className="section-title">Agregadas recientemente</h2>
          <div className="recent-tracks">
            {recentTracks.map((track, index) => (
              <div 
                key={track.id} 
                className="track-card"
                onClick={() => handlePlayTrack(track, index)}
              >
                <TrackCardImage src={track.coverArt} alt={track.album} trackId={track.id} />
                <div className="track-card-info">
                  <div className="track-card-title">{track.title}</div>
                  <div className="track-card-artist">{track.artist}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

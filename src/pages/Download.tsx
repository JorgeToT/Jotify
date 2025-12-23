import { useState, useEffect } from 'react'
import { Download as DownloadIcon, Search as SearchIcon, Play, Info, Loader, RefreshCw, X } from 'lucide-react'
import './Download.css'
import type { DownloadProgressEvent } from '../types/electron'

interface SearchResult {
  id: string
  title: string
  channel: string
  duration: number
  thumbnail: string
  url: string
}

export default function Download() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedFormat, setSelectedFormat] = useState<'opus' | 'm4a' | 'flac'>('opus')
  const [downloads, setDownloads] = useState<Map<string, DownloadProgressEvent>>(new Map())
  const [ytDlpInstalled, setYtDlpInstalled] = useState(false)
  const [isUpdatingYtDlp, setIsUpdatingYtDlp] = useState(false)

  useEffect(() => {
    checkYtDlp()
    
    // Listen for download progress
    window.electron.download.onProgress((progress: DownloadProgressEvent) => {
      setDownloads(prev => {
        const newMap = new Map(prev)
        
        // Si completó o tuvo error, remover después de 3 segundos
        if (progress.status === 'completed' || progress.status === 'error') {
          newMap.set(progress.id, progress)
          setTimeout(() => {
            setDownloads(current => {
              const updated = new Map(current)
              updated.delete(progress.id)
              return updated
            })
          }, 3000)
        } else {
          newMap.set(progress.id, progress)
        }
        
        return newMap
      })
    })

    return () => {
      window.electron.download.removeProgressListener()
    }
  }, [])

  const checkYtDlp = async () => {
    const installed = await window.electron.download.checkYtDlp()
    setYtDlpInstalled(installed)
  }

  const handleUpdateYtDlp = async () => {
    if (!ytDlpInstalled) {
      alert('yt-dlp no está instalado. Instálalo primero desde la terminal: pip install yt-dlp')
      return
    }

    setIsUpdatingYtDlp(true)
    try {
      const result = await window.electron.download.updateYtDlp()
      alert(result.message)
      if (result.success) {
        checkYtDlp()
      }
    } catch (error) {
      console.error('Update error:', error)
      alert('Error al actualizar yt-dlp')
    } finally {
      setIsUpdatingYtDlp(false)
    }
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!searchQuery.trim()) return

    setIsSearching(true)
    setSearchResults([])

    try {
      const result = await window.electron.download.searchMusic(searchQuery, 10)
      if (result.success) {
        setSearchResults(result.results || [])
      } else {
        alert(`Error: ${result.error}`)
      }
    } catch (error) {
      console.error('Search error:', error)
      alert('Error al buscar música')
    } finally {
      setIsSearching(false)
    }
  }

  const handleDownload = async (url: string, title: string, thumbnail?: string) => {
    if (!ytDlpInstalled) {
      alert('Necesitas instalar yt-dlp primero. Ve a Configuración.')
      return
    }

    try {
      const result = await window.electron.download.queueDownload(url, selectedFormat, title, thumbnail)
      
      if (!result.success) {
        alert(`Error: ${result.error}`)
      }
    } catch (error) {
      console.error('Download error:', error)
      alert('Error al iniciar la descarga')
    }
  }

  const handleCancelDownload = async (downloadId: string) => {
    try {
      await window.electron.download.cancelDownload(downloadId)
      setDownloads(prev => {
        const newMap = new Map(prev)
        newMap.delete(downloadId)
        return newMap
      })
    } catch (error) {
      console.error('Cancel error:', error)
    }
  }

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Obtener URL de thumbnail válida de YouTube
  const getThumbnailUrl = (videoId: string, originalThumbnail?: string): string => {
    // Si el thumbnail original parece válido, usarlo
    if (originalThumbnail && originalThumbnail.startsWith('https://')) {
      return originalThumbnail
    }
    // Fallback a URL estándar de YouTube
    return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  }

  // Manejar error de carga de imagen
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>, videoId: string) => {
    const img = e.currentTarget
    const fallbackUrl = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
    if (img.src !== fallbackUrl) {
      img.src = fallbackUrl
    }
  }

  return (
    <div className="download-page">
      <h1 className="page-title">
        <DownloadIcon size={32} />
        Descargar Música
      </h1>

      {!ytDlpInstalled && (
        <div className="warning-banner">
          <Info size={20} />
          <span>
            yt-dlp no está instalado. Ve a <strong>Configuración</strong> para más información.
          </span>
        </div>
      )}

      {ytDlpInstalled && (
        <div className="info-banner">
          <Info size={20} />
          <span>Si tienes problemas al descargar, actualiza yt-dlp</span>
          <button 
            onClick={handleUpdateYtDlp} 
            className="btn-update-ytdlp"
            disabled={isUpdatingYtDlp}
          >
            <RefreshCw size={16} className={isUpdatingYtDlp ? 'spinning' : ''} />
            {isUpdatingYtDlp ? 'Actualizando...' : 'Actualizar yt-dlp'}
          </button>
        </div>
      )}

      <div className="download-controls">
        <form onSubmit={handleSearch} className="search-form">
          <div className="search-input-group">
            <SearchIcon size={20} />
            <input
              type="text"
              placeholder="Buscar música en YouTube..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isSearching}
            />
            <button type="submit" className="btn-search" disabled={isSearching || !ytDlpInstalled}>
              {isSearching ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        </form>

        <div className="format-selector">
          <label>Formato de descarga:</label>
          <div className="format-options">
            <button
              className={`format-btn ${selectedFormat === 'opus' ? 'active' : ''}`}
              onClick={() => setSelectedFormat('opus')}
            >
              <div className="format-name">OPUS</div>
              <div className="format-desc">~160 kbps VBR</div>
              <div className="format-badge">Recomendado</div>
            </button>
            <button
              className={`format-btn ${selectedFormat === 'm4a' ? 'active' : ''}`}
              onClick={() => setSelectedFormat('m4a')}
            >
              <div className="format-name">M4A</div>
              <div className="format-desc">~256 kbps AAC</div>
            </button>
            <button
              className={`format-btn ${selectedFormat === 'flac' ? 'active' : ''}`}
              onClick={() => setSelectedFormat('flac')}
            >
              <div className="format-name">FLAC</div>
              <div className="format-desc">Lossless (convertido)</div>
            </button>
          </div>
        </div>
      </div>

      {downloads.size > 0 && (
        <div className="downloads-panel">
          <h3 className="downloads-title">
            📥 Descargas activas ({downloads.size})
          </h3>
          <div className="downloads-list">
            {Array.from(downloads.values()).map((download) => (
              <div key={download.id} className={`download-item download-${download.status}`}>
                {download.thumbnail && (
                  <img 
                    src={download.thumbnail} 
                    alt={download.title || 'Thumbnail'}
                    className="download-thumbnail"
                  />
                )}
                <div className="download-info">
                  <div className="download-title">{download.title || 'Descargando...'}</div>
                  <div className="download-status">
                    {download.status === 'queued' && '⏳ En cola'}
                    {download.status === 'downloading' && '📥 Descargando...'}
                    {download.status === 'converting' && '🔄 Convirtiendo...'}
                    {download.status === 'completed' && '✅ Completado'}
                    {download.status === 'error' && `❌ Error: ${download.error}`}
                  </div>
                  <div className="download-progress-bar">
                    <div 
                      className="download-progress-fill" 
                      style={{ width: `${download.progress}%` }}
                    />
                  </div>
                  <div className="download-details">
                    <span>{download.progress.toFixed(0)}%</span>
                    {download.downloadSpeed && <span>{download.downloadSpeed}</span>}
                    {download.eta && <span>ETA: {download.eta}</span>}
                  </div>
                </div>
                {download.status !== 'completed' && download.status !== 'error' && (
                  <button 
                    className="download-cancel-btn"
                    onClick={() => handleCancelDownload(download.id)}
                    title="Cancelar descarga"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="search-results">
        {isSearching ? (
          <div className="loading-state">
            <Loader size={48} className="spinner" />
            <p>Buscando en YouTube...</p>
          </div>
        ) : searchResults.length > 0 ? (
          <>
            <h2 className="results-title">Resultados ({searchResults.length})</h2>
            <div className="results-list">
              {searchResults.map((result) => (
                <div key={result.id} className="result-card">
                  <img 
                    src={getThumbnailUrl(result.id, result.thumbnail)} 
                    alt={result.title}
                    className="result-thumbnail"
                    onError={(e) => handleImageError(e, result.id)}
                    loading="lazy"
                  />
                  <div className="result-info">
                    <div className="result-title">{result.title}</div>
                    <div className="result-channel">{result.channel}</div>
                    <div className="result-duration">{formatDuration(result.duration)}</div>
                  </div>
                  <div className="result-actions">
                    <button
                      onClick={() => window.electron.openExternal(result.url)}
                      className="btn-icon"
                      title="Ver en YouTube"
                    >
                      <Play size={18} />
                    </button>
                    <button
                      onClick={() => handleDownload(result.url, result.title, result.thumbnail)}
                      className="btn-download"
                      disabled={!ytDlpInstalled || downloads.has(result.id)}
                    >
                      <DownloadIcon size={18} />
                      {downloads.has(result.id) ? 'Descargando...' : 'Descargar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : searchQuery && !isSearching ? (
          <div className="empty-state">
            <p>No se encontraron resultados</p>
          </div>
        ) : (
          <div className="empty-state">
            <DownloadIcon size={64} className="empty-icon" />
            <h2>Busca música para descargar</h2>
            <p>Busca canciones en YouTube y descárgalas en alta calidad</p>
          </div>
        )}
      </div>

      <div className="download-info">
        <h3>ℹ️ Información importante</h3>
        <ul>
          <li>
            <strong>Formatos disponibles:</strong>
            <ul>
              <li><strong>OPUS</strong>: Mejor opción para YouTube, calidad óptima (~160 kbps VBR)</li>
              <li><strong>M4A</strong>: AAC de alta calidad (~256 kbps para YouTube Music Premium)</li>
              <li><strong>FLAC</strong>: Conversión lossless (no mejora la calidad del audio original de YouTube)</li>
            </ul>
          </li>
          <li><strong>YouTube NO tiene FLAC nativo:</strong> La conversión a FLAC solo cambia el contenedor, no mejora la calidad</li>
          <li><strong>Metadatos:</strong> Se incluyen automáticamente título, artista y portada cuando están disponibles</li>
          <li><strong>Biblioteca:</strong> Las canciones descargadas se agregan automáticamente a tu biblioteca</li>
          <li><strong>✨ Modo Anime:</strong> Usa el botón de brillos en el reproductor para ver imágenes de anime mientras escuchas música</li>
        </ul>
      </div>
    </div>
  )
}

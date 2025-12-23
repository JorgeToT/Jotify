import { useState, useRef, useEffect } from 'react'
import { Track } from '../types/electron'
import { Play, MoreVertical, ListPlus, FolderOpen, Trash2, Info, Music, Search, Loader, Edit3, Image } from 'lucide-react'
import { usePlayerStore } from '../store/playerStore'
import { useLibraryStore } from '../store/libraryStore'
import { formatTime } from '../utils/formatTime'
import './TrackList.css'

// Cache de imágenes de anime para evitar múltiples requests
const animeImageCache = new Map<number, string>()

// Componente de imagen con fallback de anime
function TrackCoverImage({ src, alt, trackId }: { src?: string; alt: string; trackId?: number }) {
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
        setFallbackUrl('https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=100&h=100&fit=crop')
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
    console.log(`[TrackCoverImage] Error cargando imagen para: ${alt}`)
    setHasError(true)
  }

  if (hasError || !imgSrc) {
    return (
      <img 
        src={fallbackUrl || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=100&h=100&fit=crop'} 
        alt={alt} 
        className="track-cover"
      />
    )
  }

  return (
    <img 
      src={imgSrc} 
      alt={alt} 
      className="track-cover" 
      onError={handleError}
    />
  )
}

interface TrackListProps {
  tracks: Track[]
}

export default function TrackList({ tracks }: TrackListProps) {
  const { currentTrack, setQueue, setCurrentTrack, setIsPlaying } = usePlayerStore()
  const { playlists } = useLibraryStore()
  const [menuOpen, setMenuOpen] = useState<number | null>(null)
  const [showPlaylistSubmenu, setShowPlaylistSubmenu] = useState(false)
  const [showInfoModal, setShowInfoModal] = useState<Track | null>(null)
  const [showEditModal, setShowEditModal] = useState<Track | null>(null)
  const [editForm, setEditForm] = useState({ title: '', artist: '', album: '', year: '' })
  const [isSaving, setIsSaving] = useState(false)
  const [searchingMetadata, setSearchingMetadata] = useState<number | null>(null)
  const [searchingCover, setSearchingCover] = useState<number | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(null)
        setShowPlaylistSubmenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handlePlayTrack = (track: Track, index: number) => {
    console.log('=== TRACK SELECTED ===')
    console.log('Title:', track.title)
    console.log('Artist:', track.artist)
    console.log('Album:', track.album)
    console.log('File Path:', track.filePath)
    console.log('======================')
    setQueue(tracks, index)
    setCurrentTrack(track)
    setIsPlaying(true)
  }

  const handleOpenMenu = (e: React.MouseEvent, trackId: number) => {
    e.stopPropagation()
    setMenuOpen(menuOpen === trackId ? null : trackId)
    setShowPlaylistSubmenu(false)
  }

  const handleAddToPlaylist = async (track: Track, playlistId: number) => {
    try {
      await window.electron.addToPlaylist(playlistId, track.id!)
      alert('Canción agregada a la playlist')
    } catch (error) {
      console.error('Error adding to playlist:', error)
    }
    setMenuOpen(null)
    setShowPlaylistSubmenu(false)
  }

  const handleOpenInFolder = async (track: Track) => {
    if (track.filePath) {
      // Abrir la carpeta que contiene el archivo
      const folderPath = track.filePath.substring(0, track.filePath.lastIndexOf('\\'))
      await window.electron.openExternal(`file:///${folderPath}`)
    }
    setMenuOpen(null)
  }

  const handleDeleteTrack = async (track: Track) => {
    try {
      await window.electron.deleteTrack(track.id!)
      const updatedTracks = await window.electron.getTracks()
      useLibraryStore.getState().setTracks(updatedTracks)
    } catch (error) {
      console.error('Error deleting track:', error)
    }
    setMenuOpen(null)
  }

  const handleShowInfo = (track: Track) => {
    setShowInfoModal(track)
    setMenuOpen(null)
  }

  const handleOpenEditModal = (track: Track) => {
    setEditForm({
      title: track.title,
      artist: track.artist,
      album: track.album,
      year: track.year?.toString() || ''
    })
    setShowEditModal(track)
    setMenuOpen(null)
  }

  const handleSaveEdit = async () => {
    if (!showEditModal?.id) return
    
    setIsSaving(true)
    try {
      const updates: { title?: string; artist?: string; album?: string; year?: number } = {}
      
      if (editForm.title !== showEditModal.title) updates.title = editForm.title
      if (editForm.artist !== showEditModal.artist) updates.artist = editForm.artist
      if (editForm.album !== showEditModal.album) updates.album = editForm.album
      if (editForm.year && editForm.year !== showEditModal.year?.toString()) {
        updates.year = parseInt(editForm.year)
      }
      
      if (Object.keys(updates).length > 0) {
        const result = await window.electron.updateTrack(showEditModal.id, updates)
        if (result.success) {
          // Refrescar la lista de tracks
          const updatedTracks = await window.electron.getTracks()
          useLibraryStore.getState().setTracks(updatedTracks)
          console.log('[TrackList] Metadata guardada exitosamente')
        }
      }
      
      setShowEditModal(null)
    } catch (error) {
      console.error('Error guardando metadata:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSearchMetadata = async (track: Track) => {
    if (!track.id) return
    
    setSearchingMetadata(track.id)
    setMenuOpen(null)
    
    try {
      // Limpiar el título para la búsqueda (remover artista si está duplicado)
      let searchTitle = track.title
      if (searchTitle.toLowerCase().startsWith(track.artist.toLowerCase() + ' - ')) {
        searchTitle = searchTitle.substring(track.artist.length + 3)
      }
      
      // Limpiar patrones comunes de YouTube
      searchTitle = searchTitle
        .replace(/\s*\(Official.*?\)/gi, '')
        .replace(/\s*\(Video.*?\)/gi, '')
        .replace(/\s*\(Audio.*?\)/gi, '')
        .replace(/\s*\(Lyric.*?\)/gi, '')
        .replace(/\s*\(Visualizer\)/gi, '')
        .replace(/\s*\[Official.*?\]/gi, '')
        .replace(/\s*\|.*$/gi, '')
        .trim()
      
      console.log(`[TrackList] Buscando metadata: ${track.artist} - ${searchTitle}`)
      
      const result = await window.electron.searchMetadata(track.artist, searchTitle)
      
      if (result.success && result.data) {
        const { title, artist, album, year } = result.data
        
        // Actualizar el track con la nueva metadata
        const updateResult = await window.electron.updateTrack(track.id, {
          title: title || track.title,
          artist: artist || track.artist,
          album: album || track.album,
        })
        
        if (updateResult.success) {
          // Refrescar la lista de tracks
          const updatedTracks = await window.electron.getTracks()
          useLibraryStore.getState().setTracks(updatedTracks)
          console.log(`[TrackList] Metadata actualizada: ${artist} - ${title} (${album})`)
        }
      } else {
        console.log(`[TrackList] No se encontró metadata para: ${track.artist} - ${searchTitle}`)
      }
    } catch (error) {
      console.error('Error buscando metadata:', error)
    } finally {
      setSearchingMetadata(null)
    }
  }

  const handleSearchCover = async (track: Track) => {
    if (!track.id) return
    
    setSearchingCover(track.id)
    setMenuOpen(null)
    
    try {
      console.log(`[TrackList] Buscando cover para: ${track.artist} - ${track.title}`)
      const result = await window.electron.searchCover(track.id)
      
      if (result.success) {
        console.log(`[TrackList] Cover encontrado: ${result.coverPath}`)
        // Refrescar la lista de tracks
        const updatedTracks = await window.electron.getTracks()
        useLibraryStore.getState().setTracks(updatedTracks)
      } else {
        console.log(`[TrackList] No se encontró cover para: ${track.artist} - ${track.title}`)
      }
    } catch (error) {
      console.error('Error buscando cover:', error)
    } finally {
      setSearchingCover(null)
    }
  }

  const formatBitrate = (bitrate?: number) => {
    if (!bitrate) return ''
    return `${Math.round(bitrate / 1000)} kbps`
  }

  const formatSampleRate = (sampleRate?: number, bitsPerSample?: number) => {
    if (!sampleRate) return ''
    const khz = sampleRate / 1000
    const bits = bitsPerSample ? `/${bitsPerSample}bit` : ''
    return `${khz}kHz${bits}`
  }

  return (
    <div className="track-list">
      <div className="track-list-header">
        <div className="track-header-number">#</div>
        <div className="track-header-title">Título</div>
        <div className="track-header-album">Álbum</div>
        <div className="track-header-quality">Calidad</div>
        <div className="track-header-duration">Duración</div>
      </div>

      <div className="track-list-body">
        {tracks.map((track, index) => (
          <div
            key={track.id}
            className={`track-row ${currentTrack?.id === track.id ? 'active' : ''}`}
            onDoubleClick={() => handlePlayTrack(track, index)}
          >
            <div className="track-number">
              <span className="track-index">{index + 1}</span>
              <button
                className="track-play-btn"
                onClick={() => handlePlayTrack(track, index)}
              >
                <Play size={16} />
              </button>
            </div>

            <div className="track-info">
              <TrackCoverImage src={track.coverArt} alt={track.album} trackId={track.id} />
              <div className="track-text">
                <div className="track-title">{track.title}</div>
                <div className="track-artist">{track.artist}</div>
              </div>
            </div>

            <div className="track-album">{track.album}</div>

            <div className="track-quality">
              <div className="quality-badge">FLAC</div>
              <div className="quality-details">
                {formatSampleRate(track.sampleRate, track.bitsPerSample)}
                {track.bitrate && ` · ${formatBitrate(track.bitrate)}`}
              </div>
            </div>

            <div className="track-duration">
              {formatTime(track.duration)}
            </div>

            <div className="track-menu-container" ref={menuOpen === track.id ? menuRef : null}>
              <button 
                className="track-more"
                onClick={(e) => handleOpenMenu(e, track.id!)}
              >
                <MoreVertical size={16} />
              </button>
              
              {menuOpen === track.id && (
                <div className="track-context-menu">
                  <div 
                    className="menu-item has-submenu"
                    onMouseEnter={() => setShowPlaylistSubmenu(true)}
                  >
                    <ListPlus size={16} />
                    <span>Agregar a playlist</span>
                    
                    {showPlaylistSubmenu && (
                      <div className="submenu">
                        {playlists.length === 0 ? (
                          <div className="menu-item disabled">No hay playlists</div>
                        ) : (
                          playlists.map(playlist => (
                            <div 
                              key={playlist.id}
                              className="menu-item"
                              onClick={() => handleAddToPlaylist(track, playlist.id!)}
                            >
                              {playlist.name}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="menu-item" onClick={() => handleOpenInFolder(track)}>
                    <FolderOpen size={16} />
                    <span>Abrir ubicación</span>
                  </div>
                  
                  <div className="menu-item" onClick={() => handleShowInfo(track)}>
                    <Info size={16} />
                    <span>Información</span>
                  </div>
                  
                  <div className="menu-item" onClick={() => handleOpenEditModal(track)}>
                    <Edit3 size={16} />
                    <span>Editar metadata</span>
                  </div>
                  
                  <div 
                    className={`menu-item ${searchingMetadata === track.id ? 'disabled' : ''}`}
                    onClick={() => !searchingMetadata && handleSearchMetadata(track)}
                  >
                    {searchingMetadata === track.id ? (
                      <Loader size={16} className="spinning" />
                    ) : (
                      <Search size={16} />
                    )}
                    <span>{searchingMetadata === track.id ? 'Buscando...' : 'Buscar metadata'}</span>
                  </div>
                  
                  <div 
                    className={`menu-item ${searchingCover === track.id ? 'disabled' : ''}`}
                    onClick={() => !searchingCover && handleSearchCover(track)}
                  >
                    {searchingCover === track.id ? (
                      <Loader size={16} className="spinning" />
                    ) : (
                      <Image size={16} />
                    )}
                    <span>{searchingCover === track.id ? 'Buscando...' : 'Buscar carátula'}</span>
                  </div>
                  
                  <div className="menu-divider" />
                  
                  <div className="menu-item danger" onClick={() => handleDeleteTrack(track)}>
                    <Trash2 size={16} />
                    <span>Eliminar de biblioteca</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal de información */}
      {showInfoModal && (
        <div className="info-modal-overlay" onClick={() => setShowInfoModal(null)}>
          <div className="info-modal" onClick={e => e.stopPropagation()}>
            <h3>Información de la canción</h3>
            <div className="info-grid">
              <div className="info-row">
                <span className="info-label">Título:</span>
                <span className="info-value">{showInfoModal.title}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Artista:</span>
                <span className="info-value">{showInfoModal.artist}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Álbum:</span>
                <span className="info-value">{showInfoModal.album}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Año:</span>
                <span className="info-value">{showInfoModal.year || 'Desconocido'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Género:</span>
                <span className="info-value">{showInfoModal.genre || 'Desconocido'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Duración:</span>
                <span className="info-value">{formatTime(showInfoModal.duration)}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Calidad:</span>
                <span className="info-value">
                  {formatSampleRate(showInfoModal.sampleRate, showInfoModal.bitsPerSample)}
                  {showInfoModal.bitrate && ` · ${formatBitrate(showInfoModal.bitrate)}`}
                </span>
              </div>
              <div className="info-row full-width">
                <span className="info-label">Ubicación:</span>
                <span className="info-value path">{showInfoModal.filePath}</span>
              </div>
            </div>
            <button className="info-close-btn" onClick={() => setShowInfoModal(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Modal de edición de metadata */}
      {showEditModal && (
        <div className="info-modal-overlay" onClick={() => !isSaving && setShowEditModal(null)}>
          <div className="info-modal edit-modal" onClick={e => e.stopPropagation()}>
            <h3>Editar metadata</h3>
            <div className="edit-form">
              <div className="edit-field">
                <label htmlFor="edit-title">Título</label>
                <input
                  id="edit-title"
                  type="text"
                  value={editForm.title}
                  onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                  disabled={isSaving}
                />
              </div>
              <div className="edit-field">
                <label htmlFor="edit-artist">Artista</label>
                <input
                  id="edit-artist"
                  type="text"
                  value={editForm.artist}
                  onChange={e => setEditForm({ ...editForm, artist: e.target.value })}
                  disabled={isSaving}
                />
              </div>
              <div className="edit-field">
                <label htmlFor="edit-album">Álbum</label>
                <input
                  id="edit-album"
                  type="text"
                  value={editForm.album}
                  onChange={e => setEditForm({ ...editForm, album: e.target.value })}
                  disabled={isSaving}
                />
              </div>
              <div className="edit-field">
                <label htmlFor="edit-year">Año</label>
                <input
                  id="edit-year"
                  type="number"
                  value={editForm.year}
                  onChange={e => setEditForm({ ...editForm, year: e.target.value })}
                  placeholder="Ej: 2024"
                  disabled={isSaving}
                />
              </div>
            </div>
            <div className="edit-actions">
              <button 
                className="edit-cancel-btn" 
                onClick={() => setShowEditModal(null)}
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button 
                className="edit-save-btn" 
                onClick={handleSaveEdit}
                disabled={isSaving}
              >
                {isSaving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { NavLink } from 'react-router-dom'
import { Home, Library, Search, Plus, Music, Download, Settings, RefreshCw, X } from 'lucide-react'
import { useLibraryStore } from '../store/libraryStore'
import { useState } from 'react'
import './Sidebar.css'

export default function Sidebar() {
  const { playlists } = useLibraryStore()
  const [isScanning, setIsScanning] = useState(false)
  const [showPlaylistModal, setShowPlaylistModal] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')

  const handleCreatePlaylist = () => {
    setNewPlaylistName('')
    setShowPlaylistModal(true)
  }

  const handleSubmitPlaylist = async () => {
    if (newPlaylistName.trim()) {
      try {
        await window.electron.createPlaylist(newPlaylistName.trim())
        const updatedPlaylists = await window.electron.getAllPlaylists()
        useLibraryStore.getState().setPlaylists(updatedPlaylists)
        setShowPlaylistModal(false)
        setNewPlaylistName('')
      } catch (error) {
        console.error('Error creating playlist:', error)
      }
    }
  }

  const handleScanLibrary = async () => {
    try {
      setIsScanning(true)
      
      // Obtener la carpeta configurada en settings
      const settings = await window.electron.settings.get()
      let folderPath = settings.downloadPath
      
      // Si no hay carpeta configurada, pedir que seleccione una
      if (!folderPath) {
        folderPath = await window.electron.selectFolder()
        
        // Guardar la carpeta seleccionada en settings
        if (folderPath) {
          await window.electron.settings.save({
            ...settings,
            downloadPath: folderPath
          })
        }
      }
      
      if (folderPath) {
        useLibraryStore.getState().setLoading(true)
        const result = await window.electron.scanLibrary(folderPath)
        
        if (result.success) {
          const tracks = await window.electron.getTracks()
          useLibraryStore.getState().setTracks(tracks)
          // Escaneo silencioso - sin alerta
          console.log(`[Sidebar] Escaneo completado: ${result.count} canciones nuevas`)
        } else {
          console.error(`[Sidebar] Error en escaneo: ${result.error}`)
        }
      }
    } catch (error) {
      console.error('Error scanning library:', error)
    } finally {
      useLibraryStore.getState().setLoading(false)
      setIsScanning(false)
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <Music size={32} />
        <h1>Jotify</h1>
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/" className="nav-item">
          <Home size={20} />
          <span>Inicio</span>
        </NavLink>
        <NavLink to="/search" className="nav-item">
          <Search size={20} />
          <span>Buscar</span>
        </NavLink>
        <NavLink to="/library" className="nav-item">
          <Library size={20} />
          <span>Tu Biblioteca</span>
        </NavLink>
        <NavLink to="/download" className="nav-item">
          <Download size={20} />
          <span>Descargar</span>
        </NavLink>
        <NavLink to="/settings" className="nav-item">
          <Settings size={20} />
          <span>Configuración</span>
        </NavLink>
      </nav>

      <div className="sidebar-actions">
        <button onClick={handleCreatePlaylist} className="action-btn">
          <Plus size={20} />
          <span>Crear playlist</span>
        </button>
        <button 
          onClick={handleScanLibrary} 
          className="action-btn"
          disabled={isScanning}
        >
          {isScanning ? <RefreshCw size={20} className="spinning" /> : <Library size={20} />}
          <span>{isScanning ? 'Escaneando...' : 'Escanear música'}</span>
        </button>
      </div>

      <div className="sidebar-playlists">
        <h3>Playlists</h3>
        <div className="playlist-list">
          {playlists.map((playlist) => (
            <NavLink
              key={playlist.id}
              to={`/playlist/${playlist.id}`}
              className="playlist-item"
            >
              {playlist.name}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Modal para crear playlist */}
      {showPlaylistModal && (
        <div className="modal-overlay" onClick={() => setShowPlaylistModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Crear nueva playlist</h3>
              <button className="modal-close" onClick={() => setShowPlaylistModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <input
                type="text"
                placeholder="Nombre de la playlist"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmitPlaylist()}
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowPlaylistModal(false)}>
                Cancelar
              </button>
              <button 
                className="btn-create" 
                onClick={handleSubmitPlaylist}
                disabled={!newPlaylistName.trim()}
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}

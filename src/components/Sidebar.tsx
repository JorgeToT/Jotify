import { NavLink } from 'react-router-dom'
import { Home, Library, Search, Plus, Music, Download, Settings } from 'lucide-react'
import { useLibraryStore } from '../store/libraryStore'
import './Sidebar.css'

export default function Sidebar() {
  const { playlists } = useLibraryStore()

  const handleCreatePlaylist = async () => {
    const name = prompt('Nombre de la playlist:')
    if (name) {
      try {
        await window.electron.createPlaylist(name)
        const updatedPlaylists = await window.electron.getAllPlaylists()
        useLibraryStore.getState().setPlaylists(updatedPlaylists)
      } catch (error) {
        console.error('Error creating playlist:', error)
      }
    }
  }

  const handleScanLibrary = async () => {
    try {
      const folderPath = await window.electron.selectFolder()
      if (folderPath) {
        useLibraryStore.getState().setLoading(true)
        const result = await window.electron.scanLibrary(folderPath)
        
        if (result.success) {
          const tracks = await window.electron.getTracks()
          useLibraryStore.getState().setTracks(tracks)
          alert(`Se agregaron ${result.count} canciones a tu biblioteca`)
        } else {
          alert(`Error: ${result.error}`)
        }
      }
    } catch (error) {
      console.error('Error scanning library:', error)
    } finally {
      useLibraryStore.getState().setLoading(false)
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
        <button onClick={handleScanLibrary} className="action-btn">
          <Library size={20} />
          <span>Escanear música</span>
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
    </aside>
  )
}

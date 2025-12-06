import { useLibraryStore } from '../store/libraryStore'
import TrackList from '../components/TrackList'
import './Library.css'

export default function Library() {
  const { tracks, isLoading } = useLibraryStore()

  if (isLoading) {
    return (
      <div className="library">
        <h1 className="page-title">Tu Biblioteca</h1>
        <p>Cargando...</p>
      </div>
    )
  }

  if (tracks.length === 0) {
    return (
      <div className="library">
        <h1 className="page-title">Tu Biblioteca</h1>
        <div className="empty-state">
          <h2>Tu biblioteca está vacía</h2>
          <p>Usa el botón "Escanear música" en la barra lateral para agregar tus archivos FLAC.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="library">
      <h1 className="page-title">Tu Biblioteca</h1>
      <p className="library-info">
        {tracks.length} canciones · Formato HiFi (FLAC)
      </p>
      <TrackList tracks={tracks} />
    </div>
  )
}

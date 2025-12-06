import { useState, useEffect } from 'react'
import { Search as SearchIcon } from 'lucide-react'
import { Track } from '../types/electron'
import TrackList from '../components/TrackList'
import './Search.css'

export default function Search() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Track[]>([])
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    const searchTracks = async () => {
      if (query.trim().length < 2) {
        setResults([])
        return
      }

      setIsSearching(true)
      try {
        const tracks = await window.electron.searchTracks(query)
        setResults(tracks)
      } catch (error) {
        console.error('Error searching:', error)
      } finally {
        setIsSearching(false)
      }
    }

    const debounce = setTimeout(searchTracks, 300)
    return () => clearTimeout(debounce)
  }, [query])

  return (
    <div className="search">
      <h1 className="page-title">Buscar</h1>

      <div className="search-box">
        <SearchIcon size={20} />
        <input
          type="text"
          placeholder="¿Qué quieres escuchar?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {isSearching ? (
        <p className="search-status">Buscando...</p>
      ) : query.trim().length < 2 ? (
        <div className="search-empty">
          <p>Escribe al menos 2 caracteres para buscar canciones, artistas o álbumes.</p>
        </div>
      ) : results.length === 0 ? (
        <div className="search-empty">
          <p>No se encontraron resultados para "{query}"</p>
        </div>
      ) : (
        <>
          <p className="search-results-info">
            {results.length} {results.length === 1 ? 'resultado' : 'resultados'}
          </p>
          <TrackList tracks={results} />
        </>
      )}
    </div>
  )
}

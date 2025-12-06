import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import Layout from './components/Layout'
import Home from './pages/Home'
import Library from './pages/Library'
import PlaylistView from './pages/PlaylistView'
import Search from './pages/Search'
import Settings from './pages/Settings'
import Download from './pages/Download'
import { useLibraryStore } from './store/libraryStore'
import { useAudioPlayer } from './hooks/useAudioPlayer'

function App() {
  const { setTracks, setPlaylists } = useLibraryStore()
  useAudioPlayer()

  useEffect(() => {
    // Load initial data
    const loadData = async () => {
      try {
        const [tracks, playlists] = await Promise.all([
          window.electron.getTracks(),
          window.electron.getAllPlaylists(),
        ])
        setTracks(tracks)
        setPlaylists(playlists)
      } catch (error) {
        console.error('Error loading data:', error)
      }
    }

    loadData()
  }, [])

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/library" element={<Library />} />
          <Route path="/playlist/:id" element={<PlaylistView />} />
          <Route path="/search" element={<Search />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/download" element={<Download />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App

import { ReactNode, useState } from 'react'
import Sidebar from './Sidebar'
import Player from './Player'
import AnimeVisualizer from './AnimeVisualizer'
import { X, Clock } from 'lucide-react'
import './Layout.css'

interface LayoutProps {
  children: ReactNode
}

const LOOP_OPTIONS = [
  { value: 0, label: 'Infinito', icon: '∞' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hora' },
  { value: 120, label: '2 horas' },
  { value: 180, label: '3 horas' },
]

export default function Layout({ children }: LayoutProps) {
  const [isAnimeMode, setIsAnimeMode] = useState(false)
  const [showDurationModal, setShowDurationModal] = useState(false)
  const [loopDuration, setLoopDuration] = useState(0)

  const handleOpenAnimeMode = () => {
    setShowDurationModal(true)
  }

  const handleSelectDuration = (duration: number) => {
    setLoopDuration(duration)
    setShowDurationModal(false)
    setIsAnimeMode(true)
  }

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        {children}
      </main>
      <Player onOpenAnimeMode={handleOpenAnimeMode} />
      
      {/* Modal de selección de duración */}
      {showDurationModal && (
        <div className="duration-modal-overlay" onClick={() => setShowDurationModal(false)}>
          <div className="duration-modal" onClick={e => e.stopPropagation()}>
            <div className="duration-modal-header">
              <Clock size={24} />
              <h3>Modo Anime</h3>
              <button className="duration-modal-close" onClick={() => setShowDurationModal(false)}>
                <X size={20} />
              </button>
            </div>
            <p className="duration-modal-subtitle">
              Selecciona la duración del bucle de reproducción
            </p>
            <div className="duration-options">
              {LOOP_OPTIONS.map(option => (
                <button
                  key={option.value}
                  className="duration-option"
                  onClick={() => handleSelectDuration(option.value)}
                >
                  {option.icon ? (
                    <span className="duration-icon">{option.icon}</span>
                  ) : (
                    <span className="duration-value">{option.value}</span>
                  )}
                  <span className="duration-label">{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      
      <AnimeVisualizer 
        isOpen={isAnimeMode} 
        onClose={() => setIsAnimeMode(false)}
        loopDuration={loopDuration}
      />
    </div>
  )
}

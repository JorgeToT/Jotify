import { Volume2, VolumeX, Volume1 } from 'lucide-react'
import './VolumeSlider.css'

export interface VolumeSliderProps {
  volume: number
  isMuted: boolean
  onVolumeChange: (value: number) => void
  onToggleMute: () => void
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'compact' | 'visualizer'
  className?: string
  showIcon?: boolean
}

export default function VolumeSlider({
  volume,
  isMuted,
  onVolumeChange,
  onToggleMute,
  size = 'md',
  variant = 'default',
  className = '',
  showIcon = true
}: VolumeSliderProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onVolumeChange(parseFloat(e.target.value))
  }

  const getVolumeIcon = () => {
    if (isMuted || volume === 0) return <VolumeX size={getIconSize()} />
    if (volume < 0.5) return <Volume1 size={getIconSize()} />
    return <Volume2 size={getIconSize()} />
  }

  const getIconSize = () => {
    switch (size) {
      case 'sm': return 16
      case 'lg': return 24
      default: return 20
    }
  }

  const displayVolume = isMuted ? 0 : volume

  return (
    <div className={`volume-slider volume-slider--${size} volume-slider--${variant} ${className}`}>
      {showIcon && (
        <button 
          onClick={onToggleMute} 
          className="volume-slider__btn"
          title={isMuted ? 'Activar sonido' : 'Silenciar'}
        >
          {getVolumeIcon()}
        </button>
      )}
      <input
        type="range"
        className="volume-slider__bar"
        min="0"
        max="1"
        step="0.01"
        value={displayVolume}
        onChange={handleChange}
        style={{ '--volume': `${displayVolume * 100}%` } as React.CSSProperties}
      />
    </div>
  )
}

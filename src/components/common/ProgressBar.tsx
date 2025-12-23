import { formatTime } from '../../utils/formatTime'
import './ProgressBar.css'

export interface ProgressBarProps {
  currentTime: number
  duration: number
  onSeek: (time: number) => void
  variant?: 'default' | 'visualizer'
  size?: 'sm' | 'md' | 'lg'
  showTime?: boolean
  className?: string
  disabled?: boolean
}

export default function ProgressBar({
  currentTime,
  duration,
  onSeek,
  variant = 'default',
  size = 'md',
  showTime = true,
  className = '',
  disabled = false
}: ProgressBarProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    onSeek(time)
  }

  const progress = duration ? (currentTime / duration) * 100 : 0

  return (
    <div className={`progress-bar progress-bar--${size} progress-bar--${variant} ${className}`}>
      {showTime && (
        <span className="progress-bar__time progress-bar__time--current">
          {formatTime(currentTime)}
        </span>
      )}
      <input
        type="range"
        className="progress-bar__slider"
        min="0"
        max={duration || 0}
        value={currentTime}
        onChange={handleChange}
        disabled={disabled}
        style={{ '--progress': `${progress}%` } as React.CSSProperties}
      />
      {showTime && (
        <span className="progress-bar__time progress-bar__time--duration">
          {formatTime(duration)}
        </span>
      )}
    </div>
  )
}

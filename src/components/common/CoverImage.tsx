import { useState, useEffect } from 'react'
import './CoverImage.css'

// Convertir ruta de archivo a local-file:// URL (protocolo registrado en Electron)
function toFileUrl(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, '/')
  return `local-file://${encodeURIComponent(normalizedPath)}`
}

export interface CoverImageProps {
  src?: string
  alt: string
  className?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  fallbackIcon?: string
  fallbackUrl?: string
  onError?: () => void
}

export default function CoverImage({ 
  src, 
  alt, 
  className = '',
  size = 'md',
  fallbackIcon = '🎵',
  fallbackUrl,
  onError
}: CoverImageProps) {
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setHasError(false)
    
    if (!src) {
      setImgSrc(null)
      return
    }

    // Si es URL HTTP, usar directamente
    if (src.startsWith('http://') || src.startsWith('https://')) {
      setImgSrc(src)
      return
    }

    // Si es base64 válido
    if (src.startsWith('data:image/') && src.length > 100) {
      setImgSrc(src)
      return
    }

    // Si es ruta de archivo local (Windows o Unix)
    if (src.includes(':\\') || src.includes(':/') || src.startsWith('/')) {
      setImgSrc(toFileUrl(src))
      return
    }

    setImgSrc(null)
  }, [src])

  const handleError = () => {
    setHasError(true)
    onError?.()
  }

  const sizeClass = `cover-image--${size}`

  // Mostrar fallback si hay error o no hay imagen
  if (hasError || !imgSrc) {
    if (fallbackUrl) {
      return (
        <img 
          src={fallbackUrl} 
          alt={alt} 
          className={`cover-image ${sizeClass} ${className}`}
        />
      )
    }
    
    return (
      <div className={`cover-image cover-image--fallback ${sizeClass} ${className}`}>
        <span>{fallbackIcon}</span>
      </div>
    )
  }

  return (
    <img 
      src={imgSrc} 
      alt={alt} 
      className={`cover-image ${sizeClass} ${className}`}
      onError={handleError}
    />
  )
}

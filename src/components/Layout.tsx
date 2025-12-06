import { ReactNode } from 'react'
import Sidebar from './Sidebar'
import Player from './Player'
import './Layout.css'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        {children}
      </main>
      <Player />
    </div>
  )
}

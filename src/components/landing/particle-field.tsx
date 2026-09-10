'use client'

import { useEffect, useRef, useState } from 'react'

const COLORS = ['#b19a9f', '#816a6f', '#5d474c']

type Mote = {
  x: number
  y: number
  r: number
  depth: number
  speed: number
  twinkle: number
  phase: number
  sprite: number
  alpha: number
}

function makeSprite(hex: string) {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, `${hex}b3`)
  gradient.addColorStop(0.4, `${hex}40`)
  gradient.addColorStop(1, `${hex}00`)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  return canvas
}

export default function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const sprites = COLORS.map(makeSprite)
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
    let motes: Mote[] = []
    let width = 0
    let height = 0
    let frame = 0

    const seed = () => {
      const count = Math.min(110, Math.round((width * height) / 16000))
      motes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 0.7 + Math.random() * 1.8,
        depth: 0.25 + Math.random() * 0.75,
        speed: 0.12 + Math.random() * 0.25,
        twinkle: 0.4 + Math.random() * 0.8,
        phase: Math.random() * Math.PI * 2,
        sprite: Math.floor(Math.random() * sprites.length),
        alpha: 0.2 + Math.random() * 0.35,
      }))
    }

    const draw = (t: number) => {
      ctx.clearRect(0, 0, width, height)
      pointer.x += (pointer.tx - pointer.x) * 0.05
      pointer.y += (pointer.ty - pointer.y) * 0.05
      for (const m of motes) {
        const angle =
          (Math.sin(m.x * 0.0012 + t * 0.00008) + Math.cos(m.y * 0.001 - t * 0.00006)) * Math.PI
        m.x += Math.cos(angle) * m.speed
        m.y += Math.sin(angle) * m.speed * 0.7 - 0.02
        if (m.x < -20) m.x = width + 20
        if (m.x > width + 20) m.x = -20
        if (m.y < -20) m.y = height + 20
        if (m.y > height + 20) m.y = -20
        const glow = 0.7 + 0.3 * Math.sin(t * 0.001 * m.twinkle + m.phase)
        const size = m.r * 9
        ctx.globalAlpha = m.alpha * glow
        ctx.drawImage(
          sprites[m.sprite],
          m.x + pointer.x * m.depth * 18 - size / 2,
          m.y + pointer.y * m.depth * 12 - size / 2,
          size,
          size
        )
      }
      ctx.globalAlpha = 1
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      seed()
      if (reduced) draw(0)
    }

    const loop = (t: number) => {
      draw(t)
      frame = requestAnimationFrame(loop)
    }

    const onPointer = (e: PointerEvent) => {
      pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2
      pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2
    }
    const onVisibility = () => {
      cancelAnimationFrame(frame)
      if (!document.hidden) frame = requestAnimationFrame(loop)
    }

    resize()
    setReady(true)
    window.addEventListener('resize', resize)
    if (!reduced) {
      frame = requestAnimationFrame(loop)
      window.addEventListener('pointermove', onPointer)
      document.addEventListener('visibilitychange', onVisibility)
    }
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-1000 ${
        ready ? 'opacity-100' : 'opacity-0'
      }`}
    />
  )
}

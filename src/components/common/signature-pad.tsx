'use client'

import React, { useRef, useEffect, useImperativeHandle, useCallback, useState } from 'react'
import { GlassButton } from '../glass/glass-button'
import { Trash2 } from 'lucide-react'

export interface SignaturePadHandle {
  /** Returns canvas content as a Blob (PNG), or null if canvas is empty. */
  getBlob(): Promise<Blob | null>
  /** Clears the canvas. */
  clear(): void
  /** Returns true if the user has drawn anything. */
  isEmpty(): boolean
}

interface SignaturePadProps {
  label?: string
  /** Called whenever the drawn state changes (drawn / cleared). */
  onChange?: (hasSignature: boolean) => void
  error?: string
  disabled?: boolean
}

export const SignaturePad = React.forwardRef<SignaturePadHandle, SignaturePadProps>(
  function SignaturePad({ label, onChange, error, disabled = false }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const drawing = useRef(false)
    const hasContent = useRef(false)
    const [empty, setEmpty] = useState(true)

    // Device-pixel-ratio aware resize
    const resizeCanvas = useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1

      // Preserve existing drawing during resize
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = canvas.width
      tempCanvas.height = canvas.height
      const tempCtx = tempCanvas.getContext('2d')
      if (tempCtx) tempCtx.drawImage(canvas, 0, 0)

      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.scale(dpr, dpr)
      ctx.strokeStyle = getComputedStyle(canvas).getPropertyValue('--color-text-primary') || '#ffffff'
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      if (hasContent.current) {
        ctx.drawImage(tempCanvas, 0, 0, rect.width, rect.height)
      }
    }, [])

    useEffect(() => {
      resizeCanvas()
      const ro = new ResizeObserver(resizeCanvas)
      if (canvasRef.current) ro.observe(canvasRef.current)
      return () => ro.disconnect()
    }, [resizeCanvas])

    const getCtx = (): CanvasRenderingContext2D | null => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      // Re-apply stroke style each time (CSS variables may not be inlined)
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      return ctx
    }

    const getPos = (clientX: number, clientY: number, canvas: HTMLCanvasElement) => {
      const rect = canvas.getBoundingClientRect()
      return { x: clientX - rect.left, y: clientY - rect.top }
    }

    const startDraw = useCallback((x: number, y: number) => {
      if (disabled) return
      drawing.current = true
      const ctx = getCtx()
      if (!ctx) return
      ctx.beginPath()
      ctx.moveTo(x, y)
    }, [disabled])

    const moveDraw = useCallback((x: number, y: number) => {
      if (!drawing.current || disabled) return
      const ctx = getCtx()
      if (!ctx) return
      ctx.lineTo(x, y)
      ctx.stroke()
      if (!hasContent.current) {
        hasContent.current = true
        setEmpty(false)
        onChange?.(true)
      }
    }, [disabled, onChange])

    const endDraw = useCallback(() => {
      drawing.current = false
    }, [])

    // Mouse events
    const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pos = getPos(e.clientX, e.clientY, canvasRef.current!)
      startDraw(pos.x, pos.y)
    }
    const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pos = getPos(e.clientX, e.clientY, canvasRef.current!)
      moveDraw(pos.x, pos.y)
    }
    const onMouseUp = () => endDraw()
    const onMouseLeave = () => endDraw()

    // Touch events
    const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      const touch = e.touches[0]
      const pos = getPos(touch.clientX, touch.clientY, canvasRef.current!)
      startDraw(pos.x, pos.y)
    }
    const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      const touch = e.touches[0]
      const pos = getPos(touch.clientX, touch.clientY, canvasRef.current!)
      moveDraw(pos.x, pos.y)
    }
    const onTouchEnd = () => endDraw()

    const clear = useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      hasContent.current = false
      setEmpty(true)
      onChange?.(false)
    }, [onChange])

    useImperativeHandle(ref, () => ({
      getBlob: () =>
        new Promise<Blob | null>((resolve) => {
          if (!hasContent.current || !canvasRef.current) {
            resolve(null)
            return
          }
          canvasRef.current.toBlob((blob) => resolve(blob), 'image/png')
        }),
      clear,
      isEmpty: () => !hasContent.current,
    }))

    return (
      <div className="flex flex-col gap-2">
        {label && (
          <span
            className="text-sm font-medium"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {label}
          </span>
        )}
        <div
          className="relative rounded-[var(--border-radius)] overflow-hidden"
          style={{
            border: error
              ? '2px solid var(--color-destructive)'
              : '1px solid var(--color-glass-border)',
            background: 'var(--color-glass-bg-elevated)',
          }}
        >
          <canvas
            ref={canvasRef}
            className="block w-full touch-none"
            style={{
              height: 140,
              cursor: disabled ? 'not-allowed' : 'crosshair',
              opacity: disabled ? 0.5 : 1,
            }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseLeave}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          />
          {/* Sign-here guide line */}
          {empty && (
            <span
              className="absolute bottom-5 left-4 right-4 text-xs pointer-events-none select-none"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Sign here ✕
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          {error && (
            <p className="text-sm" style={{ color: 'var(--color-destructive)' }} role="alert">
              {error}
            </p>
          )}
          {!error && <span />}
          <GlassButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={clear}
            disabled={disabled || empty}
            aria-label="Clear signature"
          >
            <Trash2 size={14} />
            Clear
          </GlassButton>
        </div>
      </div>
    )
  }
)

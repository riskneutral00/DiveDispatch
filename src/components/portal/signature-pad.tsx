'use client'

import React, { useRef, useEffect, useImperativeHandle, useCallback, useState } from 'react'
import { Button } from '../ui/button'
import { InlineError } from '../ui/inline-error'
import { Trash2 } from 'lucide-react'

export interface SignaturePadHandle {
  getBlob(): Promise<Blob | null>
  getImageData(): ImageData | null
  clear(): void
  isEmpty(): boolean
}

interface SignaturePadProps {
  label?: string
  onChange?: (hasSignature: boolean) => void
  onDrawEnd?: () => void
  error?: string
  disabled?: boolean
}

export const SignaturePad = React.forwardRef<SignaturePadHandle, SignaturePadProps>(
  function SignaturePad({ label, onChange, onDrawEnd, error, disabled = false }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const drawing = useRef(false)
    const hasContent = useRef(false)
    const [empty, setEmpty] = useState(true)

    const resizeCanvas = useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1

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
      ctx.strokeStyle = getComputedStyle(canvas).getPropertyValue('--color-text-primary') || '#ffffff'
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
      if (drawing.current) {
        drawing.current = false
        onDrawEnd?.()
      }
    }, [onDrawEnd])

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
      getImageData: () => {
        const canvas = canvasRef.current
        if (!canvas || !hasContent.current) return null
        const ctx = canvas.getContext('2d')
        if (!ctx) return null
        return ctx.getImageData(0, 0, canvas.width, canvas.height)
      },
      clear,
      isEmpty: () => !hasContent.current,
    }))

    return (
      <div className="flex flex-col gap-2">
        {label && (
          <span
            className="text-body font-medium text-secondary"
          >
            {label}
          </span>
        )}
        <div
          className="relative rounded-theme overflow-hidden"
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
          {empty && (
            <span
              className="absolute bottom-5 left-4 right-4 text-label pointer-events-none select-none text-secondary"
            >
              Sign here ✕
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          {error && (
            <InlineError>{error}</InlineError>
          )}
          {!error && <span />}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clear}
            disabled={disabled || empty}
            aria-label="Clear signature"
          >
            <Trash2 size={14} />
            Clear
          </Button>
        </div>
      </div>
    )
  }
)

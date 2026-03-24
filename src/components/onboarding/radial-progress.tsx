'use client'

interface RadialProgressProps {
  percentage: number
  size?: number
}

export function RadialProgress({ percentage, size = 40 }: RadialProgressProps) {
  const radius = (size - 6) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  const isComplete = percentage >= 100

  return (
    <div
      className="relative"
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size }}
      aria-label={`Profile ${percentage}% complete`}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-glass-border)"
          strokeWidth={3}
        />
        {/* Fill */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={isComplete ? 'var(--color-success)' : 'var(--color-primary)'}
          strokeWidth={3}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.4s ease, stroke 0.3s ease' }}
        />
      </svg>
      {/* Percentage label in center */}
      <span
        style={{
          position: 'absolute',
          fontSize: '10px',
          fontWeight: 600,
          color: isComplete ? 'var(--color-success)' : 'var(--color-text-secondary)',
          lineHeight: 1,
          pointerEvents: 'none',
        }}
      >
        {percentage}%
      </span>
    </div>
  )
}

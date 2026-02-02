import { useState, useEffect } from 'react';
import { renderProfiler, type RenderTrigger } from '../../utils/renderStats';

/**
 * Dev-mode overlay showing render performance stats.
 * Helps identify unnecessary redraws and performance bottlenecks.
 */
export function RenderStatsOverlay() {
  const [stats, setStats] = useState(() => renderProfiler.getStats());
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show in dev mode
    if (!import.meta.env.DEV) return;

    const unsubscribe = renderProfiler.subscribe(setStats);

    // Toggle visibility with Ctrl+Shift+P
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setIsVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unsubscribe();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (!import.meta.env.DEV || !isVisible) {
    return null;
  }

  const getFpsColor = (fps: number) => {
    if (fps >= 55) return '#4ade80'; // green
    if (fps >= 30) return '#fbbf24'; // yellow
    return '#ef4444'; // red
  };

  const getFrameTimeColor = (ms: number) => {
    if (ms <= 16.67) return '#4ade80'; // 60fps target
    if (ms <= 33.33) return '#fbbf24'; // 30fps
    return '#ef4444';
  };

  const topTriggers = (Object.entries(stats.triggerCounts) as [RenderTrigger, number][])
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div
      style={{
        position: 'fixed',
        top: '80px',
        right: '16px',
        background: 'rgba(0, 0, 0, 0.85)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        padding: '12px 16px',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '11px',
        color: '#e5e5e5',
        zIndex: 9999,
        minWidth: '180px',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <div style={{ marginBottom: '8px', fontWeight: 600, color: '#FF5500' }}>
        Render Stats
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span>FPS:</span>
        <span style={{ color: getFpsColor(stats.fps), fontWeight: 600 }}>
          {stats.fps}
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span>Frame time:</span>
        <span style={{ color: getFrameTimeColor(stats.avgFrameTime) }}>
          {stats.avgFrameTime.toFixed(2)}ms
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span>Frames:</span>
        <span>{stats.frameCount}</span>
      </div>

      {stats.unnecessaryRedraws > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: '#ef4444' }}>
          <span>Unnecessary:</span>
          <span>{stats.unnecessaryRedraws}</span>
        </div>
      )}

      {stats.lastTrigger && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span>Last trigger:</span>
          <span style={{ color: '#94a3b8' }}>{stats.lastTrigger}</span>
        </div>
      )}

      {topTriggers.length > 0 && (
        <>
          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '8px', marginTop: '4px' }}>
            <div style={{ marginBottom: '4px', color: '#94a3b8', fontSize: '10px' }}>
              Trigger breakdown:
            </div>
            {topTriggers.map(([trigger, count]) => (
              <div key={trigger} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                <span>{trigger}</span>
                <span style={{ color: '#64748b' }}>{count}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '8px', marginTop: '8px', fontSize: '9px', color: '#64748b' }}>
        Ctrl+Shift+P to toggle
      </div>
    </div>
  );
}

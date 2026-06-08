import { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { Palette, Sun, Moon, Layers } from 'lucide-react';

const ICONS = { dark: Moon, light: Sun, darkblue: Layers };
const PREVIEWS = {
  dark:     { bg: '#0f1117', surface: '#161b27', accent: '#6366F1' },
  light:    { bg: '#f1f5f9', surface: '#ffffff', accent: '#6366F1' },
  darkblue: { bg: '#060d1f', surface: '#0d1b35', accent: '#4F8EF0' },
};

export default function ThemeSwitcher() {
  const { theme, setTheme, themes } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>
      {/* Painel de temas */}
      {open && (
        <div className="mb-3 rounded-2xl border shadow-2xl overflow-hidden"
          style={{
            background: 'var(--bg-surface)',
            borderColor: 'var(--border)',
            width: 220,
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }}>
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <Palette size={14} style={{ color: 'var(--text-muted)' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Aparência
            </span>
          </div>

          {/* Opções */}
          <div className="p-3 space-y-1.5">
            {Object.entries(themes).map(([key, cfg]) => {
              const Icon    = ICONS[key] || Moon;
              const preview = PREVIEWS[key];
              const active  = theme === key;
              return (
                <button key={key} onClick={() => { setTheme(key); setOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left"
                  style={{
                    background: active ? 'var(--bg-elevated)' : 'transparent',
                    border: active ? '1px solid var(--border-hover)' : '1px solid transparent',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                >
                  {/* Preview do tema */}
                  <div className="w-8 h-6 rounded-md overflow-hidden flex-shrink-0 border"
                    style={{ borderColor: 'var(--border-hover)' }}>
                    <div style={{ background: preview.bg, height: '40%', width: '100%' }} />
                    <div style={{ background: preview.surface, height: '35%', width: '100%' }} />
                    <div style={{ background: preview.accent, height: '25%', width: '60%' }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium" style={{ color: active ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {cfg.label}
                    </div>
                  </div>

                  {active && (
                    <div className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center"
                      style={{ background: '#6366F1' }}>
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Botão flutuante */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-all"
        style={{
          background: open ? '#6366F1' : 'var(--bg-surface)',
          border: '1px solid var(--border-hover)',
          boxShadow: open ? '0 4px 20px rgba(99,102,241,0.4)' : '0 4px 20px rgba(0,0,0,0.3)',
          transform: open ? 'rotate(30deg)' : 'rotate(0deg)',
          transition: 'all 0.2s ease',
        }}
        title="Mudar tema"
      >
        <Palette size={18} style={{ color: open ? '#fff' : 'var(--text-muted)' }} />
      </button>
    </div>
  );
}

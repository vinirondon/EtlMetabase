import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// ── Logo ─────────────────────────────────────────────────────────────────────
function Logo({ size = 36 }) {
  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="M16 2L28 9V23L16 30L4 23V9L16 2Z" fill="#4F46E5" opacity="0.2"/>
        <path d="M16 2L28 9V23L16 30L4 23V9L16 2Z" stroke="#6366F1" strokeWidth="1"/>
        <path d="M7 11H13M7 16H12M7 21H13" stroke="#818CF8" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M14.5 16H18.5M17 13L20 16L17 19" stroke="#A5B4FC" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="20" y="10.5" width="5.5" height="11" rx="1.5" fill="none" stroke="#6366F1" strokeWidth="1.4"/>
        <rect x="21.5" y="12" width="2.5" height="7" rx="0.8" fill="#818CF8"/>
      </svg>
      <span style={{ fontFamily: 'system-ui', fontWeight: 800, fontSize: size * 0.56, letterSpacing: '-0.03em', color: '#fff' }}>
        ETL<span style={{ color: '#818CF8' }}>platform</span>
      </span>
    </div>
  );
}

// ── Feature Card ─────────────────────────────────────────────────────────────
function FeatureCard({ icon, title, desc, accent }) {
  const accents = {
    indigo: 'border-indigo-500/20 bg-indigo-500/5',
    violet: 'border-violet-500/20 bg-violet-500/5',
    blue:   'border-blue-500/20 bg-blue-500/5',
    emerald:'border-emerald-500/20 bg-emerald-500/5',
  };
  return (
    <div className={`p-4 rounded-xl border ${accents[accent]} flex gap-3`}>
      <div className="text-2xl flex-shrink-0">{icon}</div>
      <div>
        <div className="text-sm font-semibold text-white mb-0.5">{title}</div>
        <div className="text-xs text-[#8892a4] leading-relaxed">{desc}</div>
      </div>
    </div>
  );
}

// ── Animated pipeline ─────────────────────────────────────────────────────────
function PipelineAnim() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActive(p => (p + 1) % 3), 1800);
    return () => clearInterval(t);
  }, []);
  const steps = ['API', 'ETL', 'SQL'];
  const colors = ['#818CF8','#A78BFA','#60A5FA'];
  return (
    <div className="flex items-center gap-2 my-6">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-500 ${
            active === i
              ? 'scale-110 text-white shadow-lg shadow-indigo-500/30'
              : 'text-[#8892a4]'
          }`} style={{
            background: active === i ? colors[i] + '33' : '#0f1117',
            border: `1px solid ${active === i ? colors[i] + '60' : '#1e2535'}`,
            color: active === i ? colors[i] : undefined,
          }}>
            {s}
          </div>
          {i < 2 && (
            <div className="flex gap-0.5">
              {[0,1,2].map(d => (
                <div key={d} className="w-1 h-1 rounded-full transition-all duration-300" style={{
                  background: active > i ? colors[i] : '#1e2535',
                  opacity: active > i ? 1 - d * 0.2 : 0.3,
                  transitionDelay: `${d * 80}ms`,
                }}/>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Stat ─────────────────────────────────────────────────────────────────────
function Stat({ value, label }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-white" style={{ fontFamily: 'system-ui' }}>{value}</div>
      <div className="text-xs text-[#8892a4] mt-0.5">{label}</div>
    </div>
  );
}

// ── Main Login ────────────────────────────────────────────────────────────────
export default function Login() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'E-mail ou senha incorretos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#080b12' }}>

      {/* ── Left: Landing ───────────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[55%] p-12 relative overflow-hidden">

        {/* Background grid */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}/>

        {/* Glow */}
        <div className="absolute top-0 left-0 w-96 h-96 rounded-full pointer-events-none" style={{
          background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
        }}/>
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full pointer-events-none" style={{
          background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)',
        }}/>

        <div className="relative z-10">
          <Logo size={36} />
        </div>

        <div className="relative z-10 max-w-xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6" style={{
            background: 'rgba(99,102,241,0.1)',
            border: '1px solid rgba(99,102,241,0.25)',
            color: '#818CF8',
          }}>
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"/>
            Plataforma ETL Enterprise
          </div>

          <h1 className="text-4xl font-bold text-white mb-4 leading-tight" style={{ fontFamily: 'system-ui', letterSpacing: '-0.03em' }}>
            Automatize a captação<br/>
            <span style={{ color: '#818CF8' }}>de dados via API</span>
          </h1>

          <p className="text-[#8892a4] text-base leading-relaxed mb-4">
            Conecte qualquer API REST ou SOAP ao seu banco de dados SQL Server.
            Configure integrações em minutos, agende execuções automáticas e
            monitore tudo em tempo real — sem escrever uma linha de código.
          </p>

          <PipelineAnim />

          <div className="grid grid-cols-2 gap-3 mb-8">
            <FeatureCard icon="⚡" accent="indigo" title="Execução automática"
              desc="Agendamentos via cron — de 5 minutos a mensalmente. Rodando 24/7 sem intervenção." />
            <FeatureCard icon="🗄️" accent="violet" title="Auto-criação de tabelas"
              desc="Detecta os campos da API e cria as tabelas no SQL Server automaticamente." />
            <FeatureCard icon="🔄" accent="blue" title="Upsert inteligente"
              desc="Insere novos registros e atualiza existentes com base em campo de deduplicação." />
            <FeatureCard icon="📊" accent="emerald" title="Logs & monitoramento"
              desc="Histórico completo de execuções, erros, registros inseridos e tempo de resposta." />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6 pt-6 border-t border-[#1e2535]">
            <Stat value="∞" label="APIs suportadas" />
            <Stat value="<5min" label="Configuração inicial" />
            <Stat value="99.9%" label="Disponibilidade" />
          </div>
        </div>

        <div className="relative z-10 text-xs text-[#4a5568]">
          © {new Date().getFullYear()} ETLplatform · Todos os dados são criptografados
        </div>
      </div>

      {/* ── Right: Login form ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-8" style={{ background: '#0a0d16' }}>

        {/* Mobile logo */}
        <div className="lg:hidden mb-8">
          <Logo size={32} />
        </div>

        <div className="w-full max-w-[380px]">
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'system-ui', letterSpacing: '-0.02em' }}>
              Bem-vindo de volta
            </h2>
            <p className="text-sm text-[#8892a4]">
              Acesse sua plataforma de integrações
            </p>
          </div>

          {/* Form */}
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#8892a4] mb-1.5 uppercase tracking-wider">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="seu@email.com"
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-[#4a5568] outline-none transition-all"
                style={{
                  background: '#0f1117',
                  border: '1px solid #1e2535',
                  fontFamily: 'system-ui',
                }}
                onFocus={e => e.target.style.borderColor = '#6366F1'}
                onBlur={e => e.target.style.borderColor = '#1e2535'}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#8892a4] mb-1.5 uppercase tracking-wider">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-[#4a5568] outline-none transition-all"
                style={{
                  background: '#0f1117',
                  border: '1px solid #1e2535',
                  fontFamily: 'system-ui',
                }}
                onFocus={e => e.target.style.borderColor = '#6366F1'}
                onBlur={e => e.target.style.borderColor = '#1e2535'}
              />
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl text-sm text-red-400 flex items-center gap-2"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M7 4.5V7.5M7 9.5H7.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all"
              style={{
                background: loading ? '#3730A3' : 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                opacity: loading ? 0.7 : 1,
                boxShadow: loading ? 'none' : '0 4px 24px rgba(99,102,241,0.3)',
                fontFamily: 'system-ui',
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="5.5" stroke="white" strokeWidth="1.5" strokeDasharray="28" strokeDashoffset="10"/>
                  </svg>
                  Acessando...
                </span>
              ) : 'Entrar na plataforma'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-[#1e2535]"/>
            <span className="text-xs text-[#4a5568]">acesso seguro</span>
            <div className="flex-1 h-px bg-[#1e2535]"/>
          </div>

          {/* Security note */}
          <div className="flex items-center justify-center gap-4 text-xs text-[#4a5568]">
            <span className="flex items-center gap-1.5">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M5.5 1L9 2.5V5.5C9 7.5 7.5 9.3 5.5 10C3.5 9.3 2 7.5 2 5.5V2.5L5.5 1Z" stroke="#4a5568" strokeWidth="1"/>
              </svg>
              JWT seguro
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <rect x="2" y="4.5" width="7" height="5.5" rx="1" stroke="#4a5568" strokeWidth="1"/>
                <path d="M3.5 4.5V3.5C3.5 2.1 4.1 1.5 5.5 1.5C6.9 1.5 7.5 2.1 7.5 3.5V4.5" stroke="#4a5568" strokeWidth="1"/>
              </svg>
              Senha criptografada
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <circle cx="5.5" cy="5.5" r="4" stroke="#4a5568" strokeWidth="1"/>
                <path d="M3.5 5.5L5 7L7.5 4" stroke="#4a5568" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Multi-empresa
            </span>
          </div>
        </div>

        {/* Mobile features summary */}
        <div className="lg:hidden mt-10 w-full max-w-[380px] space-y-2">
          <div className="text-xs text-[#4a5568] text-center mb-3">Por que usar o ETLplatform?</div>
          {[
            { icon: '⚡', text: 'Integração com qualquer API REST/SOAP' },
            { icon: '🗄️', text: 'Auto-criação de tabelas no SQL Server' },
            { icon: '📊', text: 'Monitoramento e logs em tempo real' },
          ].map(f => (
            <div key={f.text} className="flex items-center gap-2.5 text-xs text-[#8892a4]">
              <span>{f.icon}</span>
              <span>{f.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

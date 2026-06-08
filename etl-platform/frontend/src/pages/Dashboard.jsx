import { useState, useEffect } from 'react';
import { dashboardAPI } from '../services/api';
import { Building2, Plug2, AlertTriangle, Activity, Clock, Database } from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';
import Spinner from '../components/ui/Spinner';
import { formatDate, formatDuration } from '../utils/helpers';

function StatCard({ icon: Icon, label, value, sub, color = 'brand' }) {
  const colors = {
    brand: 'text-brand-400 bg-brand-500/10',
    green: 'text-emerald-400 bg-emerald-500/10',
    red:   'text-red-400 bg-red-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
  };
  return (
    <div className="card flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-white">{value ?? '—'}</div>
        <div className="text-sm font-medium text-white/70 truncate">{label}</div>
        {sub && <div className="text-xs text-[#8892a4] mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardAPI.stats()
      .then(r => setData(r.data))
      .finally(() => setLoading(false));

    const i = setInterval(() => {
      dashboardAPI.stats().then(r => setData(r.data));
    }, 30000);
    return () => clearInterval(i);
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64"><Spinner size={8} /></div>
  );

  // Chaves exatas retornadas pelo backend
  const {
    active_companies    = 0,
    active_integrations = 0,
    errors_24h          = 0,
    executions_today    = 0,
    success_today       = 0,
    records_today       = 0,
    recent_logs         = [],
    upcoming_schedules  = [],
  } = data || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-[#8892a4] text-sm mt-1">Visão geral das integrações em tempo real</p>
      </div>

      {/* ── Cards de estatísticas ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Building2}     label="Empresas Ativas"    value={active_companies}    color="brand" />
        <StatCard icon={Plug2}         label="Integrações Ativas" value={active_integrations} color="green" />
        <StatCard icon={AlertTriangle} label="Com Erro (24h)"     value={errors_24h}          color="red" />
        <StatCard
          icon={Activity}
          label="Execuções Hoje"
          value={executions_today}
          sub={`${success_today} com sucesso`}
          color="amber"
        />
      </div>

      {/* ── Execuções recentes + Próximas execuções ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Activity size={16} className="text-brand-400" /> Execuções Recentes
            </h2>
          </div>
          {recent_logs.length === 0 ? (
            <div className="text-center py-8 text-[#8892a4] text-sm">
              Nenhuma execução registrada ainda
            </div>
          ) : (
            <div className="space-y-2">
              {recent_logs.map(log => (
                <div key={log.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#0f1117] border border-[#1e2535]">
                  <StatusBadge status={log.status} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{log.integration_name}</div>
                    <div className="text-xs text-[#8892a4]">{log.company_name}</div>
                  </div>
                  <div className="text-right text-xs text-[#8892a4] flex-shrink-0">
                    <div>{log.records_inserted ?? 0} registros</div>
                    <div>{formatDuration(log.duration_ms)}</div>
                  </div>
                  <div className="text-xs text-[#8892a4] flex-shrink-0 hidden lg:block">
                    {formatDate(log.started_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="font-semibold text-white flex items-center gap-2 mb-4">
            <Clock size={16} className="text-brand-400" /> Próximas Execuções
          </h2>
          {upcoming_schedules.length === 0 ? (
            <div className="text-center py-8 text-[#8892a4] text-sm">
              Nenhum agendamento ativo
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming_schedules.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-brand-600/20 border border-brand-600/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Clock size={10} className="text-brand-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">{item.integration_name}</div>
                    <div className="text-xs text-[#8892a4]">{item.company_name}</div>
                    <div className="text-xs text-brand-400 font-mono mt-0.5">{item.cron_expression}</div>
                    {item.last_run && (
                      <div className="text-xs text-[#8892a4] mt-0.5">
                        Última: {formatDate(item.last_run)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── Resumo do dia ─────────────────────────────────────────────── */}
      <div className="card">
        <h2 className="font-semibold text-white flex items-center gap-2 mb-4">
          <Database size={16} className="text-brand-400" /> Resumo do Dia
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-emerald-400">{success_today}</div>
            <div className="text-xs text-[#8892a4] mt-1">Bem-sucedidas</div>
          </div>
          <div className="text-center border-x border-[#1e2535]">
            <div className="text-3xl font-bold text-brand-400">{records_today}</div>
            <div className="text-xs text-[#8892a4] mt-1">Registros Gravados</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-red-400">{errors_24h}</div>
            <div className="text-xs text-[#8892a4] mt-1">Com Erro (24h)</div>
          </div>
        </div>
      </div>

    </div>
  );
}

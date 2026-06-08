import { useState, useEffect } from 'react';
import { schedulesAPI, integrationsAPI } from '../services/api';
import { Plus, CalendarClock, Power, Trash2, Clock } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import { formatDate } from '../utils/helpers';
import { useAuth } from '../contexts/AuthContext';

const PRESET_LABELS = {
  'every_5min':    'A cada 5 minutos',
  'every_15min':   'A cada 15 minutos',
  'every_30min':   'A cada 30 minutos',
  'every_hour':    'A cada 1 hora',
  'every_6h':      'A cada 6 horas',
  'every_12h':     'A cada 12 horas',
  'daily_midnight':'Diário à meia-noite',
  'daily_6am':     'Diário às 6h',
  'weekly_monday': 'Semanal (seg 8h)',
  'monthly_first': 'Mensal (dia 1 às 8h)',
};

// Mapeamento preset → cron_expression
const PRESET_CRON = {
  'every_5min':    '*/5 * * * *',
  'every_15min':   '*/15 * * * *',
  'every_30min':   '*/30 * * * *',
  'every_hour':    '0 * * * *',
  'every_6h':      '0 */6 * * *',
  'every_12h':     '0 */12 * * *',
  'daily_midnight':'0 0 * * *',
  'daily_6am':     '0 6 * * *',
  'weekly_monday': '0 8 * * 1',
  'monthly_first': '0 8 1 * *',
};

function ScheduleForm({ integrations, onSave, onClose }) {
  const [form, setForm] = useState({
    integration_id: '',
    preset: 'every_hour',
    cron_expression: '',
    useCustom: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Se usar preset, converte para cron_expression antes de enviar
      const cron = form.useCustom
        ? form.cron_expression
        : PRESET_CRON[form.preset];

      if (!cron) {
        setError('Selecione uma frequência válida.');
        setLoading(false);
        return;
      }

      await schedulesAPI.create({
        integration_id:  form.integration_id,
        cron_expression: cron,
        preset:          form.useCustom ? undefined : form.preset,
      });
      onSave();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Integração *</label>
        <select
          className="select"
          value={form.integration_id}
          onChange={e => setForm(f => ({ ...f, integration_id: e.target.value }))}
          required
        >
          <option value="">Selecione uma integração</option>
          {integrations.map(i => (
            <option key={i.id} value={i.id}>{i.name} ({i.company_name})</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Frequência</label>
        {!form.useCustom ? (
          <select
            className="select"
            value={form.preset}
            onChange={e => setForm(f => ({ ...f, preset: e.target.value }))}
          >
            {Object.entries(PRESET_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        ) : (
          <input
            className="input font-mono text-xs"
            value={form.cron_expression}
            onChange={e => setForm(f => ({ ...f, cron_expression: e.target.value }))}
            placeholder="*/30 * * * *"
          />
        )}

        {/* Preview da expressão cron */}
        {!form.useCustom && (
          <p className="text-xs text-[#8892a4] mt-1 font-mono">
            cron: <span className="text-brand-400">{PRESET_CRON[form.preset]}</span>
          </p>
        )}

        <button
          type="button"
          onClick={() => setForm(f => ({ ...f, useCustom: !f.useCustom }))}
          className="text-xs text-brand-400 hover:text-brand-300 mt-1"
        >
          {form.useCustom ? 'Usar opção predefinida' : 'Usar expressão cron personalizada'}
        </button>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex gap-3 justify-end">
        <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? <Spinner size={4} /> : null} Criar Agendamento
        </button>
      </div>
    </form>
  );
}

export default function Schedules() {
  const [schedules, setSchedules] = useState([]);
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const { canDo } = useAuth();

  const load = async () => {
    const [s, i] = await Promise.all([schedulesAPI.list(), integrationsAPI.list()]);
    setSchedules(s.data);
    setIntegrations(i.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggle = async (id) => {
    await schedulesAPI.toggle(id);
    load();
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Remover agendamento para "${name}"?`)) return;
    await schedulesAPI.delete(id);
    load();
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64"><Spinner size={8} /></div>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Agendamentos"
        subtitle="Controle a frequência de execução das integrações"
        action={canDo('superadmin','admin','operator') && (
          <button className="btn-primary" onClick={() => setModal(true)}>
            <Plus size={16} />Novo Agendamento
          </button>
        )}
      />

      {schedules.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={CalendarClock}
            title="Nenhum agendamento"
            desc="Crie agendamentos para executar integrações automaticamente."
            action={canDo('superadmin','admin','operator') && (
              <button className="btn-primary" onClick={() => setModal(true)}>
                <Plus size={16} />Novo Agendamento
              </button>
            )}
          />
        </div>
      ) : (
        <div className="grid gap-3">
          {schedules.map(s => (
            <div key={s.id} className="card flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                s.is_active
                  ? 'bg-emerald-500/15 border border-emerald-500/25'
                  : 'bg-[#1e2535]'
              }`}>
                <Clock size={18} className={s.is_active ? 'text-emerald-400' : 'text-[#8892a4]'} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{s.integration_name}</span>
                  {s.is_active
                    ? <span className="badge-success">Ativo</span>
                    : <span className="badge-neutral">Pausado</span>
                  }
                </div>
                <div className="text-sm text-[#8892a4]">{s.company_name}</div>
                <div className="text-xs text-brand-400 font-mono mt-0.5">{s.cron_expression}</div>
              </div>
              <div className="text-right text-xs text-[#8892a4] hidden lg:block">
                <div>Última: {s.last_run ? formatDate(s.last_run) : 'Nunca'}</div>
                {s.last_status && (
                  <div className="mt-1"><StatusBadge status={s.last_status} /></div>
                )}
                <div className="mt-1">{s.run_count || 0} execuções</div>
              </div>
              {canDo('superadmin','admin','operator') && (
                <div className="flex items-center gap-1">
                  <button
                    className={`px-2 py-1.5 rounded-lg border transition-colors flex items-center gap-1 text-xs ${
                      s.is_active
                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20'
                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                    }`}
                    onClick={() => toggle(s.id)}
                  >
                    <Power size={14} /> {s.is_active ? 'Pausar' : 'Ativar'}
                  </button>
                  <button
                    className="btn-danger px-2 py-1.5"
                    onClick={() => handleDelete(s.id, s.integration_name)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Novo Agendamento">
        <ScheduleForm
          integrations={integrations}
          onSave={() => { setModal(false); load(); }}
          onClose={() => setModal(false)}
        />
      </Modal>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { companiesAPI, integrationsAPI, schedulesAPI, executeAPI, logsAPI } from '../services/api';
import {
    ArrowLeft, Building2, Plug2, CalendarClock, Play, Power,
    Trash2, Pencil, Plus, Clock, Loader2, Database, Server,
    Link2, RefreshCw, Wifi, WifiOff
} from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';
import Spinner from '../components/ui/Spinner';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import IntegrationForm from '../components/forms/IntegrationForm';
import { formatDate } from '../utils/helpers';
import { useAuth } from '../contexts/AuthContext';

// ── Cron presets ─────────────────────────────────────────────────────────────
const PRESET_CRON = {
    'every_5min': '*/5 * * * *',
    'every_15min': '*/15 * * * *',
    'every_30min': '*/30 * * * *',
    'every_hour': '0 * * * *',
    'every_6h': '0 */6 * * *',
    'every_12h': '0 */12 * * *',
    'daily_midnight': '0 0 * * *',
    'daily_6am': '0 6 * * *',
    'weekly_monday': '0 8 * * 1',
    'monthly_first': '0 8 1 * *',
};
const PRESET_LABELS = {
    'every_5min': 'A cada 5 minutos',
    'every_15min': 'A cada 15 minutos',
    'every_30min': 'A cada 30 minutos',
    'every_hour': 'A cada 1 hora',
    'every_6h': 'A cada 6 horas',
    'every_12h': 'A cada 12 horas',
    'daily_midnight': 'Diário à meia-noite',
    'daily_6am': 'Diário às 6h',
    'weekly_monday': 'Semanal (seg 8h)',
    'monthly_first': 'Mensal (dia 1 às 8h)',
};

// ── ScheduleForm (criar/editar agendamento) ───────────────────────────────────
function ScheduleForm({ integration, schedule, integrations = [], onSave, onClose }) {
    const editing = !!schedule;
    const [form, setForm] = useState({
        integration_id: integration?.id || '',
        preset: 'every_hour',
        cron_expression: schedule?.cron_expression || '',
        useCustom: editing ? true : false,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const cron = form.useCustom ? form.cron_expression : PRESET_CRON[form.preset];
            if (!cron) { setError('Selecione uma frequência válida.'); setLoading(false); return; }
            if (!form.integration_id) { setError('Selecione uma integração.'); setLoading(false); return; }

            if (editing) {
                await schedulesAPI.update(schedule.id, { cron_expression: cron });
            } else {
                await schedulesAPI.create({
                    integration_id: form.integration_id,
                    cron_expression: cron,
                    preset: form.useCustom ? undefined : form.preset,
                });
            }
            onSave();
        } catch (err) {
            setError(err.response?.data?.error || 'Erro ao salvar');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={submit} className="space-y-4">
            {integration ? (
                <div className="p-3 bg-brand-600/10 border border-brand-600/20 rounded-lg text-sm text-brand-300">
                    Integração: <strong>{integration.name}</strong>
                </div>
            ) : (
                <div>
                    <label className="label">Integração *</label>
                    <select className="select" value={form.integration_id}
                        onChange={e => setForm(f => ({ ...f, integration_id: e.target.value }))} required>
                        <option value="">Selecione uma integração</option>
                        {integrations.filter(i => i.status === 'active').map(i => (
                            <option key={i.id} value={i.id}>{i.name}</option>
                        ))}
                    </select>
                </div>
            )}
            <div>
                <label className="label">Frequência</label>
                {!form.useCustom ? (
                    <select className="select" value={form.preset}
                        onChange={e => setForm(f => ({ ...f, preset: e.target.value }))}>
                        {Object.entries(PRESET_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                ) : (
                    <input className="input font-mono text-xs" value={form.cron_expression}
                        onChange={e => setForm(f => ({ ...f, cron_expression: e.target.value }))}
                        placeholder="*/30 * * * *" />
                )}
                {!form.useCustom && (
                    <p className="text-xs text-[#8892a4] mt-1 font-mono">
                        cron: <span className="text-brand-400">{PRESET_CRON[form.preset]}</span>
                    </p>
                )}
                <button type="button"
                    onClick={() => setForm(f => ({ ...f, useCustom: !f.useCustom }))}
                    className="text-xs text-brand-400 hover:text-brand-300 mt-1">
                    {form.useCustom ? 'Usar opção predefinida' : 'Usar expressão cron personalizada'}
                </button>
            </div>
            {error && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}
            <div className="flex gap-3 justify-end">
                <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={loading} className="btn-primary">
                    {loading ? <Spinner size={4} /> : null}
                    {editing ? 'Salvar Alterações' : 'Criar Agendamento'}
                </button>
            </div>
        </form>
    );
}


// ── DBForm: Novo banco para esta empresa ─────────────────────────────────────
function DBForm({ companyId, onSave, onClose }) {
    const [form, setForm] = useState({
        company_id: companyId, name: '', type: 'mssql',
        host: '', port: 1433, database_name: '', username: '', password: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

    const submit = async (e) => {
        e.preventDefault(); setLoading(true); setError('');
        try {
            await integrationsAPI.createTarget(form);
            onSave();
        } catch (err) { setError(err.response?.data?.error || 'Erro ao salvar'); }
        finally { setLoading(false); }
    };

    return (
        <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="label">Nome do Banco *</label>
                    <input className="input" value={form.name} onChange={f('name')} placeholder="SQL Server Produção" required />
                </div>
                <div>
                    <label className="label">Tipo</label>
                    <select className="select" value={form.type} onChange={f('type')}>
                        <option value="mssql">SQL Server (MSSQL)</option>
                    </select>
                </div>
                <div>
                    <label className="label">Host / IP *</label>
                    <input className="input font-mono text-xs" value={form.host} onChange={f('host')}
                        placeholder="192.168.1.100" required />
                </div>
                <div>
                    <label className="label">Porta</label>
                    <input className="input" type="number" value={form.port} onChange={f('port')} />
                </div>
                <div>
                    <label className="label">Database *</label>
                    <input className="input font-mono text-xs" value={form.database_name} onChange={f('database_name')} required />
                </div>
                <div>
                    <label className="label">Usuário *</label>
                    <input className="input" value={form.username} onChange={f('username')} required />
                </div>
                <div className="col-span-2">
                    <label className="label">Senha *</label>
                    <input className="input" type="password" value={form.password} onChange={f('password')} required />
                </div>
            </div>
            {error && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}
            <div className="flex gap-3 justify-end">
                <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={loading} className="btn-primary">
                    {loading ? <Spinner size={4} /> : null} Salvar Conexão
                </button>
            </div>
        </form>
    );
}

// ── DBEditForm: Editar banco existente ────────────────────────────────────────
function DBEditForm({ db, onSave, onClose }) {
    const [form, setForm] = useState({
        name: db.name || '', host: db.host || '', port: db.port || 1433,
        database_name: db.database_name || '', username: db.username || '', password: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

    const submit = async (e) => {
        e.preventDefault(); setLoading(true); setError('');
        try {
            await integrationsAPI.updateTarget(db.id, form);
            onSave();
        } catch (err) { setError(err.response?.data?.error || 'Erro ao salvar'); }
        finally { setLoading(false); }
    };

    return (
        <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                    <label className="label">Nome do Banco *</label>
                    <input className="input" value={form.name} onChange={f('name')} required />
                </div>
                <div>
                    <label className="label">Host / IP *</label>
                    <input className="input font-mono text-xs" value={form.host} onChange={f('host')} required />
                </div>
                <div>
                    <label className="label">Porta</label>
                    <input className="input" type="number" value={form.port} onChange={f('port')} />
                </div>
                <div>
                    <label className="label">Database *</label>
                    <input className="input font-mono text-xs" value={form.database_name} onChange={f('database_name')} required />
                </div>
                <div>
                    <label className="label">Usuário *</label>
                    <input className="input" value={form.username} onChange={f('username')} required />
                </div>
                <div className="col-span-2">
                    <label className="label">Nova Senha</label>
                    <input className="input" type="password" value={form.password} onChange={f('password')}
                        placeholder="Deixe em branco para manter a senha atual" />
                </div>
            </div>
            {error && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}
            <div className="flex gap-3 justify-end">
                <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={loading} className="btn-primary">
                    {loading ? <Spinner size={4} /> : null} Salvar Alterações
                </button>
            </div>
        </form>
    );
}

// ── DBLinkForm: Vincular banco de outra empresa ───────────────────────────────
function DBLinkForm({ companyId, companyName, onSave, onClose }) {
    const [allTargets, setAllTargets] = useState([]);
    const [form, setForm] = useState({ target_id: '', name: '' });
    const [loading, setLoading] = useState(false);
    const [loadingTargets, setLoadingTargets] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        integrationsAPI.targets()
            .then(r => setAllTargets(r.data.filter(t => t.company_id !== companyId)))
            .finally(() => setLoadingTargets(false));
    }, []);

    const selected = allTargets.find(t => t.id === form.target_id);

    const handleTargetChange = (e) => {
        const t = allTargets.find(x => x.id === e.target.value);
        setForm(p => ({ ...p, target_id: e.target.value, name: t ? `${t.name} (vinculado)` : '' }));
    };

    const submit = async (e) => {
        e.preventDefault();
        if (!form.target_id || !form.name) { setError('Preencha todos os campos.'); return; }
        setLoading(true); setError('');
        try {
            await integrationsAPI.linkTarget({ company_id: companyId, target_id: form.target_id, name: form.name });
            onSave();
        } catch (err) { setError(err.response?.data?.error || 'Erro ao vincular'); }
        finally { setLoading(false); }
    };

    return (
        <form onSubmit={submit} className="space-y-4">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-300 flex items-start gap-2">
                <Link2 size={15} className="flex-shrink-0 mt-0.5" />
                <span>Vincula um banco já cadastrado a <strong>{companyName}</strong>. As credenciais são compartilhadas.</span>
            </div>
            <div>
                <label className="label">Banco de dados existente *</label>
                {loadingTargets ? <div className="flex items-center gap-2 text-sm text-[#8892a4]"><Spinner size={4} /> Carregando...</div> : (
                    <select className="select" value={form.target_id} onChange={handleTargetChange} required>
                        <option value="">Selecione um banco</option>
                        {allTargets.map(t => (
                            <option key={t.id} value={t.id}>{t.name} ({t.host}/{t.database_name})</option>
                        ))}
                    </select>
                )}
                {!loadingTargets && allTargets.length === 0 && (
                    <p className="text-xs text-[#8892a4] mt-1">Nenhum banco disponível para vincular.</p>
                )}
            </div>
            {selected && (
                <div className="p-3 bg-[#0f1117] border border-[#1e2535] rounded-lg text-xs space-y-1">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <span className="text-[#8892a4]">Host</span>
                        <span className="font-mono text-white">{selected.host}:{selected.port}</span>
                        <span className="text-[#8892a4]">Database</span>
                        <span className="font-mono text-white">{selected.database_name}</span>
                        <span className="text-[#8892a4]">Usuário</span>
                        <span className="font-mono text-white">{selected.username}</span>
                    </div>
                </div>
            )}
            <div>
                <label className="label">Nome do vínculo *</label>
                <input className="input" value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Ex: SQL Server Produção (vinculado)" required />
            </div>
            {error && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}
            <div className="flex gap-3 justify-end">
                <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={loading || !form.target_id} className="btn-primary">
                    {loading ? <Spinner size={4} /> : <Link2 size={14} />} Vincular Banco
                </button>
            </div>
        </form>
    );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function CompanyDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { canDo } = useAuth();

    const [company, setCompany] = useState(null);
    const [integrations, setIntegrations] = useState([]);
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState({});
    const [tab, setTab] = useState('integrations');
    const [databases, setDatabases] = useState([]);
    const [lastLogs, setLastLogs] = useState({});
    const [dbTestResults, setDbTestResults] = useState({});
    const [dbTesting, setDbTesting] = useState({});

    // Modais
    const [intgModal, setIntgModal] = useState(null); // null | 'create' | { type:'edit', integration }
    const [schedModal, setSchedModal] = useState(null); // null | { integration } | { type:'edit', schedule, integration }
    const [dbModal, setDbModal] = useState(null); // null | 'create' | 'link' | { type:'edit', db }

    const load = async () => {
        try {
            const [compRes, intRes, schRes, dbRes] = await Promise.all([
                companiesAPI.get(id),
                integrationsAPI.list({ company_id: id }),
                schedulesAPI.list(),
                integrationsAPI.targets({ company_id: id }),
            ]);
            setCompany(compRes.data);
            setIntegrations(intRes.data);
            setSchedules(schRes.data.filter(s => s.company_id === id));
            setDatabases(dbRes.data);

            // Busca últimos logs desta empresa e mapeia por integração
            const intList = intRes.data;
            if (intList.length > 0) {
                try {
                    const logsRes = await logsAPI.list({ company_id: id, limit: 500 });
                    const logs = logsRes.data?.logs || logsRes.data?.rows || [];
                    const logsMap = {};
                    intList.forEach(intg => {
                        const intgLogs = logs.filter(l => l.integration_id === intg.id);
                        if (intgLogs.length > 0) {
                            logsMap[intg.id] = intgLogs.sort((a, b) =>
                                new Date(b.started_at) - new Date(a.started_at)
                            )[0];
                        }
                    });
                    setLastLogs(logsMap);
                } catch (e) {
                    console.warn('Could not fetch logs:', e.message);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [id]);

    const handleRun = async (integrationId) => {
        setRunning(r => ({ ...r, [integrationId]: true }));
        try { await executeAPI.run(integrationId); await load(); }
        catch (e) { console.error(e); }
        finally { setRunning(r => ({ ...r, [integrationId]: false })); }
    };

    const handleDeleteIntegration = async (e, intgId, name) => {
        e.stopPropagation();
        if (!confirm(`Remover integração "${name}"?`)) return;
        await integrationsAPI.delete(intgId);
        load();
    };

    const handleToggleSchedule = async (scheduleId) => {
        await schedulesAPI.toggle(scheduleId);
        load();
    };

    const handleDeleteSchedule = async (scheduleId, name) => {
        if (!confirm(`Remover agendamento de "${name}"?`)) return;
        await schedulesAPI.delete(scheduleId);
        load();
    };

    const handleDeleteDb = async (dbId, name) => {
        if (!confirm(`Remover banco "${name}"?`)) return;
        await integrationsAPI.deleteTarget(dbId);
        load();
    };

    const handleTestDb = async (dbId) => {
        const db = databases.find(d => d.id === dbId);
        setDbTesting(p => ({ ...p, [dbId]: true }));
        setDbTestResults(p => ({ ...p, [dbId]: { loading: true, host: db?.host, port: db?.port || 1433 } }));
        try {
            const res = await integrationsAPI.testTarget(dbId);
            setDbTestResults(p => ({ ...p, [dbId]: res.data }));
        } catch (err) {
            setDbTestResults(p => ({
                ...p,
                [dbId]: { success: false, duration_ms: 0, error: err.response?.data?.error || err.message }
            }));
        } finally {
            setDbTesting(p => ({ ...p, [dbId]: false }));
        }
    };

    if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={8} /></div>;
    if (!company) return <div className="card text-center py-12 text-[#8892a4]">Empresa não encontrada.</div>;

    const activeIntegrations = integrations.filter(i => i.status === 'active').length;
    const activeSchedules = schedules.filter(s => s.is_active).length;

    // company no formato que o IntegrationForm espera
    const companiesForForm = [{ id: company.id, trade_name: company.trade_name }];

    return (
        <div className="space-y-5">

            {/* ── Header ──────────────────────────────────────────────────────── */}
            <div>
                <button onClick={() => navigate('/companies')}
                    className="flex items-center gap-1.5 text-sm text-[#8892a4] hover:text-white transition-colors mb-3">
                    <ArrowLeft size={15} /> Voltar para Empresas
                </button>
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-brand-600/15 border border-brand-600/25 flex items-center justify-center flex-shrink-0">
                        <Building2 size={22} className="text-brand-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold text-white">{company.trade_name}</h1>
                            <StatusBadge status={company.status} />
                        </div>
                        <p className="text-sm text-[#8892a4]">{company.legal_name}</p>
                        {company.cnpj && <p className="text-xs text-[#8892a4] font-mono">{company.cnpj}</p>}
                    </div>
                </div>

                {/* Stats rápidos */}
                <div className="grid grid-cols-4 gap-3 mt-4">
                    <div className="p-3 rounded-lg bg-[#0f1117] border border-[#1e2535] text-center">
                        <div className="text-2xl font-bold text-white">{integrations.length}</div>
                        <div className="text-xs text-[#8892a4] mt-0.5">Integrações</div>
                        <div className="text-xs text-emerald-400">{activeIntegrations} ativas</div>
                    </div>
                    <div className="p-3 rounded-lg bg-[#0f1117] border border-[#1e2535] text-center">
                        <div className="text-2xl font-bold text-white">{schedules.length}</div>
                        <div className="text-xs text-[#8892a4] mt-0.5">Agendamentos</div>
                        <div className="text-xs text-emerald-400">{activeSchedules} ativos</div>
                    </div>
                    <div className="p-3 rounded-lg bg-[#0f1117] border border-[#1e2535] text-center">
                        <div className="text-2xl font-bold text-white">{schedules.filter(s => s.is_active).length}</div>
                        <div className="text-xs text-[#8892a4] mt-0.5">Rodando</div>
                        <div className="text-xs text-brand-400">automaticamente</div>
                    </div>
                    <div className="p-3 rounded-lg bg-[#0f1117] border border-[#1e2535] text-center">
                        <div className="text-2xl font-bold text-white">{databases.length}</div>
                        <div className="text-xs text-[#8892a4] mt-0.5">Bancos</div>
                        <div className="text-xs text-brand-400">configurados</div>
                    </div>
                </div>
            </div>

            {/* ── Tabs ────────────────────────────────────────────────────────── */}
            <div className="flex gap-0.5 border-b border-[#1e2535]">
                {[
                    { id: 'integrations', label: 'Integrações', icon: Plug2, count: integrations.length },
                    { id: 'schedules', label: 'Agendamentos', icon: CalendarClock, count: schedules.length },
                    { id: 'databases', label: 'Bancos de Dados', icon: Database, count: databases.length },
                ].map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors -mb-px border-b-2 flex items-center gap-2 ${tab === t.id
                            ? 'text-brand-400 border-brand-500'
                            : 'text-[#8892a4] border-transparent hover:text-white'
                            }`}>
                        <t.icon size={14} /> {t.label}
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-[#1e2535]">{t.count}</span>
                    </button>
                ))}
            </div>

            {/* ── Tab: Integrações ────────────────────────────────────────────── */}
            {tab === 'integrations' && (
                <div className="space-y-3">
                    {/* Botão nova integração */}
                    {canDo('superadmin', 'admin', 'operator') && (
                        <div className="flex justify-end">
                            <button className="btn-primary" onClick={() => setIntgModal('create')}>
                                <Plus size={15} /> Nova Integração
                            </button>
                        </div>
                    )}

                    {integrations.length === 0 ? (
                        <div className="card">
                            <EmptyState icon={Plug2} title="Nenhuma integração"
                                desc="Esta empresa ainda não possui integrações configuradas."
                                action={canDo('superadmin', 'admin', 'operator') && (
                                    <button className="btn-primary" onClick={() => setIntgModal('create')}>
                                        <Plus size={16} /> Nova Integração
                                    </button>
                                )} />
                        </div>
                    ) : (
                        integrations.map(intg => {
                            const sched = schedules.find(s => s.integration_id === intg.id);
                            return (
                                <div key={intg.id} className="card">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${intg.status === 'active'
                                            ? 'bg-emerald-500/10 border border-emerald-500/20'
                                            : 'bg-[#1e2535] border border-[#2d3748]'
                                            }`}>
                                            <Plug2 size={15} className={intg.status === 'active' ? 'text-emerald-400' : 'text-[#8892a4]'} />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-semibold text-white">{intg.name}</span>
                                                <StatusBadge status={intg.status} />
                                                {sched && (
                                                    <span className={`text-xs px-2 py-0.5 rounded-full border font-mono ${sched.is_active
                                                        ? 'bg-brand-600/10 border-brand-600/20 text-brand-400'
                                                        : 'bg-[#1e2535] border-[#2d3748] text-[#8892a4]'
                                                        }`}>
                                                        {sched.cron_expression}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mt-1 text-xs text-[#8892a4] flex-wrap">
                                                {intg.target_table && (
                                                    <span className="font-mono bg-[#1e2535] px-1.5 py-0.5 rounded">{intg.target_table}</span>
                                                )}
                                                {intg.db_target_name && (
                                                    <span className="flex items-center gap-1"><Database size={11} />{intg.db_target_name}</span>
                                                )}
                                            </div>
                                            {lastLogs[intg.id] ? (
                                                <div className="flex items-center gap-2 mt-1.5 text-xs flex-wrap">
                                                    <StatusBadge status={lastLogs[intg.id].status} />
                                                    <span className="text-[#8892a4]">{formatDate(lastLogs[intg.id].started_at)}</span>
                                                    {lastLogs[intg.id].records_inserted > 0 && (
                                                        <span className="text-emerald-400">{lastLogs[intg.id].records_inserted} inseridos</span>
                                                    )}
                                                    {lastLogs[intg.id].records_updated > 0 && (
                                                        <span className="text-brand-400">{lastLogs[intg.id].records_updated} atualizados</span>
                                                    )}
                                                    {lastLogs[intg.id].duration_ms && (
                                                        <span className="text-[#8892a4]">
                                                            {lastLogs[intg.id].duration_ms < 1000
                                                                ? `${lastLogs[intg.id].duration_ms}ms`
                                                                : `${(lastLogs[intg.id].duration_ms / 1000).toFixed(1)}s`}
                                                        </span>
                                                    )}
                                                    {lastLogs[intg.id].status === 'error' && lastLogs[intg.id].error_message && (
                                                        <span className="text-red-400 truncate max-w-[220px]" title={lastLogs[intg.id].error_message}>
                                                            {lastLogs[intg.id].error_message}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="mt-1 text-xs text-[#8892a4]">Nunca executada</div>
                                            )}
                                        </div>

                                        {/* Ações */}
                                        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                                            {/* Executar agora */}
                                            {canDo('superadmin', 'admin', 'operator') && (
                                                <button onClick={() => handleRun(intg.id)} disabled={running[intg.id]}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors text-xs disabled:opacity-50">
                                                    {running[intg.id] ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                                                    {running[intg.id] ? 'Rodando...' : 'Executar'}
                                                </button>
                                            )}

                                            {/* Agendar / ver agendamento */}
                                            {canDo('superadmin', 'admin', 'operator') && !sched && (
                                                <button onClick={() => setSchedModal({ integration: intg })}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-600/10 border border-brand-600/20 text-brand-400 hover:bg-brand-600/20 transition-colors text-xs">
                                                    <Clock size={13} /> Agendar
                                                </button>
                                            )}

                                            {/* Editar integração */}
                                            {canDo('superadmin', 'admin', 'operator') && (
                                                <button onClick={() => setIntgModal({ type: 'edit', integration: intg })}
                                                    className="btn-secondary px-2 py-1.5" title="Editar integração">
                                                    <Pencil size={14} />
                                                </button>
                                            )}

                                            {/* Deletar integração */}
                                            {canDo('superadmin', 'admin') && (
                                                <button onClick={e => handleDeleteIntegration(e, intg.id, intg.name)}
                                                    className="btn-danger px-2 py-1.5" title="Remover integração">
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* ── Tab: Agendamentos ───────────────────────────────────────────── */}
            {tab === 'schedules' && (
                <div className="space-y-3">
                    {canDo('superadmin', 'admin', 'operator') && (
                        <div className="flex justify-end">
                            <button className="btn-primary" onClick={() => setSchedModal({ integrations })}>
                                <Plus size={15} /> Novo Agendamento
                            </button>
                        </div>
                    )}
                    {schedules.length === 0 ? (
                        <div className="card">
                            <EmptyState icon={CalendarClock} title="Nenhum agendamento"
                                desc="As integrações desta empresa ainda não possuem agendamentos."
                                action={canDo('superadmin', 'admin', 'operator') && integrations.length > 0 && (
                                    <button className="btn-primary" onClick={() => setTab('integrations')}>
                                        <Plus size={16} /> Ir para Integrações
                                    </button>
                                )} />
                        </div>
                    ) : (
                        schedules.map(s => {
                            const intg = integrations.find(i => i.id === s.integration_id);
                            return (
                                <div key={s.id} className="card flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${s.is_active
                                        ? 'bg-emerald-500/15 border border-emerald-500/25'
                                        : 'bg-[#1e2535] border border-[#2d3748]'
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
                                        <div className="text-xs text-brand-400 font-mono mt-0.5">{s.cron_expression}</div>
                                        <div className="text-xs text-[#8892a4] mt-0.5">
                                            {s.last_run ? `Última: ${formatDate(s.last_run)}` : 'Nunca executado'}
                                            {s.run_count > 0 && ` · ${s.run_count} execuções`}
                                        </div>
                                    </div>

                                    {s.last_status && <StatusBadge status={s.last_status} />}

                                    {canDo('superadmin', 'admin', 'operator') && (
                                        <div className="flex items-center gap-1">
                                            {/* Editar agendamento */}
                                            <button
                                                onClick={() => setSchedModal({ type: 'edit', schedule: s, integration: intg })}
                                                className="btn-secondary px-2 py-1.5" title="Editar agendamento">
                                                <Pencil size={14} />
                                            </button>

                                            {/* Pausar / Ativar */}
                                            <button onClick={() => handleToggleSchedule(s.id)}
                                                className={`px-2.5 py-1.5 rounded-lg border transition-colors flex items-center gap-1 text-xs ${s.is_active
                                                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20'
                                                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                                                    }`}>
                                                <Power size={13} /> {s.is_active ? 'Pausar' : 'Ativar'}
                                            </button>

                                            {/* Deletar */}
                                            {canDo('superadmin', 'admin') && (
                                                <button onClick={() => handleDeleteSchedule(s.id, s.integration_name)}
                                                    className="btn-danger px-2 py-1.5">
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* ── Tab: Bancos de Dados ────────────────────────────────────────── */}
            {tab === 'databases' && (
                <div className="space-y-3">
                    {canDo('superadmin', 'admin') && (
                        <div className="flex justify-end gap-2">
                            <button className="btn-secondary flex items-center gap-1.5 text-sm px-3 py-2"
                                onClick={() => setDbModal('link')}>
                                <Link2 size={15} /> Vincular Existente
                            </button>
                            <button className="btn-primary" onClick={() => setDbModal('create')}>
                                <Plus size={15} /> Novo Banco
                            </button>
                        </div>
                    )}
                    {databases.length === 0 ? (
                        <div className="card">
                            <EmptyState icon={Database} title="Nenhum banco configurado"
                                desc="Configure um banco de dados SQL Server de destino para esta empresa."
                                action={canDo('superadmin', 'admin') && (
                                    <button className="btn-primary" onClick={() => setDbModal('create')}>
                                        <Plus size={16} /> Novo Banco
                                    </button>
                                )} />
                        </div>
                    ) : (
                        databases.map(db => (
                            <div key={db.id} className="card space-y-0">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${db.is_linked
                                            ? 'bg-amber-500/10 border border-amber-500/20'
                                            : 'bg-[#1e2535]'
                                        }`}>
                                        {db.is_linked
                                            ? <Link2 size={18} className="text-amber-400" />
                                            : <Server size={18} className="text-brand-400" />
                                        }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold text-white">{db.name}</span>
                                            <span className="badge-info text-xs">{db.type?.toUpperCase()}</span>
                                            {db.is_linked && (
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center gap-1">
                                                    <Link2 size={10} /> Vinculado
                                                </span>
                                            )}
                                            {dbTestResults[db.id] && !dbTestResults[db.id].loading && (
                                                dbTestResults[db.id].success
                                                    ? <span className="flex items-center gap-1 text-xs text-emerald-400"><Wifi size={11} />Conectado</span>
                                                    : <span className="flex items-center gap-1 text-xs text-red-400"><WifiOff size={11} />Falhou</span>
                                            )}
                                        </div>
                                        <div className="text-xs font-mono text-[#8892a4] mt-0.5">
                                            {db.host}:{db.port} / {db.database_name} · {db.username}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        {/* Testar */}
                                        <button
                                            onClick={() => handleTestDb(db.id)}
                                            disabled={!!dbTesting[db.id]}
                                            className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5">
                                            {dbTesting[db.id] ? <Spinner size={3} /> : <RefreshCw size={12} />}
                                            Testar
                                        </button>
                                        {/* Editar */}
                                        {canDo('superadmin', 'admin') && !db.is_linked && (
                                            <button onClick={() => setDbModal({ type: 'edit', db })}
                                                className="btn-secondary px-2 py-1.5" title="Editar banco">
                                                <Pencil size={14} />
                                            </button>
                                        )}
                                        {/* Deletar */}
                                        {canDo('superadmin', 'admin') && (
                                            <button onClick={() => handleDeleteDb(db.id, db.name)}
                                                className="btn-danger px-2 py-1.5">
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {/* Resultado do teste */}
                                {dbTestResults[db.id] && !dbTestResults[db.id].loading && (
                                    <div className={`mt-3 rounded-lg border p-3 text-xs ${dbTestResults[db.id].success
                                            ? 'border-emerald-500/30 bg-emerald-500/10'
                                            : 'border-red-500/30 bg-red-500/10'
                                        }`}>
                                        {dbTestResults[db.id].success ? (
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                                <span className="text-[#8892a4]">Servidor</span>
                                                <span className="font-mono text-emerald-300">{dbTestResults[db.id].server_version}</span>
                                                <span className="text-[#8892a4]">Database</span>
                                                <span className="font-mono text-emerald-300">{dbTestResults[db.id].current_database}</span>
                                                <span className="text-[#8892a4]">Tempo</span>
                                                <span className="font-mono text-emerald-300">{dbTestResults[db.id].duration_ms}ms</span>
                                            </div>
                                        ) : (
                                            <p className="text-red-300">{dbTestResults[db.id].error}</p>
                                        )}
                                    </div>
                                )}
                                {dbTestResults[db.id]?.loading && (
                                    <div className="mt-3 flex items-center gap-2 text-xs text-[#8892a4] bg-[#1e2535] rounded-lg px-3 py-2">
                                        <Spinner size={3} /> Testando conexão...
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* ── Modal: Banco de Dados ────────────────────────────────────────── */}
            <Modal
                open={!!dbModal}
                onClose={() => setDbModal(null)}
                title={
                    dbModal === 'create' ? 'Novo Banco de Dados' :
                        dbModal === 'link' ? 'Vincular Banco Existente' :
                            'Editar Banco de Dados'
                }
            >
                {dbModal === 'create' && (
                    <DBForm
                        companyId={id}
                        onSave={() => { setDbModal(null); load(); }}
                        onClose={() => setDbModal(null)}
                    />
                )}
                {dbModal === 'link' && (
                    <DBLinkForm
                        companyId={id}
                        companyName={company.trade_name}
                        onSave={() => { setDbModal(null); load(); }}
                        onClose={() => setDbModal(null)}
                    />
                )}
                {dbModal?.type === 'edit' && (
                    <DBEditForm
                        db={dbModal.db}
                        onSave={() => { setDbModal(null); load(); }}
                        onClose={() => setDbModal(null)}
                    />
                )}
            </Modal>

            {/* ── Modal: Criar / Editar Integração ────────────────────────────── */}
            <Modal
                open={!!intgModal}
                onClose={() => setIntgModal(null)}
                title={intgModal?.type === 'edit' ? 'Editar Integração' : 'Nova Integração'}
                size="xl"
            >
                {!!intgModal && (
                    <IntegrationForm
                        integration={intgModal?.integration
                            ? { ...intgModal.integration, company_id: id }
                            : { company_id: id }
                        }
                        companies={companiesForForm}
                        onSave={() => { setIntgModal(null); load(); }}
                        onClose={() => setIntgModal(null)}
                    />
                )}
            </Modal>

            {/* ── Modal: Criar / Editar Agendamento ───────────────────────────── */}
            <Modal
                open={!!schedModal}
                onClose={() => setSchedModal(null)}
                title={schedModal?.type === 'edit' ? 'Editar Agendamento' : 'Novo Agendamento'}
            >
                {!!schedModal && (
                    <ScheduleForm
                        integration={schedModal.integration}
                        schedule={schedModal.type === 'edit' ? schedModal.schedule : null}
                        integrations={schedModal.integrations || integrations}
                        onSave={() => { setSchedModal(null); load(); }}
                        onClose={() => setSchedModal(null)}
                    />
                )}
            </Modal>
        </div>
    );
}

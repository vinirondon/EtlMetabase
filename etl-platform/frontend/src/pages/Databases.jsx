import { useState, useEffect } from 'react';
import { integrationsAPI, companiesAPI } from '../services/api';
import { Plus, Database, Trash2, Server, Wifi, WifiOff, Clock, CheckCircle, XCircle, RefreshCw, Link2 } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import { useAuth } from '../contexts/AuthContext';

function TestResult({ result }) {
  if (!result) return null;
  if (result.loading) {
    return (
      <div className="mt-3 flex items-center gap-2 text-sm text-[#8892a4] bg-[#1e2535] rounded-lg px-3 py-2.5">
        <Spinner size={4} />
        <span>Testando conexão com {result.host}:{result.port}...</span>
      </div>
    );
  }
  if (result.success) {
    return (
      <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle size={15} className="text-emerald-400 flex-shrink-0" />
          <span className="font-medium text-emerald-300">Conexão bem-sucedida</span>
          <span className="ml-auto text-xs text-emerald-400/70 flex items-center gap-1">
            <Clock size={11} />{result.duration_ms}ms
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-2">
          <div className="text-[#8892a4]">Servidor</div>
          <div className="text-emerald-300 font-mono">{result.server_version}</div>
          <div className="text-[#8892a4]">Banco ativo</div>
          <div className="text-emerald-300 font-mono">{result.current_database}</div>
          <div className="text-[#8892a4]">Usuário conectado</div>
          <div className="text-emerald-300 font-mono">{result.connected_user}</div>
          <div className="text-[#8892a4]">Tabelas no banco</div>
          <div className="text-emerald-300 font-mono">{result.table_count} tabelas</div>
          <div className="text-[#8892a4]">Hora do servidor</div>
          <div className="text-emerald-300 font-mono text-[10px]">
            {result.server_time ? new Date(result.server_time).toLocaleString('pt-BR') : '—'}
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-emerald-500/20 text-[10px] text-emerald-400/60 font-mono truncate">
          {result.full_version}
        </div>
      </div>
    );
  }
  return (
    <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm">
      <div className="flex items-center gap-2 mb-2">
        <XCircle size={15} className="text-red-400 flex-shrink-0" />
        <span className="font-medium text-red-300">Falha na conexão</span>
        <span className="ml-auto text-xs text-red-400/70 flex items-center gap-1">
          <Clock size={11} />{result.duration_ms}ms
        </span>
      </div>
      <p className="text-xs text-red-300 leading-relaxed">{result.error}</p>
      {result.error_code && result.error_code !== 'UNKNOWN' && (
        <p className="mt-1 text-[10px] font-mono text-red-400/60">código: {result.error_code}</p>
      )}
    </div>
  );
}

function DBCard({ target, companyName, onDelete, onTest, testResult, testing, canAdmin }) {
  return (
    <div className="card space-y-0">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          target.is_linked
            ? 'bg-amber-500/10 border border-amber-500/20'
            : 'bg-[#1e2535]'
        }`}>
          {target.is_linked
            ? <Link2 size={18} className="text-amber-400" />
            : <Server size={18} className="text-brand-400" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white">{target.name}</span>
            <span className="badge-info text-xs">{target.type?.toUpperCase()}</span>
            {target.is_linked && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center gap-1">
                <Link2 size={10} /> Vinculado
              </span>
            )}
            {testResult && !testResult.loading && (
              testResult.success
                ? <span className="flex items-center gap-1 text-xs text-emerald-400"><Wifi size={11} />Conectado</span>
                : <span className="flex items-center gap-1 text-xs text-red-400"><WifiOff size={11} />Falhou</span>
            )}
          </div>
          <div className="text-sm text-[#8892a4]">
            {companyName}
            {target.is_linked && target.linked_from_company && (
              <span className="text-amber-400/70"> · Banco de {target.linked_from_company}</span>
            )}
          </div>
          <div className="text-xs font-mono text-[#8892a4] mt-0.5">
            {target.host}:{target.port} / {target.database_name} · {target.username}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5"
            onClick={() => onTest(target.id)}
            disabled={testing}
            title="Testar conexão"
          >
            {testing ? <Spinner size={3} /> : <RefreshCw size={12} />}
            Testar
          </button>
          {canAdmin && (
            <button className="btn-danger px-2 py-1.5" onClick={() => onDelete(target.id, target.name)}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      <TestResult result={testResult} />
    </div>
  );
}

// ── Formulário: Nova Conexão ──────────────────────────────────────────────────
function DBForm({ companies, onSave, onClose }) {
  const [form, setForm] = useState({
    company_id: '', name: '', type: 'mssql', host: '', port: 1433,
    database_name: '', username: '', password: ''
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
      <div className="p-3 bg-brand-600/10 border border-brand-600/20 rounded-lg text-sm text-brand-300">
        A senha é criptografada antes de ser armazenada. Configure múltiplos bancos por empresa se necessário.
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Empresa *</label>
          <select className="select" value={form.company_id} onChange={f('company_id')} required>
            <option value="">Selecione uma empresa</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.trade_name}</option>)}
          </select>
        </div>
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
            placeholder="192.168.1.100 ou servidor.domain.com" required />
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

// ── Formulário: Vincular Banco Existente ──────────────────────────────────────
function DBLinkForm({ companies, targets, onSave, onClose }) {
  const [form, setForm] = useState({ company_id: '', target_id: '', name: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Bancos disponíveis: todos exceto os já vinculados à empresa selecionada
  const available = targets.filter(t => t.company_id !== form.company_id);

  const selectedTarget = targets.find(t => t.id === form.target_id);

  const handleTargetChange = (e) => {
    const t = targets.find(x => x.id === e.target.value);
    setForm(p => ({
      ...p,
      target_id: e.target.value,
      // Sugere um nome baseado no banco selecionado
      name: t ? `${t.name} (vinculado)` : '',
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.company_id || !form.target_id || !form.name) {
      setError('Preencha todos os campos.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await integrationsAPI.linkTarget({
        company_id: form.company_id,
        target_id:  form.target_id,
        name:       form.name,
      });
      onSave();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao vincular banco');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-300 flex items-start gap-2">
        <Link2 size={15} className="flex-shrink-0 mt-0.5" />
        <span>Vincula um banco já cadastrado a outra empresa. As credenciais são compartilhadas — não é criada uma nova conexão.</span>
      </div>

      <div>
        <label className="label">Empresa que receberá o vínculo *</label>
        <select className="select" value={form.company_id}
          onChange={e => setForm(p => ({ ...p, company_id: e.target.value, target_id: '', name: '' }))}
          required>
          <option value="">Selecione a empresa</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.trade_name}</option>)}
        </select>
      </div>

      <div>
        <label className="label">Banco de dados existente *</label>
        <select className="select" value={form.target_id} onChange={handleTargetChange}
          disabled={!form.company_id} required>
          <option value="">
            {!form.company_id ? 'Selecione a empresa primeiro' : 'Selecione um banco'}
          </option>
          {available.map(t => {
            const ownerCompany = companies.find(c => c.id === t.company_id);
            return (
              <option key={t.id} value={t.id}>
                {t.name} — {ownerCompany?.trade_name || '?'} ({t.host}/{t.database_name})
              </option>
            );
          })}
        </select>
        {form.company_id && available.length === 0 && (
          <p className="text-xs text-[#8892a4] mt-1">Nenhum banco disponível para vincular.</p>
        )}
      </div>

      {/* Preview do banco selecionado */}
      {selectedTarget && (
        <div className="p-3 bg-[#0f1117] border border-[#1e2535] rounded-lg text-xs space-y-1">
          <p className="text-[#8892a4] font-medium mb-2">Detalhes do banco selecionado:</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-[#8892a4]">Host</span>
            <span className="font-mono text-white">{selectedTarget.host}:{selectedTarget.port}</span>
            <span className="text-[#8892a4]">Database</span>
            <span className="font-mono text-white">{selectedTarget.database_name}</span>
            <span className="text-[#8892a4]">Usuário</span>
            <span className="font-mono text-white">{selectedTarget.username}</span>
          </div>
        </div>
      )}

      <div>
        <label className="label">Nome do vínculo *</label>
        <input className="input" value={form.name}
          onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          placeholder="Ex: SQL Server Produção (Empresa X)" required />
        <p className="text-xs text-[#8892a4] mt-1">Como este banco aparecerá nas integrações desta empresa.</p>
      </div>

      {error && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}
      <div className="flex gap-3 justify-end">
        <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
        <button type="submit" disabled={loading || !form.company_id || !form.target_id} className="btn-primary">
          {loading ? <Spinner size={4} /> : <Link2 size={14} />}
          Vincular Banco
        </button>
      </div>
    </form>
  );
}

// ── Modal com abas Nova Conexão / Vincular ────────────────────────────────────
function DBModal({ companies, targets, onSave, onClose }) {
  const [tab, setTab] = useState('new');

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-0.5 mb-5 border-b border-[#1e2535]">
        <button
          type="button"
          onClick={() => setTab('new')}
          className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors -mb-px border-b-2 flex items-center gap-2 ${
            tab === 'new'
              ? 'text-brand-400 border-brand-500'
              : 'text-[#8892a4] border-transparent hover:text-white'
          }`}
        >
          <Plus size={14} /> Nova Conexão
        </button>
        <button
          type="button"
          onClick={() => setTab('link')}
          className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors -mb-px border-b-2 flex items-center gap-2 ${
            tab === 'link'
              ? 'text-amber-400 border-amber-500'
              : 'text-[#8892a4] border-transparent hover:text-white'
          }`}
        >
          <Link2 size={14} /> Vincular Existente
        </button>
      </div>

      {tab === 'new' && (
        <DBForm companies={companies} onSave={onSave} onClose={onClose} />
      )}
      {tab === 'link' && (
        <DBLinkForm companies={companies} targets={targets} onSave={onSave} onClose={onClose} />
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Databases() {
  const [targets, setTargets] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [testResults, setTestResults] = useState({});
  const [testing, setTesting] = useState({});
  const { canDo } = useAuth();

  const load = async () => {
    const [t, c] = await Promise.all([integrationsAPI.targets(), companiesAPI.list()]);
    setTargets(t.data); setCompanies(c.data); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleDelete = async (id, name) => {
    if (!confirm(`Remover banco "${name}"?`)) return;
    await integrationsAPI.deleteTarget(id);
    setTestResults(prev => { const n = { ...prev }; delete n[id]; return n; });
    load();
  };

  const handleTest = async (id) => {
    const target = targets.find(t => t.id === id);
    setTesting(prev => ({ ...prev, [id]: true }));
    setTestResults(prev => ({ ...prev, [id]: { loading: true, host: target?.host, port: target?.port || 1433 } }));
    try {
      const res = await integrationsAPI.testTarget(id);
      setTestResults(prev => ({ ...prev, [id]: res.data }));
    } catch (err) {
      setTestResults(prev => ({
        ...prev,
        [id]: {
          success: false, duration_ms: 0,
          error: err.response?.data?.error || err.message || 'Erro desconhecido ao testar conexão.',
          error_code: 'REQUEST_FAILED'
        }
      }));
    } finally {
      setTesting(prev => ({ ...prev, [id]: false }));
    }
  };

  const companyName = (id) => companies.find(c => c.id === id)?.trade_name || '—';

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={8} /></div>;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bancos de Dados"
        subtitle={`${targets.length} conexão(ões) configurada(s) — clique em Testar para validar a conectividade`}
        action={canDo('superadmin','admin') && (
          <button className="btn-primary" onClick={() => setModal(true)}>
            <Plus size={16} />Nova Conexão
          </button>
        )}
      />
      {targets.length === 0 ? (
        <div className="card">
          <EmptyState icon={Database} title="Nenhuma conexão configurada"
            desc="Configure um banco de dados SQL Server de destino para gravar os dados das integrações."
            action={canDo('superadmin','admin') && (
              <button className="btn-primary" onClick={() => setModal(true)}>
                <Plus size={16} />Nova Conexão
              </button>
            )} />
        </div>
      ) : (
        <div className="grid gap-3">
          {targets.map(t => (
            <DBCard key={t.id} target={t} companyName={companyName(t.company_id)}
              onDelete={handleDelete} onTest={handleTest}
              testResult={testResults[t.id]} testing={!!testing[t.id]}
              canAdmin={canDo('superadmin','admin')} />
          ))}
        </div>
      )}
      <Modal open={modal} onClose={() => setModal(false)} title="Banco de Dados">
        <DBModal
          companies={companies}
          targets={targets}
          onSave={() => { setModal(false); load(); }}
          onClose={() => setModal(false)}
        />
      </Modal>
    </div>
  );
}

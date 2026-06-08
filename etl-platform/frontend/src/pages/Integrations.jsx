import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { integrationsAPI, companiesAPI, executeAPI } from '../services/api';
import { Plus, Plug2, Play, Pencil, Trash2, Building2, Loader2, CheckCircle, XCircle, Globe, FileSpreadsheet, FileText } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import { formatDate } from '../utils/helpers';
import { useAuth } from '../contexts/AuthContext';
import IntegrationForm from '../components/forms/IntegrationForm';

// Ícone por tipo de fonte
function SourceIcon({ sourceType }) {
  if (sourceType === 'excel') return <FileSpreadsheet size={15} className="text-emerald-400" />;
  if (sourceType === 'csv')   return <FileText size={15} className="text-amber-400" />;
  if (sourceType === 'sheets') return <Globe size={15} className="text-blue-400" />;
  return <Globe size={15} className="text-brand-400" />;
}

export default function Integrations() {
  const [integrations, setIntegrations] = useState([]);
  const [companies, setCompanies]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [filterCompany, setFilterCompany] = useState('');
  const [filterStatus, setFilterStatus]   = useState('');
  const [modal, setModal]               = useState(null);
  const [running, setRunning]           = useState({});
  const [runResult, setRunResult]       = useState(null);
  const { canDo } = useAuth();
  const navigate  = useNavigate();

  const load = async () => {
    const [i, c] = await Promise.all([
      integrationsAPI.list({ company_id: filterCompany || undefined, status: filterStatus || undefined }),
      companiesAPI.list()
    ]);
    setIntegrations(i.data);
    setCompanies(c.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterCompany, filterStatus]);

  const handleRun = async (id, name) => {
    setRunning(prev => ({ ...prev, [id]: true }));
    try {
      const res = await executeAPI.run(id);
      setRunResult({ name, ...res.data });
    } catch (err) {
      setRunResult({ name, error: err.response?.data?.error || 'Erro desconhecido', status: 'error' });
    } finally {
      setRunning(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm('Remover integração "' + name + '"?')) return;
    await integrationsAPI.delete(id);
    load();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={8} /></div>;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Integrações"
        subtitle={integrations.length + ' integração(ões) configurada(s)'}
        action={canDo('superadmin','admin','operator') && (
          <button className="btn-primary" onClick={() => setModal('create')}>
            <Plus size={16} />Nova
          </button>
        )}
      />

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <select className="select flex-1 min-w-0" style={{ maxWidth: 200 }}
          value={filterCompany} onChange={e => setFilterCompany(e.target.value)}>
          <option value="">Todas empresas</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.trade_name}</option>)}
        </select>
        <select className="select w-36"
          value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Todos status</option>
          <option value="active">Ativo</option>
          <option value="inactive">Inativo</option>
        </select>
      </div>

      {integrations.length === 0 ? (
        <div className="card">
          <EmptyState icon={Plug2} title="Nenhuma integração"
            desc="Crie uma nova integração para conectar APIs externas."
            action={canDo('superadmin','admin','operator') && (
              <button className="btn-primary" onClick={() => setModal('create')}>
                <Plus size={16} />Nova Integração
              </button>
            )} />
        </div>
      ) : (
        <div className="grid gap-2">
          {integrations.map(i => (
            <div key={i.id} className="card hover:border-[#2d3748] transition-colors p-3">
              <div className="flex items-center gap-3">

                {/* Ícone */}
                <div className="w-8 h-8 rounded-lg bg-[#1e2535] flex items-center justify-center flex-shrink-0">
                  <SourceIcon sourceType={i.source_type} />
                </div>

                {/* Info — clicável */}
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate('/integrations/' + i.id)}>
                  {/* Linha 1: nome + badges */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-white text-sm truncate max-w-[160px] sm:max-w-none">{i.name}</span>
                    <StatusBadge status={i.status} />
                    {i.schedule_active && <span className="badge-info text-xs">Agendado</span>}
                    {i.source_type && i.source_type !== 'api' && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-[#1e2535] text-[#8892a4] border border-[#2d3748]">
                        {i.source_type.toUpperCase()}
                      </span>
                    )}
                    {i.source_type === 'api' && (
                      <span className="badge-neutral font-mono text-xs hidden sm:inline">{i.method}</span>
                    )}
                  </div>

                  {/* Linha 2: empresa */}
                  <div className="flex items-center gap-1 text-xs text-[#8892a4] mt-0.5">
                    <Building2 size={11} className="flex-shrink-0" />
                    <span className="truncate">{i.company_name}</span>
                  </div>

                  {/* Linha 3: URL ou info da fonte */}
                  {i.source_type === 'api' && i.base_url && (
                    <div className="text-xs text-[#8892a4] font-mono truncate mt-0.5 hidden sm:block">
                      {i.base_url}{i.endpoint}
                    </div>
                  )}
                </div>

                {/* Última execução — só em telas maiores */}
                <div className="text-right text-xs text-[#8892a4] hidden xl:block flex-shrink-0 w-32">
                  {i.last_run
                    ? <div className="truncate">Última: {formatDate(i.last_run)}</div>
                    : <div>Nunca executado</div>}
                  {i.schedule_last_status && (
                    <div className="mt-0.5"><StatusBadge status={i.schedule_last_status} /></div>
                  )}
                </div>

                {/* Ações */}
                {canDo('superadmin','admin','operator') && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Executar só para API e Sheets (CSV/Excel usam upload) */}
                    {(!i.source_type || i.source_type === 'api' || i.source_type === 'sheets') && (
                      <button className="btn-primary px-2 py-1.5" title="Executar agora"
                        disabled={running[i.id]} onClick={() => handleRun(i.id, i.name)}>
                        {running[i.id]
                          ? <Loader2 size={13} className="animate-spin" />
                          : <Play size={13} />}
                      </button>
                    )}
                    <button className="btn-secondary px-2 py-1.5"
                      onClick={() => setModal({ type: 'edit', integration: i })}>
                      <Pencil size={13} />
                    </button>
                    {canDo('superadmin','admin') && (
                      <button className="btn-danger px-2 py-1.5"
                        onClick={() => handleDelete(i.id, i.name)}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal criar */}
      <Modal open={modal === 'create'} onClose={() => setModal(null)} title="Nova Integração" size="xl">
        <IntegrationForm companies={companies}
          onSave={() => { setModal(null); load(); }} onClose={() => setModal(null)} />
      </Modal>

      {/* Modal editar */}
      <Modal open={modal?.type === 'edit'} onClose={() => setModal(null)} title="Editar Integração" size="xl">
        <IntegrationForm companies={companies} integration={modal?.integration}
          onSave={() => { setModal(null); load(); }} onClose={() => setModal(null)} />
      </Modal>

      {/* Modal resultado execução */}
      <Modal open={!!runResult} onClose={() => setRunResult(null)} title="Resultado da Execução" size="sm">
        {runResult && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {runResult.status === 'success'
                ? <CheckCircle className="text-emerald-400 flex-shrink-0" size={20} />
                : <XCircle className="text-red-400 flex-shrink-0" size={20} />}
              <div className="min-w-0">
                <div className="font-medium text-white truncate">{runResult.name}</div>
                <StatusBadge status={runResult.status} />
              </div>
            </div>
            {runResult.status === 'success' ? (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="card p-3">
                  <div className="text-xl font-bold text-emerald-400">{runResult.recordsFetched || 0}</div>
                  <div className="text-xs text-[#8892a4]">Buscados</div>
                </div>
                <div className="card p-3">
                  <div className="text-xl font-bold text-brand-400">{runResult.recordsInserted || 0}</div>
                  <div className="text-xs text-[#8892a4]">Inseridos</div>
                </div>
                <div className="card p-3">
                  <div className="text-xl font-bold text-amber-400">{runResult.recordsUpdated || 0}</div>
                  <div className="text-xs text-[#8892a4]">Atualizados</div>
                </div>
              </div>
            ) : (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
                {runResult.errorMessage || runResult.error}
              </div>
            )}
            <button className="btn-primary w-full justify-center" onClick={() => setRunResult(null)}>
              Fechar
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

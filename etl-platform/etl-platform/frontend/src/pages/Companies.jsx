import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { companiesAPI } from '../services/api';
import { Plus, Building2, Pencil, Trash2, Plug2, ChevronRight } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import { formatDate } from '../utils/helpers';
import { useAuth } from '../contexts/AuthContext';

function CompanyForm({ company, onSave, onClose }) {
  const [form, setForm] = useState(company || { trade_name:'', legal_name:'', cnpj:'', email:'', phone:'', notes:'', status:'active' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      if (company?.id) await companiesAPI.update(company.id, form);
      else await companiesAPI.create(form);
      onSave();
    } catch (err) { setError(err.response?.data?.error || 'Erro ao salvar'); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Nome Fantasia *</label>
          <input className="input" value={form.trade_name} onChange={f('trade_name')} required />
        </div>
        <div className="col-span-2">
          <label className="label">Razão Social *</label>
          <input className="input" value={form.legal_name} onChange={f('legal_name')} required />
        </div>
        <div>
          <label className="label">CNPJ</label>
          <input className="input" value={form.cnpj} onChange={f('cnpj')} placeholder="00.000.000/0000-00" />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="select" value={form.status} onChange={f('status')}>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </select>
        </div>
        <div>
          <label className="label">E-mail</label>
          <input className="input" type="email" value={form.email} onChange={f('email')} />
        </div>
        <div>
          <label className="label">Telefone</label>
          <input className="input" value={form.phone} onChange={f('phone')} />
        </div>
        <div className="col-span-2">
          <label className="label">Observações</label>
          <textarea className="input min-h-[80px]" value={form.notes} onChange={f('notes')} />
        </div>
      </div>
      {error && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? <Spinner size={4} /> : null}
          {company ? 'Salvar Alterações' : 'Criar Empresa'}
        </button>
      </div>
    </form>
  );
}

export default function Companies() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const { canDo } = useAuth();
  const navigate = useNavigate();

  const load = () => companiesAPI.list().then(r => setCompanies(r.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const handleDelete = async (e, id, name) => {
    e.stopPropagation(); // evita navegar ao deletar
    if (!confirm(`Remover empresa "${name}"? Esta ação removerá todas as integrações vinculadas.`)) return;
    await companiesAPI.delete(id);
    load();
  };

  const handleEdit = (e, company) => {
    e.stopPropagation(); // evita navegar ao editar
    setModal({ type: 'edit', company });
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={8} /></div>;

  return (
    <div className="space-y-4">
      <PageHeader title="Empresas" subtitle={`${companies.length} empresa(s) cadastrada(s)`}
        action={canDo('superadmin','admin') && (
          <button className="btn-primary" onClick={() => setModal('create')}><Plus size={16} />Nova Empresa</button>
        )} />

      {companies.length === 0 ? (
        <div className="card">
          <EmptyState icon={Building2} title="Nenhuma empresa"
            desc="Cadastre a primeira empresa cliente para começar."
            action={canDo('superadmin','admin') && (
              <button className="btn-primary" onClick={() => setModal('create')}><Plus size={16} />Nova Empresa</button>
            )} />
        </div>
      ) : (
        <div className="grid gap-3">
          {companies.map(c => (
            <div
              key={c.id}
              onClick={() => navigate(`/companies/${c.id}`)}
              className="card flex items-center gap-4 hover:border-brand-500/40 hover:bg-brand-600/5 transition-all cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-brand-600/15 border border-brand-600/25 flex items-center justify-center flex-shrink-0">
                <Building2 size={18} className="text-brand-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{c.trade_name}</span>
                  <StatusBadge status={c.status} />
                </div>
                <div className="text-sm text-[#8892a4]">{c.legal_name}</div>
                {c.cnpj && <div className="text-xs text-[#8892a4] font-mono">{c.cnpj}</div>}
              </div>
              <div className="flex items-center gap-4 text-sm text-[#8892a4]">
                <div className="flex items-center gap-1.5">
                  <Plug2 size={13} />{c.integration_count || 0} integr.
                </div>
                <div className="hidden lg:block text-xs">{formatDate(c.created_at)}</div>
              </div>
              <div className="flex items-center gap-1">
                {canDo('superadmin','admin') && (
                  <>
                    <button className="btn-secondary px-2 py-1.5" onClick={e => handleEdit(e, c)}>
                      <Pencil size={14} />
                    </button>
                    <button className="btn-danger px-2 py-1.5" onClick={e => handleDelete(e, c.id, c.trade_name)}>
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
                <ChevronRight size={16} className="text-[#8892a4] group-hover:text-brand-400 transition-colors ml-1" />
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal === 'create'} onClose={() => setModal(null)} title="Nova Empresa">
        <CompanyForm onSave={() => { setModal(null); load(); }} onClose={() => setModal(null)} />
      </Modal>
      <Modal open={modal?.type === 'edit'} onClose={() => setModal(null)} title="Editar Empresa">
        <CompanyForm company={modal?.company} onSave={() => { setModal(null); load(); }} onClose={() => setModal(null)} />
      </Modal>
    </div>
  );
}

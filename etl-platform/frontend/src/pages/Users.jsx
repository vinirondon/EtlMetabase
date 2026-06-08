import { useState, useEffect } from 'react';
import { usersAPI } from '../services/api';
import { Plus, Users as UsersIcon, Pencil, Trash2 } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import { formatDate } from '../utils/helpers';
import { useAuth } from '../contexts/AuthContext';

const ROLES = [
    { value: 'superadmin', label: 'Super Admin' },
    { value: 'admin',      label: 'Administrador' },
    { value: 'operator',   label: 'Operador' },
];

function UserForm({ user, onSave, onClose }) {
    const [form, setForm] = useState(user || { name:'', email:'', password:'', role:'operator', status:'active' });
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState('');
    const f = k => e => setForm(p => ({...p,[k]:e.target.value}));

    const submit = async (e) => {
        e.preventDefault(); setLoading(true); setError('');
        try {
            if (user?.id) await usersAPI.update(user.id, form);
            else await usersAPI.create(form);
            onSave();
        } catch (err) { setError(err.response?.data?.error || 'Erro ao salvar'); }
        finally { setLoading(false); }
    };

    return (
        <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className="label">Nome *</label><input className="input" value={form.name} onChange={f('name')} required /></div>
                <div className="col-span-2"><label className="label">E-mail *</label><input className="input" type="email" value={form.email} onChange={f('email')} required /></div>
                <div><label className="label">Perfil</label>
                    <select className="select" value={form.role} onChange={f('role')}>
                        {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                </div>
                <div><label className="label">Status</label>
                    <select className="select" value={form.status} onChange={f('status')}>
                        <option value="active">Ativo</option>
                        <option value="inactive">Inativo</option>
                    </select>
                </div>
                <div className="col-span-2">
                    <label className="label">{user ? 'Nova Senha (deixe vazio para manter)' : 'Senha *'}</label>
                    <input className="input" type="password" value={form.password} onChange={f('password')} required={!user} />
                </div>
            </div>
            {error && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}
            <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={loading} className="btn-primary">{loading ? <Spinner size={4}/> : null}{user ? 'Salvar' : 'Criar Usuário'}</button>
            </div>
        </form>
    );
}

export default function Users() {
    const [users, setUsers]   = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal]   = useState(null);
    const { user: me, canDo } = useAuth();

    const load = () => usersAPI.list().then(r => setUsers(r.data)).finally(() => setLoading(false));
    useEffect(() => { load(); }, []);

    const handleDelete = async (id, name) => {
        if (!confirm(`Remover usuário "${name}"?`)) return;
        await usersAPI.delete(id); load();
    };

    if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={8}/></div>;

    return (
        <div className="space-y-4">
            <PageHeader title="Usuários" subtitle={`${users.length} usuário(s) cadastrado(s)`}
                action={canDo('superadmin','admin') && <button className="btn-primary" onClick={() => setModal('create')}><Plus size={16}/>Novo Usuário</button>} />
            {users.length === 0 ? (
                <div className="card"><EmptyState icon={UsersIcon} title="Nenhum usuário" desc="Crie usuários para controlar o acesso à plataforma." /></div>
            ) : (
                <div className="grid gap-3">
                    {users.map(u => (
                        <div key={u.id} className="card flex items-center gap-4">
                            <div className="w-9 h-9 rounded-full bg-brand-600/20 flex items-center justify-center flex-shrink-0 text-sm font-bold text-brand-400">
                                {u.name?.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold" style={{color:'var(--text-primary)'}}>{u.name}</span>
                                    {u.id === me?.id && <span className="text-xs px-1.5 py-0.5 rounded bg-brand-600/20 text-brand-400">Você</span>}
                                    <StatusBadge status={u.status} />
                                </div>
                                <div className="text-sm" style={{color:'var(--text-muted)'}}>{u.email}</div>
                                <div className="text-xs" style={{color:'var(--text-muted)'}}>{ROLES.find(r=>r.value===u.role)?.label || u.role}</div>
                            </div>
                            <div className="text-xs hidden lg:block" style={{color:'var(--text-muted)'}}>{formatDate(u.last_login)}</div>
                            {canDo('superadmin','admin') && u.id !== me?.id && (
                                <div className="flex gap-1">
                                    <button className="btn-secondary px-2 py-1.5" onClick={() => setModal({type:'edit',user:u})}><Pencil size={14}/></button>
                                    <button className="btn-danger px-2 py-1.5" onClick={() => handleDelete(u.id, u.name)}><Trash2 size={14}/></button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
            <Modal open={modal==='create'} onClose={() => setModal(null)} title="Novo Usuário">
                <UserForm onSave={() => {setModal(null);load();}} onClose={() => setModal(null)} />
            </Modal>
            <Modal open={modal?.type==='edit'} onClose={() => setModal(null)} title="Editar Usuário">
                <UserForm user={modal?.user} onSave={() => {setModal(null);load();}} onClose={() => setModal(null)} />
            </Modal>
        </div>
    );
}

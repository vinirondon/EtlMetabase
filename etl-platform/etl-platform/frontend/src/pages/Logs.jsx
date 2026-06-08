import { useState, useEffect } from 'react';
import { logsAPI, companiesAPI, integrationsAPI } from '../services/api';
import { RefreshCw, ChevronDown, ChevronUp, AlertCircle, CheckCircle, Clock, Loader } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import Spinner from '../components/ui/Spinner';
import { formatDate, formatDuration } from '../utils/helpers';

export default function Logs() {
    const [logs, setLogs]             = useState([]);
    const [companies, setCompanies]   = useState([]);
    const [integrations, setIntegrations] = useState([]);
    const [loading, setLoading]       = useState(true);
    const [total, setTotal]           = useState(0);
    const [expanded, setExpanded]     = useState({});
    const [filterStatus, setFilterStatus]     = useState('');
    const [filterCompany, setFilterCompany]   = useState('');
    const [filterIntegration, setFilterIntegration] = useState('');
    const [limit, setLimit]           = useState(50);

    const load = async () => {
        setLoading(true);
        try {
            const [l, c, i] = await Promise.all([
                logsAPI.list({ status: filterStatus||undefined, company_id: filterCompany||undefined, integration_id: filterIntegration||undefined, limit }),
                companiesAPI.list(),
                integrationsAPI.list(),
            ]);
            setLogs(l.data?.logs || l.data?.rows || []);
            setTotal(l.data?.total || 0);
            setCompanies(c.data);
            setIntegrations(i.data);
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [filterStatus, filterCompany, filterIntegration, limit]);

    const toggle = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));

    return (
        <div className="space-y-4">
            <PageHeader title="Logs de Execução" subtitle={`${total} execuções registradas no total`}
                action={<button className="btn-secondary flex items-center gap-2" onClick={load}><RefreshCw size={14} />Atualizar</button>} />

            <div className="flex gap-2 flex-wrap">
                <select className="select w-36" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="">Todos status</option>
                    <option value="success">Sucesso</option>
                    <option value="error">Erro</option>
                    <option value="running">Rodando</option>
                </select>
                <select className="select flex-1" style={{maxWidth:200}} value={filterCompany} onChange={e => setFilterCompany(e.target.value)}>
                    <option value="">Todas empresas</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.trade_name}</option>)}
                </select>
                <select className="select flex-1" style={{maxWidth:220}} value={filterIntegration} onChange={e => setFilterIntegration(e.target.value)}>
                    <option value="">Todas integrações</option>
                    {integrations.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
                <select className="select w-20" value={limit} onChange={e => setLimit(parseInt(e.target.value))}>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                </select>
            </div>

            {loading ? <div className="flex justify-center py-12"><Spinner size={8} /></div> : (
                <div className="card p-0 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b" style={{borderColor:'var(--border)'}}>
                                {['STATUS','INTEGRAÇÃO','EMPRESA','INÍCIO','DURAÇÃO','REGISTROS','TIPO'].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{color:'var(--text-muted)'}}>{h}</th>
                                ))}
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map(log => (
                                <>
                                    <tr key={log.id} className="border-b cursor-pointer hover:bg-white/5 transition-colors" style={{borderColor:'var(--border)'}} onClick={() => toggle(log.id)}>
                                        <td className="px-4 py-3"><StatusBadge status={log.status} /></td>
                                        <td className="px-4 py-3 font-medium" style={{color:'var(--text-primary)'}}>{log.integration_name||'—'}</td>
                                        <td className="px-4 py-3" style={{color:'var(--text-muted)'}}>{log.company_name||'—'}</td>
                                        <td className="px-4 py-3 text-xs" style={{color:'var(--text-muted)'}}>{formatDate(log.started_at)}</td>
                                        <td className="px-4 py-3 text-xs" style={{color:'var(--text-muted)'}}>{formatDuration(log.duration_ms)}</td>
                                        <td className="px-4 py-3 text-xs">
                                            <span style={{color:'#34d399'}}>{log.records_inserted||0}</span>
                                            <span style={{color:'var(--text-muted)'}}>/</span>
                                            <span style={{color:'#60a5fa'}}>{log.records_updated||0}</span>
                                        </td>
                                        <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full" style={{background:'var(--bg-elevated)',color:'var(--text-muted)'}}>{log.trigger_type||'manual'}</span></td>
                                        <td className="px-4 py-3">{expanded[log.id] ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</td>
                                    </tr>
                                    {expanded[log.id] && (
                                        <tr key={log.id+'_exp'} style={{background:'var(--bg-elevated)'}}>
                                            <td colSpan={8} className="px-6 py-4">
                                                <div className="space-y-2 text-xs" style={{color:'var(--text-muted)'}}>
                                                    <div><strong>Batch ID:</strong> {log.batch_id}</div>
                                                    {log.error_message && <div className="text-red-400"><strong>Erro:</strong> {log.error_message}</div>}
                                                    {log.raw_response && <div className="font-mono text-xs p-2 rounded" style={{background:'var(--bg-base)',maxHeight:120,overflow:'auto'}}>{log.raw_response}</div>}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </>
                            ))}
                        </tbody>
                    </table>
                    {logs.length === 0 && <div className="text-center py-12" style={{color:'var(--text-muted)'}}>Nenhum log encontrado</div>}
                </div>
            )}
        </div>
    );
}

import { useState, useEffect } from 'react';
import { integrationsAPI } from '../../services/api';
import Spinner from '../ui/Spinner';
import ApiTestPanel from './ApiTestPanel';
import { Plus, Trash2, Zap, FileSpreadsheet, Globe, FileText, CheckCircle } from 'lucide-react';
import FileUploadZone from './FileUploadZone';

const AUTH_TYPES = [
    { value: 'none', label: 'Sem autenticação' },
    { value: 'bearer', label: 'Bearer Token' },
    { value: 'basic', label: 'Basic Auth' },
    { value: 'apikey', label: 'API Key' },
];
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

const SOURCE_TYPES = [
    { value: 'api', label: 'API REST / SOAP', icon: Globe, desc: 'Busca dados via requisição HTTP' },
    { value: 'excel', label: 'Excel (.xlsx)', icon: FileSpreadsheet, desc: 'Upload de planilha Excel' },
    { value: 'csv', label: 'CSV', icon: FileText, desc: 'Upload de arquivo CSV' },
    { value: 'sheets', label: 'Google Sheets', icon: Globe, desc: 'Planilha pública do Google' },
];

// ── Main Form ─────────────────────────────────────────────────────────────────
export default function IntegrationForm({ integration, companies, onSave, onClose }) {
    const [form, setForm] = useState({
        company_id: '', name: '', description: '', base_url: '', endpoint: '',
        method: 'GET', auth_type: 'none', auth_config: {}, headers: [], query_params: [],
        body_template: '', response_format: 'json', timeout: 30000,
        db_target_id: '', target_table: '', root_path: '', dedup_field: '', status: 'active',
        field_mappings: [], delete_before_insert: false,
        // Novos campos de fonte
        source_type: 'api', sheets_url: '', file_path: '', sheet_name: '',
    });
    const [targets, setTargets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [tab, setTab] = useState('source');
    const [detectedFields, setDetectedFields] = useState([]);

    useEffect(() => {
        if (integration) {
            const p = { ...integration };
            const textFields = ['name', 'description', 'base_url', 'endpoint', 'body_template',
                'root_path', 'dedup_field', 'target_table', 'db_target_id', 'status', 'method',
                'auth_type', 'response_format', 'source_type', 'sheets_url', 'file_path', 'sheet_name'];
            textFields.forEach(k => { if (p[k] == null) p[k] = ''; });
            if (!p.source_type) p.source_type = 'api';
            if (p.timeout == null) p.timeout = 30000;
            p.delete_before_insert = p.delete_before_insert === 1 || p.delete_before_insert === true;
            const parse = (k, fallback) => {
                if (typeof p[k] === 'string') try { p[k] = JSON.parse(p[k]); } catch { p[k] = fallback; }
                if (!p[k] || (Array.isArray(fallback) && !Array.isArray(p[k]))) p[k] = fallback;
            };
            parse('headers', []);
            parse('query_params', []);
            parse('field_mappings', []);
            parse('auth_config', {});
            setForm(prev => ({ ...prev, ...p }));
        }
    }, []);

    useEffect(() => {
        if (form.company_id) {
            integrationsAPI.targets({ company_id: form.company_id }).then(r => setTargets(r.data));
        }
    }, [form.company_id]);

    const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));
    const fAuth = (k) => (e) => setForm(p => ({ ...p, auth_config: { ...p.auth_config, [k]: e.target.value } }));

    const addHeader = () => setForm(p => ({ ...p, headers: [...(p.headers || []), { key: '', value: '' }] }));
    const updHeader = (i, k, v) => setForm(p => { const a = [...p.headers]; a[i] = { ...a[i], [k]: v }; return { ...p, headers: a }; });
    const delHeader = (i) => setForm(p => ({ ...p, headers: p.headers.filter((_, j) => j !== i) }));
    const addParam = () => setForm(p => ({ ...p, query_params: [...(p.query_params || []), { key: '', value: '' }] }));
    const updParam = (i, k, v) => setForm(p => { const a = [...p.query_params]; a[i] = { ...a[i], [k]: v }; return { ...p, query_params: a }; });
    const delParam = (i) => setForm(p => ({ ...p, query_params: p.query_params.filter((_, j) => j !== i) }));
    const addMapping = () => setForm(p => ({ ...p, field_mappings: [...(p.field_mappings || []), { source: '', target: '' }] }));
    const updMapping = (i, k, v) => setForm(p => { const a = [...p.field_mappings]; a[i] = { ...a[i], [k]: v }; return { ...p, field_mappings: a }; });
    const delMapping = (i) => setForm(p => ({ ...p, field_mappings: p.field_mappings.filter((_, j) => j !== i) }));

    const handleFieldsDetected = (fields) => setDetectedFields(fields);
    const handlePathSelect = (path) => setForm(p => ({ ...p, root_path: path }));

    const autoFillMappings = () => {
        const existing = new Set((form.field_mappings || []).map(m => m.source));
        const newMappings = detectedFields.filter(f => !existing.has(f)).map(f => ({ source: f, target: f }));
        setForm(p => ({ ...p, field_mappings: [...(p.field_mappings || []), ...newMappings] }));
    };

    const isApi = form.source_type === 'api';

    // Tabs dinâmicas conforme source_type
    const tabs = [
        { id: 'source', label: '📥 Fonte' },
        { id: 'general', label: 'Geral' },
        ...(isApi ? [
            { id: 'auth', label: 'Autenticação' },
            { id: 'params', label: 'Parâmetros' },
            { id: 'test', label: '⚡ Testar API', highlight: true },
        ] : []),
        { id: 'destination', label: 'Destino' },
        { id: 'mappings', label: 'Mapeamentos' },
    ];

    const submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const payload = {
                ...form,
                headers: (form.headers || []).filter(h => h.key),
                query_params: (form.query_params || []).filter(p => p.key),
                field_mappings: (form.field_mappings || []).filter(m => m.source && m.target),
                delete_before_insert: form.delete_before_insert ? 1 : 0,
            };
            if (integration?.id) await integrationsAPI.update(integration.id, payload);
            else await integrationsAPI.create(payload);
            onSave();
        } catch (err) {
            setError(err.response?.data?.error || 'Erro ao salvar');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={submit}>
            {/* Tab navigation */}
            <div className="flex gap-0.5 mb-5 border-b border-[#1e2535] overflow-x-auto pb-0">
                {tabs.map(t => (
                    <button key={t.id} type="button" onClick={() => setTab(t.id)}
                        className={`px-3 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap -mb-px border-b-2 flex-shrink-0 ${tab === t.id
                                ? t.highlight ? 'text-amber-400 border-amber-500 bg-amber-500/5' : 'text-brand-400 border-brand-500'
                                : t.highlight ? 'text-amber-500/70 border-transparent hover:text-amber-400 hover:bg-amber-500/5'
                                    : 'text-[#8892a4] border-transparent hover:text-white'
                            }`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── Fonte ────────────────────────────────────────────────────────── */}
            {tab === 'source' && (
                <div className="space-y-4">
                    <div className="p-3 bg-brand-600/10 border border-brand-600/20 rounded-lg text-sm text-brand-300">
                        Selecione de onde os dados serão lidos.
                    </div>

                    {/* Cards de seleção de fonte */}
                    <div className="grid grid-cols-2 gap-3">
                        {SOURCE_TYPES.map(s => {
                            const Icon = s.icon;
                            const active = form.source_type === s.value;
                            return (
                                <button key={s.value} type="button"
                                    onClick={() => setForm(p => ({ ...p, source_type: s.value }))}
                                    className={`p-3 rounded-xl border text-left transition-all ${active ? 'border-brand-500 bg-brand-600/10' : 'border-[#1e2535] bg-[#0f1117] hover:border-[#2d3748]'
                                        }`}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${active ? 'border-brand-500' : 'border-[#8892a4]'}`}>
                                            {active && <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />}
                                        </div>
                                        <Icon size={14} className={active ? 'text-brand-400' : 'text-[#8892a4]'} />
                                        <span className={`text-sm font-medium ${active ? 'text-white' : 'text-[#8892a4]'}`}>{s.label}</span>
                                    </div>
                                    <p className="text-xs text-[#8892a4] pl-5">{s.desc}</p>
                                </button>
                            );
                        })}
                    </div>

                    {/* Campos específicos por fonte */}
                    {form.source_type === 'sheets' && (
                        <div className="space-y-3 pt-2">
                            <div>
                                <label className="label">URL da Planilha Google *</label>
                                <input className="input font-mono text-xs" value={form.sheets_url} onChange={f('sheets_url')}
                                    placeholder="https://docs.google.com/spreadsheets/d/..." />
                                <p className="text-xs text-[#8892a4] mt-1">
                                    A planilha deve estar compartilhada como "Qualquer pessoa com o link pode visualizar".
                                </p>
                            </div>
                            <div>
                                <label className="label">Nome da Aba (opcional)</label>
                                <input className="input" value={form.sheet_name} onChange={f('sheet_name')}
                                    placeholder="Planilha1 (deixe vazio para usar a primeira aba)" />
                            </div>
                            {form.sheets_url && (
                                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
                                    <CheckCircle size={13} />
                                    URL configurada. O sistema converterá automaticamente para CSV ao executar.
                                </div>
                            )}
                        </div>
                    )}

                    {(form.source_type === 'excel' || form.source_type === 'csv') && (
                        <div className="space-y-3 pt-2">
                            <div>
                                <label className="label">Arquivo {form.source_type === 'excel' ? 'Excel' : 'CSV'}</label>
                                <FileUploadZone
                                    accept={form.source_type === 'excel' ? '.xlsx,.xls' : '.csv'}
                                    sourceType={form.source_type}
                                    integrationId={integration?.id}
                                    onFieldsDetected={handleFieldsDetected}
                                />
                            </div>
                            {form.source_type === 'excel' && (
                                <div>
                                    <label className="label">Nome da Aba (opcional)</label>
                                    <input className="input" value={form.sheet_name} onChange={f('sheet_name')}
                                        placeholder="Planilha1 (deixe vazio para usar a primeira aba)" />
                                </div>
                            )}

                        </div>
                    )}

                    {form.source_type === 'api' && (
                        <div className="p-3 bg-[#0f1117] border border-[#1e2535] rounded-lg text-xs text-[#8892a4]">
                            Configure a URL, autenticação e parâmetros nas abas ao lado.
                        </div>
                    )}
                </div>
            )}

            {/* ── General ──────────────────────────────────────────────────────── */}
            {tab === 'general' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="label">Empresa *</label>
                            <select className="select" value={form.company_id} onChange={f('company_id')} required>
                                <option value="">Selecione uma empresa</option>
                                {companies.map(c => <option key={c.id} value={c.id}>{c.trade_name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="label">Nome da Integração *</label>
                            <input className="input" value={form.name} onChange={f('name')} required />
                        </div>
                        <div>
                            <label className="label">Status</label>
                            <select className="select" value={form.status} onChange={f('status')}>
                                <option value="active">Ativo</option>
                                <option value="inactive">Inativo</option>
                            </select>
                        </div>
                        <div className="col-span-2">
                            <label className="label">Descrição</label>
                            <input className="input" value={form.description} onChange={f('description')} />
                        </div>
                        {isApi && (
                            <>
                                <div>
                                    <label className="label">Base URL *</label>
                                    <input className="input font-mono text-xs" value={form.base_url} onChange={f('base_url')}
                                        placeholder="https://api.exemplo.com" required />
                                </div>
                                <div>
                                    <label className="label">Endpoint</label>
                                    <input className="input font-mono text-xs" value={form.endpoint} onChange={f('endpoint')}
                                        placeholder="/v1/dados" />
                                </div>
                                <div>
                                    <label className="label">Método HTTP</label>
                                    <select className="select" value={form.method} onChange={f('method')}>
                                        {METHODS.map(m => <option key={m}>{m}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Formato de Retorno</label>
                                    <select className="select" value={form.response_format} onChange={f('response_format')}>
                                        <option value="json">JSON</option>
                                        <option value="xml">XML</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Timeout (ms)</label>
                                    <input className="input" type="number" value={form.timeout} onChange={f('timeout')} />
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ── Auth (API only) ───────────────────────────────────────────────── */}
            {tab === 'auth' && isApi && (
                <div className="space-y-4">
                    <div>
                        <label className="label">Tipo de Autenticação</label>
                        <select className="select" value={form.auth_type} onChange={f('auth_type')}>
                            {AUTH_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                        </select>
                    </div>
                    {form.auth_type === 'bearer' && (
                        <div>
                            <label className="label">Token</label>
                            <input className="input font-mono text-xs" value={form.auth_config?.token || ''} onChange={fAuth('token')} placeholder="seu_token_aqui" />
                        </div>
                    )}
                    {form.auth_type === 'basic' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="label">Usuário</label><input className="input" value={form.auth_config?.username || ''} onChange={fAuth('username')} /></div>
                            <div><label className="label">Senha</label><input className="input" type="password" value={form.auth_config?.password || ''} onChange={fAuth('password')} /></div>
                        </div>
                    )}
                    {form.auth_type === 'apikey' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="label">Nome do Header</label><input className="input" value={form.auth_config?.header_name || 'X-API-Key'} onChange={fAuth('header_name')} /></div>
                            <div><label className="label">Chave</label><input className="input font-mono text-xs" value={form.auth_config?.api_key || ''} onChange={fAuth('api_key')} /></div>
                        </div>
                    )}
                    {form.auth_type === 'none' && (
                        <div className="p-3 bg-[#0f1117] border border-[#1e2535] rounded-lg text-sm text-[#8892a4]">
                            Sem autenticação — a API será chamada sem headers de autorização.
                        </div>
                    )}
                    <div className="pt-2 border-t border-[#1e2535]">
                        <p className="text-xs text-[#8892a4]">
                            💡 Use a aba <strong className="text-amber-400">⚡ Testar API</strong> para verificar se a autenticação está correta antes de salvar.
                        </p>
                    </div>
                </div>
            )}

            {/* ── Params (API only) ─────────────────────────────────────────────── */}
            {tab === 'params' && isApi && (
                <div className="space-y-5">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="label mb-0">Headers Customizados</label>
                            <button type="button" onClick={addHeader} className="btn-secondary text-xs px-2 py-1"><Plus size={12} />Adicionar</button>
                        </div>
                        {(form.headers || []).length === 0 && <div className="text-xs text-[#8892a4] py-2">Nenhum header customizado.</div>}
                        {(form.headers || []).map((h, i) => (
                            <div key={i} className="flex gap-2 mb-2">
                                <input className="input text-xs font-mono" placeholder="Header-Name" value={h.key} onChange={e => updHeader(i, 'key', e.target.value)} />
                                <input className="input text-xs font-mono" placeholder="valor" value={h.value} onChange={e => updHeader(i, 'value', e.target.value)} />
                                <button type="button" onClick={() => delHeader(i)} className="btn-danger px-2 py-1.5 flex-shrink-0"><Trash2 size={12} /></button>
                            </div>
                        ))}
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="label mb-0">Query Parameters</label>
                            <button type="button" onClick={addParam} className="btn-secondary text-xs px-2 py-1"><Plus size={12} />Adicionar</button>
                        </div>
                        {(form.query_params || []).length === 0 && <div className="text-xs text-[#8892a4] py-2">Nenhum parâmetro configurado.</div>}
                        {(form.query_params || []).map((h, i) => (
                            <div key={i} className="flex gap-2 mb-2">
                                <input className="input text-xs font-mono" placeholder="param" value={h.key} onChange={e => updParam(i, 'key', e.target.value)} />
                                <input className="input text-xs font-mono" placeholder="valor" value={h.value} onChange={e => updParam(i, 'value', e.target.value)} />
                                <button type="button" onClick={() => delParam(i)} className="btn-danger px-2 py-1.5 flex-shrink-0"><Trash2 size={12} /></button>
                            </div>
                        ))}
                    </div>
                    {['POST', 'PUT', 'PATCH'].includes(form.method) && (
                        <div>
                            <label className="label">Body da Requisição (JSON)</label>
                            <textarea className="input font-mono text-xs min-h-[120px]" value={form.body_template} onChange={f('body_template')} placeholder='{"key": "value"}' />
                        </div>
                    )}
                </div>
            )}

            {/* ── Test API (API only) ───────────────────────────────────────────── */}
            {tab === 'test' && isApi && (
                <ApiTestPanel form={form} onPathSelect={handlePathSelect} onFieldsDetected={handleFieldsDetected} />
            )}

            {/* ── Destination ──────────────────────────────────────────────────── */}
            {tab === 'destination' && (
                <div className="space-y-4">
                    <div className="p-3 bg-brand-600/10 border border-brand-600/20 rounded-lg text-sm text-brand-300">
                        Configure onde os dados serão gravados no SQL Server.
                    </div>
                    <div>
                        <label className="label">Banco de Dados de Destino</label>
                        <select className="select" value={form.db_target_id} onChange={f('db_target_id')}>
                            <option value="">Selecione um banco configurado</option>
                            {targets.map(t => <option key={t.id} value={t.id}>{t.name} ({t.host}/{t.database_name})</option>)}
                        </select>
                        {!targets.length && form.company_id && (
                            <p className="text-xs text-[#8892a4] mt-1">Nenhum banco configurado para esta empresa.</p>
                        )}
                    </div>
                    <div>
                        <label className="label">Tabela de Destino</label>
                        <input className="input font-mono text-xs" value={form.target_table} onChange={f('target_table')} placeholder="dbo.minha_tabela" />
                    </div>
                    {isApi && (
                        <div>
                            <label className="label">Caminho do Array (root_path)</label>
                            <input className="input font-mono text-xs" value={form.root_path} onChange={f('root_path')} placeholder="data.items" />
                            {form.root_path && <p className="text-xs text-emerald-400 mt-1">✓ Configurado: <span className="font-mono">{form.root_path}</span></p>}
                            <p className="text-xs text-[#8892a4] mt-1">Deixe vazio para detectar automaticamente.</p>
                        </div>
                    )}
                    <div>
                        <label className="label">Campo de Deduplicação</label>
                        <input className="input font-mono text-xs" value={form.dedup_field} onChange={f('dedup_field')} placeholder="id"
                            disabled={form.delete_before_insert} />
                        <p className="text-xs text-[#8892a4] mt-1">
                            Campo único para evitar duplicatas.
                            {form.delete_before_insert && <span className="text-amber-400 ml-1">Desativado no modo Deletar e Reinserir.</span>}
                        </p>
                    </div>
                    <div className="pt-2 border-t border-[#1e2535]">
                        <label className="label">Modo de Atualização</label>
                        <div className="grid grid-cols-2 gap-3 mt-2">
                            <button type="button" onClick={() => setForm(p => ({ ...p, delete_before_insert: false }))}
                                className={`p-3 rounded-lg border text-left transition-all ${!form.delete_before_insert ? 'border-brand-500 bg-brand-600/10 text-white' : 'border-[#1e2535] bg-[#0f1117] text-[#8892a4] hover:border-[#2d3748]'}`}>
                                <div className="flex items-center gap-2 mb-1">
                                    <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${!form.delete_before_insert ? 'border-brand-500' : 'border-[#8892a4]'}`}>
                                        {!form.delete_before_insert && <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />}
                                    </div>
                                    <span className="text-sm font-medium">Upsert</span>
                                </div>
                                <p className="text-xs text-[#8892a4] leading-relaxed pl-5">Atualiza existentes e insere novos.</p>
                            </button>
                            <button type="button" onClick={() => setForm(p => ({ ...p, delete_before_insert: true, dedup_field: '' }))}
                                className={`p-3 rounded-lg border text-left transition-all ${form.delete_before_insert ? 'border-red-500 bg-red-500/10 text-white' : 'border-[#1e2535] bg-[#0f1117] text-[#8892a4] hover:border-[#2d3748]'}`}>
                                <div className="flex items-center gap-2 mb-1">
                                    <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${form.delete_before_insert ? 'border-red-500' : 'border-[#8892a4]'}`}>
                                        {form.delete_before_insert && <div className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                                    </div>
                                    <span className="text-sm font-medium">Deletar e Reinserir</span>
                                </div>
                                <p className="text-xs text-[#8892a4] leading-relaxed pl-5">Remove dados da empresa e reinsere tudo.</p>
                            </button>
                        </div>
                        {form.delete_before_insert && (
                            <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex gap-2">
                                <span className="text-red-400 flex-shrink-0 mt-0.5">⚠️</span>
                                <p className="text-xs text-red-300 leading-relaxed">
                                    A cada execução, todos os registros da empresa <strong>"{companies.find(c => c.id === form.company_id)?.trade_name || 'selecionada'}"</strong> serão
                                    removidos da tabela <strong className="font-mono">{form.target_table || 'destino'}</strong> antes da inserção.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Mappings ─────────────────────────────────────────────────────── */}
            {tab === 'mappings' && (
                <div className="space-y-4">
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-300">
                        Mapeie campos da fonte para nomes diferentes na tabela de destino. Se não configurado, os campos serão gravados com os nomes originais.
                    </div>
                    <div className="flex items-center justify-between">
                        <label className="label mb-0">Mapeamento de Campos</label>
                        <div className="flex gap-2">
                            {detectedFields.length > 0 && (
                                <button type="button" onClick={autoFillMappings}
                                    className="btn-secondary text-xs px-2 py-1 text-amber-400 border-amber-500/30 hover:bg-amber-500/10">
                                    <Zap size={12} />Auto-preencher ({detectedFields.length} campos)
                                </button>
                            )}
                            <button type="button" onClick={addMapping} className="btn-secondary text-xs px-2 py-1"><Plus size={12} />Adicionar</button>
                        </div>
                    </div>
                    {detectedFields.length > 0 && (
                        <div className="p-3 bg-[#0f1117] border border-[#1e2535] rounded-lg">
                            <p className="text-xs text-[#8892a4] mb-2">Campos detectados:</p>
                            <div className="flex flex-wrap gap-1">
                                {detectedFields.map(fi => (
                                    <button key={fi} type="button"
                                        onClick={() => setForm(p => ({ ...p, field_mappings: [...(p.field_mappings || []), { source: fi, target: fi }] }))}
                                        className="text-xs px-2 py-0.5 rounded bg-[#1e2535] hover:bg-brand-600/20 hover:text-brand-300 text-[#8892a4] font-mono border border-[#2d3748] transition-colors">
                                        + {fi}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {(form.field_mappings || []).length === 0 && (
                        <div className="text-center py-6 text-[#8892a4] text-sm">Nenhum mapeamento definido. Todos os campos serão gravados com o nome original.</div>
                    )}
                    {(form.field_mappings || []).map((m, i) => (
                        <div key={i} className="flex gap-2 items-center">
                            <div className="flex-1">
                                {detectedFields.length > 0 ? (
                                    <select className="select text-xs font-mono" value={m.source} onChange={e => updMapping(i, 'source', e.target.value)}>
                                        <option value="">Selecione campo</option>
                                        {detectedFields.map(fi => <option key={fi} value={fi}>{fi}</option>)}
                                    </select>
                                ) : (
                                    <input className="input text-xs font-mono" placeholder="campo_origem" value={m.source} onChange={e => updMapping(i, 'source', e.target.value)} />
                                )}
                            </div>
                            <span className="text-[#8892a4] text-sm flex-shrink-0">→</span>
                            <div className="flex-1">
                                <input className="input text-xs font-mono" placeholder="coluna_banco" value={m.target} onChange={e => updMapping(i, 'target', e.target.value)} />
                            </div>
                            <button type="button" onClick={() => delMapping(i)} className="btn-danger px-2 py-1.5 flex-shrink-0"><Trash2 size={12} /></button>
                        </div>
                    ))}
                </div>
            )}

            {error && (
                <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mt-4">{error}</div>
            )}

            {tab !== 'test' && (
                <div className="flex gap-3 justify-end pt-4 mt-4 border-t border-[#1e2535]">
                    <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
                    <button type="submit" disabled={loading} className="btn-primary">
                        {loading ? <Spinner size={4} /> : null}
                        {integration ? 'Salvar Alterações' : 'Criar Integração'}
                    </button>
                </div>
            )}
            {tab === 'test' && (
                <div className="flex gap-3 justify-end pt-4 mt-4 border-t border-[#1e2535]">
                    <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
                    <button type="button" onClick={() => setTab('destination')} className="btn-secondary">Ir para Destino →</button>
                    <button type="submit" disabled={loading} className="btn-primary">
                        {loading ? <Spinner size={4} /> : null}
                        {integration ? 'Salvar Alterações' : 'Criar Integração'}
                    </button>
                </div>
            )}
        </form>
    );
}

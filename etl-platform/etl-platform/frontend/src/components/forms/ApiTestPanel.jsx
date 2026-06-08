import { useState } from 'react';
import {
  Play, Loader2, CheckCircle, XCircle, AlertTriangle,
  ChevronDown, ChevronRight, Copy, Check,
  Database, List, Eye, Code, Zap, Info
} from 'lucide-react';
import { executeAPI } from '../../services/api';

// ─── Helpers ────────────────────────────────────────────────────────────────
function StatusPill({ code }) {
  const color = code >= 200 && code < 300 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    : code >= 400 ? 'text-red-400 bg-red-500/10 border-red-500/20'
    : 'text-amber-400 bg-amber-500/10 border-amber-500/20';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-bold border ${color}`}>{code}</span>;
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="p-1 rounded text-[#8892a4] hover:text-white hover:bg-[#1e2535] transition-colors" title="Copiar">
      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
    </button>
  );
}

function CollapsibleSection({ title, icon: Icon, badge, defaultOpen = false, children, accent }) {
  const [open, setOpen] = useState(defaultOpen);
  const accents = {
    green: 'text-emerald-400', blue: 'text-brand-400',
    amber: 'text-amber-400', purple: 'text-purple-400'
  };
  return (
    <div className="border border-[#1e2535] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-[#0f1117] hover:bg-[#1a2236] transition-colors text-left"
      >
        {open ? <ChevronDown size={14} className="text-[#8892a4]" /> : <ChevronRight size={14} className="text-[#8892a4]" />}
        {Icon && <Icon size={15} className={accents[accent] || 'text-[#8892a4]'} />}
        <span className="text-sm font-medium text-white flex-1">{title}</span>
        {badge != null && (
          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[#1e2535] text-[#8892a4] border border-[#2d3748]">
            {badge}
          </span>
        )}
      </button>
      {open && <div className="bg-[#0a0d14] border-t border-[#1e2535]">{children}</div>}
    </div>
  );
}

function JsonViewer({ data, maxHeight = '280px' }) {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return (
    <div className="relative group">
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <CopyButton text={text} />
      </div>
      <pre
        className="text-xs font-mono text-[#a8b4c8] p-4 overflow-auto leading-relaxed"
        style={{ maxHeight, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
      >
        {text}
      </pre>
    </div>
  );
}

function RecordsTable({ records, fields }) {
  if (!records || records.length === 0) {
    return <div className="px-4 py-6 text-center text-[#8892a4] text-sm">Nenhum registro para exibir</div>;
  }
  const cols = fields || Object.keys(records[0] || {});
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="border-b border-[#1e2535]">
            <th className="px-3 py-2 text-left text-[#8892a4] font-medium w-8">#</th>
            {cols.map(col => (
              <th key={col} className="px-3 py-2 text-left text-[#8892a4] font-medium whitespace-nowrap max-w-[180px]">
                <span className="truncate block">{col}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((row, i) => (
            <tr key={i} className="border-b border-[#1e2535]/40 hover:bg-[#1a2236] transition-colors">
              <td className="px-3 py-2 text-[#4a5568]">{i + 1}</td>
              {cols.map(col => {
                const val = row[col];
                const display = val == null ? '' : typeof val === 'object' ? JSON.stringify(val) : String(val);
                return (
                  <td key={col} className="px-3 py-2 text-[#c9d1d9] max-w-[180px]">
                    <span className="truncate block" title={display}>{display || <span className="text-[#4a5568] italic">null</span>}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ArrayPathCard({ path, count, sampleKeys = [], isActive, onSelect }) {
  const keys = Array.isArray(sampleKeys) ? sampleKeys : [];
  return (
    <button
      onClick={() => onSelect(path)}
      className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-150 ${
        isActive
          ? 'bg-brand-600/15 border-brand-500/40 shadow-sm shadow-brand-600/20'
          : 'bg-[#0f1117] border-[#1e2535] hover:border-[#2d3748] hover:bg-[#1a2236]'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className={`text-sm font-mono font-medium ${isActive ? 'text-brand-300' : 'text-white'}`}>
          {path || '(raiz)'}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          isActive ? 'bg-brand-600/30 text-brand-300' : 'bg-[#1e2535] text-[#8892a4]'
        }`}>
          {count} {count === 1 ? 'registro' : 'registros'}
        </span>
      </div>
      {keys.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {keys.slice(0, 5).map(k => (
            <span key={k} className="text-xs px-1.5 py-0.5 rounded bg-[#1e2535] text-[#8892a4] font-mono">{k}</span>
          ))}
          {keys.length > 5 && <span className="text-xs text-[#8892a4]">+{keys.length - 5}</span>}
        </div>
      )}
    </button>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function ApiTestPanel({ form, onPathSelect, onFieldsDetected }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'raw' | 'parsed'
  const [selectedPath, setSelectedPath] = useState(form.root_path || '');

  const runTest = async () => {
    if (!form.base_url) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await executeAPI.adhocTest({
        base_url: form.base_url,
        endpoint: form.endpoint || '',
        method: form.method || 'GET',
        auth_type: form.auth_type || 'none',
        auth_config: form.auth_config || {},
        headers: form.headers || [],
        query_params: form.query_params || [],
        body_template: form.body_template || undefined,
        response_format: form.response_format || 'json',
        timeout: form.timeout || 15000,
        root_path: selectedPath || form.root_path || '',
        field_mappings: form.field_mappings || [],
      });
      setResult(res.data);
      if (res.data.success && res.data.detected_fields?.length > 0) {
        onFieldsDetected?.(res.data.detected_fields);
      }
      if (res.data.active_path && !selectedPath) {
        setSelectedPath(res.data.active_path);
      }
    } catch (e) {
      setResult({ success: false, error: e.response?.data?.error || e.message });
    } finally {
      setLoading(false);
    }
  };

  const handlePathSelect = (path) => {
    setSelectedPath(path);
    onPathSelect?.(path);
    // Re-run test with new path
    setTimeout(() => runTest(), 50);
  };

  const formatBytes = (n) => n > 1024 ? `${(n/1024).toFixed(1)} KB` : `${n} B`;

  return (
    <div className="space-y-4">
      {/* Request info bar */}
      <div className="flex items-center gap-3 p-3 bg-[#0f1117] rounded-xl border border-[#1e2535]">
        <span className={`text-xs font-bold font-mono px-2 py-1 rounded ${
          form.method === 'GET' ? 'bg-emerald-500/20 text-emerald-400' :
          form.method === 'POST' ? 'bg-brand-500/20 text-brand-400' :
          'bg-amber-500/20 text-amber-400'
        }`}>{form.method || 'GET'}</span>
        <span className="text-sm font-mono text-[#8892a4] flex-1 truncate">
          {form.base_url
            ? <>{form.base_url}<span className="text-white">{form.endpoint}</span></>
            : <span className="italic text-[#4a5568]">Configure a URL primeiro na aba Geral</span>
          }
        </span>
        {form.auth_type && form.auth_type !== 'none' && (
          <span className="badge-info text-xs">{form.auth_type}</span>
        )}
      </div>

      {/* Test button */}
      <button
        onClick={runTest}
        disabled={loading || !form.base_url}
        className="btn-primary w-full justify-center py-3 text-base disabled:opacity-40"
      >
        {loading
          ? <><Loader2 size={18} className="animate-spin" /> Testando conexão...</>
          : <><Zap size={18} /> Executar Teste da API</>
        }
      </button>

      {/* No URL warning */}
      {!form.base_url && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-sm">
          <Info size={15} />
          Preencha a <strong>Base URL</strong> na aba <strong>Geral</strong> para habilitar o teste.
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-3 animate-in fade-in duration-200">

          {/* Status bar */}
          <div className={`flex items-center gap-3 p-4 rounded-xl border ${
            result.success
              ? 'bg-emerald-500/8 border-emerald-500/25'
              : 'bg-red-500/8 border-red-500/25'
          }`}>
            {result.success
              ? <CheckCircle size={20} className="text-emerald-400 flex-shrink-0" />
              : <XCircle size={20} className="text-red-400 flex-shrink-0" />
            }
            <div className="flex-1 min-w-0">
              {result.success ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-semibold text-white">Conexão bem-sucedida</span>
                  <StatusPill code={result.status} />
                  <span className="text-xs text-[#8892a4] font-mono">{result.duration_ms}ms</span>
                  <span className="text-xs text-[#8892a4]">{formatBytes(result.raw_size)}</span>
                  {result.records_total > 0 && (
                    <span className="badge-success">{result.records_total} registros detectados</span>
                  )}
                </div>
              ) : (
                <span className="text-sm font-semibold text-red-400">Falha na conexão</span>
              )}
              {result.error && (
                <p className="text-xs text-red-300 mt-1 font-mono">{result.error}</p>
              )}
              {result.parse_error && (
                <p className="text-xs text-amber-400 mt-1"><AlertTriangle size={11} className="inline mr-1" />{result.parse_error}</p>
              )}
            </div>
            {result.url_called && (
              <span className="text-xs text-[#8892a4] font-mono hidden lg:block truncate max-w-[200px]">{result.url_called}</span>
            )}
          </div>

          {/* Array paths detected */}
          {result.success && result.detected_array_paths?.length > 0 && (
            <CollapsibleSection
              title="Caminhos de dados detectados"
              icon={List}
              accent="blue"
              badge={result.detected_array_paths.length}
              defaultOpen={true}
            >
              <div className="p-4 space-y-2">
                <p className="text-xs text-[#8892a4] mb-3">
                  Selecione qual array de dados usar como fonte dos registros. O sistema detectou automaticamente os seguintes caminhos:
                </p>
                {result.detected_array_paths.map((p) => (
                  <ArrayPathCard
                    key={p.path}
                    {...p}
                    isActive={(selectedPath || result.active_path) === p.path}
                    onSelect={handlePathSelect}
                  />
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Fields detected */}
          {result.success && result.detected_fields?.length > 0 && (
            <CollapsibleSection
              title="Campos detectados no retorno"
              icon={Database}
              accent="purple"
              badge={result.detected_fields.length}
              defaultOpen={true}
            >
              <div className="p-4">
                <p className="text-xs text-[#8892a4] mb-3">
                  Estes campos estão disponíveis para mapeamento na aba <strong className="text-white">Mapeamentos</strong>:
                </p>
                <div className="flex flex-wrap gap-2">
                  {result.detected_fields.map(f => (
                    <span key={f} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1e2535] border border-[#2d3748] text-xs font-mono text-[#c9d1d9]">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </CollapsibleSection>
          )}

          {/* Records preview */}
          {result.success && result.records_preview?.length > 0 && (
            <CollapsibleSection
              title={`Preview dos registros (primeiros ${result.records_preview.length})`}
              icon={Eye}
              accent="green"
              badge={`${result.records_total} total`}
              defaultOpen={true}
            >
              <div>
                {/* View mode toggle */}
                <div className="flex gap-1 p-3 border-b border-[#1e2535]">
                  {[
                    { id: 'table', label: 'Tabela' },
                    { id: 'raw', label: 'JSON Bruto' },
                    { id: 'parsed', label: 'JSON Formatado' },
                  ].map(m => (
                    <button
                      key={m.id}
                      onClick={() => setViewMode(m.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        viewMode === m.id
                          ? 'bg-brand-600/20 text-brand-400 border border-brand-600/30'
                          : 'text-[#8892a4] hover:text-white hover:bg-[#1e2535]'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {viewMode === 'table' && (
                  <RecordsTable
                    records={result.records_preview}
                    fields={result.detected_fields}
                  />
                )}
                {viewMode === 'raw' && (
                  <JsonViewer data={result.raw_preview} maxHeight="320px" />
                )}
                {viewMode === 'parsed' && (
                  <JsonViewer data={result.parsed_preview} maxHeight="320px" />
                )}
              </div>
            </CollapsibleSection>
          )}

          {/* Raw response (errors or empty results) */}
          {result.success && result.records_total === 0 && (
            <CollapsibleSection title="Resposta bruta da API" icon={Code} accent="amber" defaultOpen={true}>
              <JsonViewer data={result.raw_preview} maxHeight="240px" />
            </CollapsibleSection>
          )}

          {!result.success && result.raw_preview && (
            <CollapsibleSection title="Resposta do servidor" icon={Code} accent="amber" defaultOpen={true}>
              <JsonViewer data={result.raw_preview} maxHeight="200px" />
            </CollapsibleSection>
          )}

        </div>
      )}
    </div>
  );
}

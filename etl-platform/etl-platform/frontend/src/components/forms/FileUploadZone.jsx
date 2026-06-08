import { useState, useRef } from 'react';
import { Upload, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';

/**
 * FileUploadZone — faz upload do arquivo e executa a integração imediatamente.
 * Não depende de file_path salvo no banco.
 */
export default function FileUploadZone({ accept, sourceType, integrationId, onFieldsDetected }) {
    const [state, setState]   = useState('idle'); // idle | uploading | success | error
    const [result, setResult] = useState(null);
    const [error, setError]   = useState('');
    const inputRef            = useRef();

    const token = localStorage.getItem('etl_token');

    const handleFile = async (file) => {
        if (!file) return;
        setState('uploading');
        setError('');
        setResult(null);

        const fd = new FormData();
        fd.append('file', file);

        try {
            if (!integrationId) {
                // Sem integração salva: só faz preview
                const res  = await fetch('/api/upload/preview', {
                    method: 'POST', body: fd,
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (!data.success) throw new Error(data.error);
                onFieldsDetected?.(data.fields);
                setResult({ type: 'preview', total: data.total, fields: data.fields, preview: data.preview });
                setState('success');
            } else {
                // Com integração: executa e salva no banco agora
                fd.append('integration_id', integrationId);
                const res  = await fetch('/api/upload/run', {
                    method: 'POST', body: fd,
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data.error || 'Erro ao processar');
                onFieldsDetected?.([]);
                setResult({ type: 'run', ...data });
                setState('success');
            }
        } catch (e) {
            setError(e.message);
            setState('error');
        }
    };

    const onDrop = (e) => {
        e.preventDefault();
        handleFile(e.dataTransfer.files[0]);
    };

    const reset = () => { setState('idle'); setResult(null); setError(''); };

    return (
        <div className="space-y-3">
            {/* Drop zone */}
            <div
                onDragOver={e => e.preventDefault()}
                onDrop={onDrop}
                onClick={() => state === 'idle' && inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                    state === 'idle'
                        ? 'border-[#1e2535] hover:border-brand-500/50 hover:bg-brand-600/5 cursor-pointer'
                        : state === 'success'
                        ? 'border-emerald-500/40 bg-emerald-500/5'
                        : state === 'error'
                        ? 'border-red-500/40 bg-red-500/5'
                        : 'border-[#1e2535] bg-[#0f1117]'
                }`}
            >
                <input ref={inputRef} type="file" accept={accept} className="hidden"
                    onChange={e => handleFile(e.target.files[0])} />

                {state === 'idle' && (
                    <div className="flex flex-col items-center gap-2">
                        <Upload size={22} className="text-[#8892a4]" />
                        <p className="text-sm font-medium text-white">
                            Arraste o arquivo ou clique para selecionar
                        </p>
                        <p className="text-xs text-[#8892a4]">
                            {sourceType === 'excel' ? '.xlsx ou .xls' : '.csv'} · máximo 50MB
                        </p>
                        {integrationId && (
                            <p className="text-xs text-brand-400 mt-1">
                                Os dados serão inseridos no banco imediatamente após o upload
                            </p>
                        )}
                    </div>
                )}

                {state === 'uploading' && (
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 size={22} className="text-brand-400 animate-spin" />
                        <p className="text-sm text-[#8892a4]">
                            {integrationId ? 'Lendo e inserindo no banco...' : 'Processando arquivo...'}
                        </p>
                    </div>
                )}

                {state === 'success' && result?.type === 'run' && (
                    <div className="flex flex-col items-center gap-2">
                        {result.running ? (
                            <>
                                <Loader2 size={22} className="text-brand-400 animate-spin" />
                                <p className="text-sm font-medium text-white">Processando em segundo plano</p>
                                <p className="text-xs text-[#8892a4]">{result.message}</p>
                                <p className="text-xs text-brand-400">Acompanhe o progresso em Logs &amp; Execuções</p>
                            </>
                        ) : (
                            <>
                                <CheckCircle size={22} className="text-emerald-400" />
                                <p className="text-sm font-medium text-white">Concluído com sucesso!</p>
                                <div className="flex gap-4 text-xs mt-1">
                                    <span className="text-emerald-400">{result.records_fetched} lidos</span>
                                    {result.records_inserted > 0 && <span className="text-emerald-400">{result.records_inserted} inseridos</span>}
                                    {result.records_updated > 0  && <span className="text-brand-400">{result.records_updated} atualizados</span>}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {state === 'success' && result?.type === 'preview' && (
                    <div className="flex flex-col items-center gap-2">
                        <CheckCircle size={22} className="text-emerald-400" />
                        <p className="text-sm font-medium text-white">{result.total} registros · {result.fields.length} campos</p>
                        <p className="text-xs text-amber-400">Salve a integração e faça upload novamente para inserir no banco</p>
                    </div>
                )}

                {state === 'error' && (
                    <div className="flex flex-col items-center gap-2">
                        <AlertCircle size={22} className="text-red-400" />
                        <p className="text-sm font-medium text-red-400">Erro ao processar</p>
                        <p className="text-xs text-red-300">{error}</p>
                    </div>
                )}
            </div>

            {/* Campos detectados (preview) */}
            {state === 'success' && result?.type === 'preview' && result.fields.length > 0 && (
                <div className="p-3 bg-[#0f1117] border border-[#1e2535] rounded-lg">
                    <p className="text-xs text-[#8892a4] mb-2">Campos detectados:</p>
                    <div className="flex flex-wrap gap-1">
                        {result.fields.slice(0, 12).map(f => (
                            <span key={f} className="text-xs px-1.5 py-0.5 rounded bg-[#1e2535] text-[#8892a4] font-mono">{f}</span>
                        ))}
                        {result.fields.length > 12 && (
                            <span className="text-xs text-[#8892a4]">+{result.fields.length - 12}</span>
                        )}
                    </div>
                </div>
            )}

            {/* Botão para fazer novo upload */}
            {state !== 'idle' && state !== 'uploading' && (
                <button type="button" onClick={reset}
                    className="text-xs text-[#8892a4] hover:text-white flex items-center gap-1 transition-colors">
                    <X size={11} /> Fazer novo upload
                </button>
            )}
        </div>
    );
}

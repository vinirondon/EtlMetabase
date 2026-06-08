import { X } from 'lucide-react';
import { useEffect } from 'react';

export default function Modal({ open, onClose, title, children, size='md' }) {
    useEffect(() => {
        const handleEsc = e => { if (e.key==='Escape') onClose(); };
        if (open) document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [open, onClose]);

    if (!open) return null;

    const maxW = { sm:'max-w-sm', md:'max-w-lg', lg:'max-w-2xl', xl:'max-w-4xl' }[size] || 'max-w-lg';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => e.target===e.currentTarget && onClose()}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}/>
            <div className={`relative w-full ${maxW} rounded-2xl border shadow-2xl max-h-[90vh] flex flex-col`}
                style={{background:'var(--bg-surface)',borderColor:'var(--border)'}}>
                <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{borderColor:'var(--border)'}}>
                    <h2 className="text-lg font-semibold" style={{color:'var(--text-primary)'}}>{title}</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" style={{color:'var(--text-muted)'}}>
                        <X size={18}/>
                    </button>
                </div>
                <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
            </div>
        </div>
    );
}

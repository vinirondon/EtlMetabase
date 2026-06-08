export default function EmptyState({ icon: Icon, title, desc, action }) {
    return (
        <div className="text-center py-12">
            {Icon && <div className="flex justify-center mb-4"><div className="w-14 h-14 rounded-2xl bg-brand-600/10 flex items-center justify-center"><Icon size={24} className="text-brand-400"/></div></div>}
            <h3 className="text-base font-semibold mb-1" style={{color:'var(--text-primary)'}}>{title}</h3>
            {desc && <p className="text-sm mb-4" style={{color:'var(--text-muted)'}}>{desc}</p>}
            {action}
        </div>
    );
}

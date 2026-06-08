export default function PageHeader({ title, subtitle, action }) {
    return (
        <div className="flex items-start justify-between gap-4 mb-2">
            <div>
                <h1 className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>{title}</h1>
                {subtitle && <p className="text-sm mt-0.5" style={{color:'var(--text-muted)'}}>{subtitle}</p>}
            </div>
            {action && <div className="flex-shrink-0">{action}</div>}
        </div>
    );
}

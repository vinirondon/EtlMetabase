import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Building2, Plug2, CalendarClock, FileText, Database, Users, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const nav = [
    { to:'/',             icon:LayoutDashboard, label:'Dashboard' },
    { to:'/companies',    icon:Building2,       label:'Empresas' },
    { to:'/integrations', icon:Plug2,           label:'Integrações' },
    { to:'/schedules',    icon:CalendarClock,   label:'Agendamentos' },
    { to:'/logs',         icon:FileText,        label:'Logs' },
    { to:'/databases',    icon:Database,        label:'Bancos de Dados' },
    { to:'/users',        icon:Users,           label:'Usuários', roles:['superadmin','admin'] },
];

export default function Sidebar() {
    const { user, logout, canDo } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => { logout(); navigate('/login'); };

    return (
        <aside className="fixed left-0 top-0 h-screen w-60 flex flex-col z-40 border-r"
            style={{ background:'var(--bg-surface)', borderColor:'var(--border)' }}>
            {/* Logo */}
            <div className="p-5 border-b" style={{borderColor:'var(--border)'}}>
                <div className="flex items-center gap-2.5">
                    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                        <path d="M16 2L28 9V23L16 30L4 23V9L16 2Z" fill="#4F46E5" opacity="0.2"/>
                        <path d="M16 2L28 9V23L16 30L4 23V9L16 2Z" stroke="#6366F1" strokeWidth="1"/>
                        <path d="M7 11H13M7 16H12M7 21H13" stroke="#818CF8" strokeWidth="1.8" strokeLinecap="round"/>
                        <path d="M14.5 16H18.5M17 13L20 16L17 19" stroke="#A5B4FC" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        <rect x="20" y="10.5" width="5.5" height="11" rx="1.5" fill="none" stroke="#6366F1" strokeWidth="1.4"/>
                        <rect x="21.5" y="12" width="2.5" height="7" rx="0.8" fill="#818CF8"/>
                    </svg>
                    <span style={{fontWeight:800,fontSize:16,letterSpacing:'-0.03em',color:'var(--text-primary)'}}>
                        ETL<span style={{color:'#818CF8'}}>platform</span>
                    </span>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
                {nav.filter(item => !item.roles || canDo(...item.roles)).map(item => (
                    <NavLink key={item.to} to={item.to} end={item.to==='/'} className={({isActive}) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                            isActive ? 'bg-brand-600/15 text-brand-400' : 'hover:bg-white/5'
                        }`} style={({isActive})=>({color: isActive ? '#818CF8' : 'var(--text-muted)'})}>
                        <item.icon size={16} />
                        {item.label}
                    </NavLink>
                ))}
            </nav>

            {/* User */}
            <div className="p-3 border-t" style={{borderColor:'var(--border)'}}>
                <div className="flex items-center gap-2 px-3 py-2 mb-1">
                    <div className="w-7 h-7 rounded-full bg-brand-600/20 flex items-center justify-center text-xs font-bold text-brand-400">
                        {user?.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate" style={{color:'var(--text-primary)'}}>{user?.name}</div>
                        <div className="text-xs truncate" style={{color:'var(--text-muted)'}}>{user?.role}</div>
                    </div>
                </div>
                <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-red-500/10 text-red-400">
                    <LogOut size={14}/> Sair
                </button>
            </div>
        </aside>
    );
}

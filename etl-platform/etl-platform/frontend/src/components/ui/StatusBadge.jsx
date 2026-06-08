export default function StatusBadge({ status }) {
    const map = {
        success:  'badge-success',
        active:   'badge-success',
        error:    'badge-error',
        inactive: 'badge-neutral',
        running:  'badge-info',
        warning:  'badge-warning',
    };
    const labels = {
        success: 'Sucesso', active: 'Ativo', error: 'Erro',
        inactive: 'Inativo', running: 'Rodando', warning: 'Aviso',
    };
    if (!status) return null;
    return <span className={map[status] || 'badge-neutral'}>{labels[status] || status}</span>;
}

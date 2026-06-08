import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    timeout: 30000
});

api.interceptors.request.use(config => {
    const token = localStorage.getItem('etl_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

api.interceptors.response.use(res => res, err => {
    if (err.response?.status === 401) {
        const isAuthRoute = err.config?.url?.includes('/auth/');
        if (!isAuthRoute) {
            localStorage.removeItem('etl_token');
            localStorage.removeItem('etl_user');
            window.location.href = '/login';
        }
    }
    return Promise.reject(err);
});

export const authAPI = {
    login:          (d)  => api.post('/auth/login', d),
    me:             ()   => api.get('/auth/me'),
    changePassword: (d)  => api.post('/auth/change-password', d),
};
export const dashboardAPI = { stats: () => api.get('/dashboard/stats') };
export const companiesAPI = {
    list:       ()       => api.get('/companies'),
    get:        (id)     => api.get(`/companies/${id}`),
    create:     (d)      => api.post('/companies', d),
    update:     (id, d)  => api.put(`/companies/${id}`, d),
    delete:     (id)     => api.delete(`/companies/${id}`),
    linkUser:   (id, uid) => api.post(`/companies/${id}/users`, { user_id: uid }),
    unlinkUser: (id, uid) => api.delete(`/companies/${id}/users/${uid}`),
};
export const integrationsAPI = {
    list:         (p)     => api.get('/integrations', { params: p }),
    get:          (id)    => api.get(`/integrations/${id}`),
    create:       (d)     => api.post('/integrations', d),
    update:       (id, d) => api.put(`/integrations/${id}`, d),
    delete:       (id)    => api.delete(`/integrations/${id}`),
    targets:      (p)     => api.get('/integrations/targets/all', { params: p }),
    createTarget: (d)     => api.post('/integrations/targets', d),
    updateTarget: (id, d) => api.put(`/integrations/targets/${id}`, d),
    deleteTarget: (id)    => api.delete(`/integrations/targets/${id}`),
    testTarget:   (id)    => api.post(`/integrations/targets/${id}/test`),
    linkTarget:   (d)     => api.post('/integrations/targets/link', d),
};
export const schedulesAPI = {
    list:    ()    => api.get('/schedules'),
    create:  (d)   => api.post('/schedules', d),
    update:  (id, d) => api.put(`/schedules/${id}`, d),
    toggle:  (id)  => api.patch(`/schedules/${id}/toggle`),
    delete:  (id)  => api.delete(`/schedules/${id}`),
};
export const logsAPI = {
    list:  (p)  => api.get('/logs', { params: p }),
    get:   (id) => api.get(`/logs/${id}`),
    audit: (p)  => api.get('/logs/audit/list', { params: p }),
};
export const executeAPI = {
    adhocTest: (d)  => api.post('/execute/adhoc-test', d),
    run:       (id) => api.post(`/execute/${id}/run`),
    test:      (id) => api.post(`/execute/${id}/test`),
};
export const usersAPI = {
    list:   ()       => api.get('/users'),
    create: (d)      => api.post('/users', d),
    update: (id, d)  => api.put(`/users/${id}`, d),
    delete: (id)     => api.delete(`/users/${id}`),
};

export default api;

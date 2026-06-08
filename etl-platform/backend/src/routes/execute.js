const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { runIntegration } = require('../workers/integrationRunner');
const { logAudit } = require('../utils/audit');
const { getAsync } = require('../models/database');
const axios  = require('axios');
const xml2js = require('xml2js');
const https  = require('https');

router.post('/adhoc-test', authenticate, async (req, res) => {
    try {
        const result = await executeTest(req.body);
        res.json(result);
    } catch (e) { res.json({ success: false, error: e.message }); }
});

router.post('/:id/test', authenticate, async (req, res) => {
    try {
        const integration = await getAsync('SELECT * FROM etl.integrations WHERE id=?', [req.params.id]);
        if (!integration) return res.status(404).json({ error: 'Integration not found' });
        ['headers','query_params','auth_config','field_mappings'].forEach(k => {
            if (integration[k]) try { integration[k] = JSON.parse(integration[k]); } catch {}
        });
        res.json(await executeTest(integration));
    } catch (e) { res.json({ success: false, error: e.message }); }
});

router.post('/:id/run', authenticate, requireRole('superadmin','admin','operator'), async (req, res) => {
    try {
        const result = await runIntegration(req.params.id, req.user.id, 'manual');
        await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'MANUAL_RUN', resourceType: 'integration', resourceId: req.params.id, ip: req.ip });
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

async function executeTest(config) {
    const { base_url, endpoint='', method='GET', auth_type='none', auth_config={},
            headers=[], query_params=[], body_template, response_format='json',
            timeout=15000, root_path } = config;

    const customHeaders = {};
    if (Array.isArray(headers)) headers.filter(h=>h.key).forEach(h=>{customHeaders[h.key]=h.value;});
    else if (headers && typeof headers==='object') Object.assign(customHeaders, headers);

    const authHeaders = {};
    const authCfg = typeof auth_config==='string' ? JSON.parse(auth_config||'{}') : (auth_config||{});
    if (auth_type==='bearer' && authCfg.token) authHeaders['Authorization'] = 'Bearer ' + authCfg.token;
    else if (auth_type==='basic' && authCfg.username) authHeaders['Authorization'] = 'Basic ' + Buffer.from(authCfg.username+':'+(authCfg.password||'')).toString('base64');
    else if (auth_type==='apikey' && authCfg.api_key) authHeaders[authCfg.header_name||'X-API-Key'] = authCfg.api_key;

    const qParams = {};
    if (Array.isArray(query_params)) query_params.filter(p=>p.key).forEach(p=>{qParams[p.key]=p.value;});

    const url = base_url.replace(/\/$/, '') + (endpoint||'');
    const start = Date.now();
    let response;
    try {
        response = await axios({ method, url, headers:{...customHeaders,...authHeaders},
            params: Object.keys(qParams).length ? qParams : undefined,
            data: body_template||undefined, timeout: Math.min(timeout||15000,30000),
            responseType: 'text', httpsAgent: new https.Agent({rejectUnauthorized:false}) });
    } catch (err) {
        return { success:false, status:err.response?.status, error:err.message,
                 url_called:url, duration_ms:Date.now()-start,
                 raw_preview: String(err.response?.data||'').substring(0,2000) };
    }

    const duration = Date.now()-start;
    const rawText  = response.data||'';
    let parsedData=null, parseError=null;
    try {
        if (response_format==='xml') {
            parsedData = await new Promise((resolve,reject) =>
                xml2js.parseString(rawText,{explicitArray:false,mergeAttrs:true},(err,r)=>err?reject(err):resolve(r)));
        } else {
            parsedData = JSON.parse(rawText);
            if (typeof parsedData==='string') parsedData = JSON.parse(parsedData);
        }
    } catch(e) { parseError='Parse error: '+e.message; parsedData=rawText; }

    const detectedPaths = detectArrayPaths(parsedData);
    const activePath    = root_path || (detectedPaths[0]?.path??null);
    const records       = extractRecords(parsedData, activePath);
    const detectedFields = [...new Set(records.flatMap(r=>r&&typeof r==='object'?Object.keys(r):[]))];

    return { success:true, status:response.status, duration_ms:duration,
             content_type:response.headers['content-type']||'', raw_size:rawText.length,
             parse_error:parseError, raw_preview:rawText.substring(0,3000),
             records_total:records.length, records_preview:records.slice(0,5),
             detected_fields:detectedFields, detected_array_paths:detectedPaths,
             active_path:activePath, url_called:url };
}

function detectArrayPaths(obj, prefix='', depth=0, results=[]) {
    if (depth>6||!obj||typeof obj!=='object') return results;
    if (Array.isArray(obj)) {
        const allKeys=[...new Set(obj.flatMap(item=>item&&typeof item==='object'?Object.keys(item):[]))];
        results.push({path:prefix||'',count:obj.length,sample_keys:allKeys.slice(0,8)});
        return results;
    }
    for (const [key,val] of Object.entries(obj)) {
        const p = prefix ? prefix+'.'+key : key;
        if (Array.isArray(val)) {
            const allKeys=[...new Set(val.flatMap(item=>item&&typeof item==='object'?Object.keys(item):[]))];
            results.push({path:p,count:val.length,sample_keys:allKeys.slice(0,8)});
        } else if (val&&typeof val==='object') {
            detectArrayPaths(val,p,depth+1,results);
        }
    }
    return results.sort((a,b)=>b.count-a.count);
}

function extractRecords(data, rootPath) {
    if (!rootPath) {
        if (Array.isArray(data)) return data;
        if (data&&typeof data==='object') {
            for (const val of Object.values(data)) if (Array.isArray(val)) return val;
            return [data];
        }
        return [];
    }
    let current=data;
    for (const part of rootPath.split('.')) { if (current==null) return []; current=current[part]; }
    return Array.isArray(current)?current:(current!=null?[current]:[]);
}

module.exports = router;

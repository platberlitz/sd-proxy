const express = require('express');
const fetch = require('node-fetch');
const app = express();
app.use(express.json({ limit: '50mb' }));

// Multi-backend image generation proxy with OpenAI-compatible API
// Supports: Local A1111/ComfyUI, Pollinations (free), NanoGPT, PixAI, custom endpoints

const BACKENDS = {
    local: { name: 'Local (A1111/ComfyUI)', url: 'http://127.0.0.1:7860' },
    pollinations: { name: 'Pollinations (Free)', url: 'https://image.pollinations.ai' },
    nanogpt: { name: 'NanoGPT', url: 'https://nano-gpt.com' },
    pixai: { name: 'PixAI', url: 'https://api.pixai.art/v1' }
};

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Methods', '*');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// Dashboard
app.get('/', (req, res) => res.send(`<!DOCTYPE html><html><head>
<title>SD Proxy</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui;background:#0a0a1a;color:#e0e0e0;min-height:100vh;padding:20px}
.container{max-width:1200px;margin:0 auto}
h1{color:#e94560;margin-bottom:20px}
.tabs{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap}
.tab{padding:10px 20px;background:#1a1a2e;border:none;color:#e0e0e0;cursor:pointer;border-radius:8px}
.tab.active{background:#e94560}
.tab-content{display:none}.tab-content.active{display:block}
.card{background:#16213e;padding:20px;border-radius:12px;margin-bottom:20px}
label{display:block;margin:12px 0 4px;color:#888;font-size:13px}
input,select,textarea{width:100%;padding:10px;background:#0f0f23;border:1px solid #333;border-radius:6px;color:#e0e0e0;font-size:14px}
textarea{min-height:80px;resize:vertical}
button{padding:12px 24px;background:#e94560;border:none;color:#fff;border-radius:8px;cursor:pointer;font-size:14px;margin-top:12px}
button:hover{background:#ff6b6b}
button:disabled{opacity:0.5;cursor:not-allowed}
.btn-secondary{background:#333}
.btn-sm{padding:6px 12px;font-size:12px}
.row{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.result{margin-top:20px}
.result img{max-width:100%;border-radius:8px;cursor:pointer}
.img-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
.img-card{background:#0f0f23;padding:8px;border-radius:8px;text-align:center}
.img-card img{width:100%;border-radius:4px}
.modal{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:9999;justify-content:center;align-items:center}
.modal img{max-width:95%;max-height:95%;object-fit:contain}
.modal.show{display:flex}
.history-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;max-height:400px;overflow-y:auto}
.history-item{background:#0f0f23;padding:6px;border-radius:6px;cursor:pointer}
.history-item img{width:100%;border-radius:4px}
.lora-list{max-height:200px;overflow-y:auto;background:#0f0f23;border-radius:6px;padding:8px;margin-top:8px}
.lora-item{display:flex;align-items:center;gap:8px;padding:6px;border-bottom:1px solid #333}
.lora-item:last-child{border:none}
.lora-item input[type=checkbox]{width:auto}
.lora-item input[type=number]{width:60px}
</style>
</head><body>
<div class="container">
<h1>🎨 SD Proxy</h1>
<p style="color:#888;margin-bottom:20px">Multi-backend image generation with OpenAI-compatible API</p>

<div class="tabs">
<button class="tab active" onclick="showTab('generate')">Generate</button>
<button class="tab" onclick="showTab('models')">Models</button>
<button class="tab" onclick="showTab('loras')">LoRAs</button>
<button class="tab" onclick="showTab('history')">History</button>
<button class="tab" onclick="showTab('settings')">Settings</button>
</div>

<div id="tab-generate" class="tab-content active">
<div class="card">
<label>Backend</label>
<select id="backend" onchange="onBackendChange()">
<option value="local">Local (A1111/ComfyUI)</option>
<option value="pollinations">Pollinations (Free)</option>
<option value="nanogpt">NanoGPT</option>
<option value="pixai">PixAI</option>
<option value="custom">Custom Endpoint</option>
</select>

<div id="customEndpoint" style="display:none">
<label>Custom URL</label>
<input id="customUrl" placeholder="https://your-api.com/v1/images/generations">
</div>

<label>API Key (if required)</label>
<input type="password" id="apiKey" placeholder="Leave empty for free backends">

<label>Model <button class="btn-sm btn-secondary" onclick="fetchModels()" style="float:right">🔄 Fetch</button></label>
<input id="model" list="modelList" placeholder="Type or select model">
<datalist id="modelList"></datalist>

<label>Prompt</label>
<textarea id="prompt" placeholder="masterpiece, best quality, 1girl, ">masterpiece, best quality, highly detailed, </textarea>

<label>Negative Prompt</label>
<textarea id="negative" rows="2">lowres, bad anatomy, bad hands, text, error, worst quality, low quality, jpeg artifacts, watermark, blurry</textarea>

<div class="row">
<div><label>Width</label><input type="number" id="width" value="512" step="64"></div>
<div><label>Height</label><input type="number" id="height" value="768" step="64"></div>
<div><label>Steps</label><input type="number" id="steps" value="20"></div>
<div><label>CFG</label><input type="number" id="cfg" value="7" step="0.5"></div>
</div>

<div class="row">
<div><label>Sampler</label>
<select id="sampler">
<option value="">Default</option>
<option value="Euler a">Euler a</option>
<option value="Euler">Euler</option>
<option value="DPM++ 2M Karras">DPM++ 2M Karras</option>
<option value="DPM++ SDE Karras">DPM++ SDE Karras</option>
<option value="DDIM">DDIM</option>
</select></div>
<div><label>Seed (-1 = random)</label><input type="number" id="seed" value="-1"></div>
<div><label>Batch</label><input type="number" id="batch" value="1" min="1" max="4"></div>
</div>

<div id="loraSection">
<label>Active LoRAs</label>
<div id="activeLoraList" style="font-size:13px;color:#888">None selected</div>
</div>

<div style="margin-top:16px">
<button onclick="generate()" id="genBtn">🎨 Generate</button>
<button onclick="addToQueue()" class="btn-secondary">+ Add to Queue</button>
</div>
<div id="status" style="margin-top:12px"></div>
</div>

<div class="result" id="result"></div>
</div>

<div id="tab-models" class="tab-content">
<div class="card">
<h3>📦 Models</h3>
<p style="color:#666;font-size:13px;margin-bottom:12px">Load models from Civitai or local path. For local A1111, models are auto-detected.</p>

<label>Load from Civitai URL</label>
<div class="row">
<input id="civitaiUrl" placeholder="https://civitai.com/models/12345 or model version ID">
<button onclick="loadCivitaiModel()" class="btn-sm">Load Info</button>
</div>
<div id="civitaiInfo" style="margin-top:12px"></div>

<label style="margin-top:20px">Available Models (from backend)</label>
<div id="modelsDisplay" style="margin-top:8px;color:#888">Select a backend and click refresh</div>
<button onclick="refreshModels()" class="btn-sm btn-secondary" style="margin-top:8px">Refresh Models</button>
</div>
</div>

<div id="tab-loras" class="tab-content">
<div class="card">
<h3>🎭 LoRAs</h3>
<p style="color:#666;font-size:13px;margin-bottom:12px">Manage LoRAs for generation. For local backends, LoRAs are auto-detected.</p>

<label>Add LoRA from Civitai</label>
<div class="row">
<input id="loraUrl" placeholder="Civitai LoRA URL or ID">
<button onclick="addCivitaiLora()" class="btn-sm">Add</button>
</div>

<label style="margin-top:16px">Manual LoRA (for PixAI/other backends)</label>
<div class="row">
<input id="loraId" placeholder="LoRA ID">
<input id="loraWeight" type="number" value="0.7" min="0" max="1" step="0.1" style="width:80px">
<button onclick="addManualLora()" class="btn-sm">Add</button>
</div>

<label style="margin-top:16px">Your LoRAs</label>
<div id="loraList" class="lora-list">No LoRAs added</div>
</div>
</div>

<div id="tab-history" class="tab-content">
<div class="card">
<h3>📜 History</h3>
<div id="historyGrid" class="history-grid"></div>
<button onclick="clearHistory()" class="btn-secondary btn-sm" style="margin-top:12px">Clear</button>
</div>
</div>

<div id="tab-settings" class="tab-content">
<div class="card">
<h3>⚙️ Settings</h3>

<label>Local Backend URL</label>
<input id="localUrl" value="http://127.0.0.1:7860" onchange="saveSettings()">

<label>Default Quality Tags</label>
<input id="qualityTags" value="masterpiece, best quality, highly detailed, " onchange="saveSettings()">

<label>Default Negative</label>
<textarea id="defaultNeg" rows="2" onchange="saveSettings()">lowres, bad anatomy, bad hands, text, error, worst quality, low quality, jpeg artifacts, watermark, blurry</textarea>

<h4 style="margin-top:20px;color:#e94560">API Endpoints</h4>
<p style="color:#666;font-size:13px;margin:8px 0">Use these endpoints from your apps:</p>
<code style="display:block;background:#0f0f23;padding:12px;border-radius:6px;font-size:12px;margin-top:8px">
POST /v1/images/generations<br>
POST /v1/chat/completions (with image generation)<br>
GET /v1/models
</code>
</div>
</div>

<div class="modal" id="modal" onclick="this.classList.remove('show')">
<img id="modalImg">
</div>
</div>

<script>
const $ = id => document.getElementById(id);
let loras = JSON.parse(localStorage.getItem('sdproxy_loras') || '[]');
let history = JSON.parse(localStorage.getItem('sdproxy_history') || '[]');
let settings = JSON.parse(localStorage.getItem('sdproxy_settings') || '{}');

function showTab(id) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    $('tab-' + id).classList.add('active');
    event.target.classList.add('active');
}

function showModal(url) { $('modalImg').src = url; $('modal').classList.add('show'); }

function onBackendChange() {
    const backend = $('backend').value;
    $('customEndpoint').style.display = backend === 'custom' ? 'block' : 'none';
    $('loraSection').style.display = ['local', 'pixai'].includes(backend) ? 'block' : 'none';
}

function saveSettings() {
    settings = {
        localUrl: $('localUrl').value,
        qualityTags: $('qualityTags').value,
        defaultNeg: $('defaultNeg').value
    };
    localStorage.setItem('sdproxy_settings', JSON.stringify(settings));
}

function loadSettings() {
    if (settings.localUrl) $('localUrl').value = settings.localUrl;
    if (settings.qualityTags) $('qualityTags').value = settings.qualityTags;
    if (settings.defaultNeg) $('defaultNeg').value = settings.defaultNeg;
}

async function generate() {
    const btn = $('genBtn');
    const status = $('status');
    btn.disabled = true;
    status.textContent = '⏳ Generating...';
    
    try {
        const backend = $('backend').value;
        const apiKey = $('apiKey').value;
        const prompt = $('prompt').value;
        const negative = $('negative').value;
        const width = parseInt($('width').value);
        const height = parseInt($('height').value);
        const steps = parseInt($('steps').value);
        const cfg = parseFloat($('cfg').value);
        const sampler = $('sampler').value;
        const seed = parseInt($('seed').value);
        const batch = parseInt($('batch').value);
        const model = $('model').value;
        
        const activeLoras = loras.filter(l => l.active);
        
        const body = {
            prompt, negative_prompt: negative,
            width, height, steps, cfg_scale: cfg,
            sampler, seed: seed >= 0 ? seed : undefined,
            n: batch, model,
            loras: activeLoras.length ? activeLoras.map(l => ({ id: l.id, weight: l.weight })) : undefined
        };
        
        let url = '/v1/images/generations';
        let headers = { 'Content-Type': 'application/json' };
        
        if (backend === 'custom') {
            url = $('customUrl').value;
        }
        if (apiKey) headers['Authorization'] = 'Bearer ' + apiKey;
        headers['X-Backend'] = backend;
        if (backend === 'local') headers['X-Local-Url'] = $('localUrl').value;
        
        const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
        const data = await res.json();
        
        if (data.error) throw new Error(data.error);
        
        if (data.data?.length) {
            const urls = data.data.map(d => d.url || d.b64_json);
            status.textContent = '✅ Done!';
            $('result').innerHTML = '<div class="img-grid">' + urls.map(u => 
                '<div class="img-card"><img src="' + (u.startsWith('data:') || u.startsWith('http') ? u : 'data:image/png;base64,' + u) + '" onclick="showModal(this.src)"><br><a href="' + u + '" download>Download</a></div>'
            ).join('') + '</div>';
            addToHistory(urls, prompt);
        }
    } catch (e) {
        status.textContent = '❌ ' + e.message;
    } finally {
        btn.disabled = false;
    }
}

function addToHistory(urls, prompt) {
    urls.forEach(url => {
        history.unshift({ url, prompt, date: new Date().toISOString() });
    });
    history = history.slice(0, 50);
    localStorage.setItem('sdproxy_history', JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    $('historyGrid').innerHTML = history.map((h, i) => 
        '<div class="history-item" onclick="showModal(\\'' + h.url + '\\')"><img src="' + h.url + '"></div>'
    ).join('') || '<p style="color:#666">No history</p>';
}

function clearHistory() { history = []; localStorage.removeItem('sdproxy_history'); renderHistory(); }

function renderLoras() {
    const active = loras.filter(l => l.active);
    $('activeLoraList').textContent = active.length ? active.map(l => l.name + ':' + l.weight).join(', ') : 'None selected';
    $('loraList').innerHTML = loras.length ? loras.map((l, i) => 
        '<div class="lora-item"><input type="checkbox" ' + (l.active ? 'checked' : '') + ' onchange="toggleLora(' + i + ')"><span style="flex:1">' + l.name + '</span><input type="number" value="' + l.weight + '" min="0" max="1" step="0.1" onchange="updateLoraWeight(' + i + ', this.value)"><button class="btn-sm btn-secondary" onclick="removeLora(' + i + ')">×</button></div>'
    ).join('') : '<p style="color:#666">No LoRAs</p>';
}

function toggleLora(i) { loras[i].active = !loras[i].active; saveLoras(); }
function updateLoraWeight(i, w) { loras[i].weight = parseFloat(w); saveLoras(); }
function removeLora(i) { loras.splice(i, 1); saveLoras(); }
function saveLoras() { localStorage.setItem('sdproxy_loras', JSON.stringify(loras)); renderLoras(); }

function addManualLora() {
    const id = $('loraId').value.trim();
    const weight = parseFloat($('loraWeight').value);
    if (!id) return alert('Enter LoRA ID');
    loras.push({ id, name: id, weight, active: true });
    saveLoras();
    $('loraId').value = '';
}

async function addCivitaiLora() {
    const url = $('loraUrl').value.trim();
    if (!url) return alert('Enter Civitai URL or ID');
    
    let modelId = url;
    const match = url.match(/models\\/([0-9]+)/);
    if (match) modelId = match[1];
    
    try {
        const res = await fetch('https://civitai.com/api/v1/models/' + modelId);
        const data = await res.json();
        if (data.modelVersions?.[0]) {
            const v = data.modelVersions[0];
            loras.push({
                id: v.id.toString(),
                name: data.name,
                weight: 0.7,
                active: true,
                civitai: { modelId: data.id, versionId: v.id, downloadUrl: v.downloadUrl }
            });
            saveLoras();
            alert('Added: ' + data.name);
        }
    } catch (e) {
        alert('Failed to load: ' + e.message);
    }
    $('loraUrl').value = '';
}

async function loadCivitaiModel() {
    const url = $('civitaiUrl').value.trim();
    if (!url) return;
    
    let modelId = url;
    const match = url.match(/models\\/([0-9]+)/);
    if (match) modelId = match[1];
    
    try {
        const res = await fetch('https://civitai.com/api/v1/models/' + modelId);
        const data = await res.json();
        $('civitaiInfo').innerHTML = '<div style="background:#0f0f23;padding:12px;border-radius:6px"><strong>' + data.name + '</strong><br><span style="color:#888">' + data.type + ' • ' + (data.modelVersions?.[0]?.baseModel || 'Unknown') + '</span><br><a href="' + (data.modelVersions?.[0]?.downloadUrl || '#') + '" target="_blank" style="color:#e94560">Download Link</a></div>';
    } catch (e) {
        $('civitaiInfo').innerHTML = '<p style="color:#e94560">Failed: ' + e.message + '</p>';
    }
}

async function refreshModels() {
    const backend = $('backend').value;
    $('modelsDisplay').textContent = 'Loading...';
    
    try {
        if (backend === 'local') {
            const res = await fetch($('localUrl').value + '/sdapi/v1/sd-models');
            const models = await res.json();
            $('modelList').innerHTML = models.map(m => '<option value="' + m.title + '">').join('');
            $('modelsDisplay').innerHTML = models.map(m => '<div style="padding:4px 0;border-bottom:1px solid #333">' + m.model_name + '</div>').join('');
        } else {
            $('modelsDisplay').textContent = 'Model list not available for this backend';
        }
    } catch (e) {
        $('modelsDisplay').textContent = 'Error: ' + e.message;
    }
}

async function fetchModels() {
    const backend = $('backend').value;
    let url;
    let headers = { 'Content-Type': 'application/json' };
    const apiKey = $('apiKey').value;
    if (apiKey) headers['Authorization'] = 'Bearer ' + apiKey;
    
    try {
        if (backend === 'local') {
            url = $('localUrl').value + '/sdapi/v1/sd-models';
            const res = await fetch(url);
            const models = await res.json();
            $('modelList').innerHTML = models.map(m => '<option value="' + m.title + '">').join('');
        } else if (backend === 'custom') {
            url = $('customUrl').value.replace(/\\/images\\/generations.*/, '/models').replace(/\\/chat\\/completions.*/, '/models');
            const res = await fetch(url, { headers });
            const data = await res.json();
            const models = data.data || data.models || data;
            $('modelList').innerHTML = (Array.isArray(models) ? models : []).map(m => '<option value="' + (m.id || m.name || m) + '">').join('');
        } else {
            $('modelList').innerHTML = '';
        }
    } catch (e) {
        alert('Failed to fetch models: ' + e.message);
    }
}

loadSettings();
renderHistory();
renderLoras();
onBackendChange();
</script>
</body></html>`));

// Backend handlers
const backends = {
    async local(body, headers) {
        const url = headers['x-local-url'] || 'http://127.0.0.1:7860';
        const payload = {
            prompt: body.prompt,
            negative_prompt: body.negative_prompt,
            width: body.width || 512,
            height: body.height || 768,
            steps: body.steps || 20,
            cfg_scale: body.cfg_scale || 7,
            sampler_name: body.sampler || 'Euler a',
            seed: body.seed || -1,
            batch_size: body.n || 1
        };
        
        const res = await fetch(`${url}/sdapi/v1/txt2img`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        return { data: (data.images || []).map(b64 => ({ b64_json: b64 })) };
    },
    
    async pollinations(body) {
        const params = new URLSearchParams({
            width: body.width || 512,
            height: body.height || 768,
            seed: body.seed > 0 ? body.seed : Math.floor(Math.random() * 999999),
            nologo: 'true'
        });
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(body.prompt)}?${params}`;
        return { data: [{ url }] };
    },
    
    async nanogpt(body, headers) {
        const apiKey = headers.authorization?.replace('Bearer ', '');
        if (!apiKey) throw new Error('NanoGPT requires API key');
        
        const res = await fetch('https://nano-gpt.com/api/v1/images/generations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                prompt: body.prompt,
                model: body.model || 'flux-schnell',
                n: body.n || 1
            })
        });
        return await res.json();
    },
    
    async pixai(body, headers) {
        const apiKey = headers.authorization?.replace('Bearer ', '');
        if (!apiKey) throw new Error('PixAI requires API key');
        
        const params = {
            prompts: body.prompt,
            modelId: body.model || '1648918127446573124',
            width: body.width || 512,
            height: body.height || 768,
            batchSize: Math.min(body.n || 1, 4)
        };
        if (body.negative_prompt) params.negativePrompts = body.negative_prompt;
        if (body.steps) params.samplingSteps = body.steps;
        if (body.cfg_scale) params.cfgScale = body.cfg_scale;
        if (body.sampler) params.samplingMethod = body.sampler;
        if (body.seed >= 0) params.seed = body.seed;
        
        if (body.loras?.length) {
            params.lora = {};
            body.loras.forEach(l => { params.lora[l.id] = l.weight || 0.7; });
        }
        
        const createRes = await fetch('https://api.pixai.art/v1/task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ parameters: params })
        });
        const createData = await createRes.json();
        if (!createData.id) throw new Error(createData.message || 'Failed');
        
        for (let i = 0; i < 60; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const statusRes = await fetch(`https://api.pixai.art/v1/task/${createData.id}`, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            const task = await statusRes.json();
            if (task.status === 'completed' && task.outputs?.mediaUrls?.length) {
                return { data: task.outputs.mediaUrls.filter(u => u).map(url => ({ url })) };
            }
            if (task.status === 'failed') throw new Error('Generation failed');
        }
        throw new Error('Timeout');
    }
};

// Main generation endpoint
app.post('/v1/images/generations', async (req, res) => {
    try {
        const backend = req.headers['x-backend'] || 'local';
        const handler = backends[backend];
        if (!handler) throw new Error('Unknown backend: ' + backend);
        
        const result = await handler(req.body, req.headers);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Chat completions with image generation (for ST extension compatibility)
app.post('/v1/chat/completions', async (req, res) => {
    const { messages, model } = req.body;
    const lastMsg = messages?.[messages.length - 1]?.content || '';
    
    // Check if it's an image generation request
    if (lastMsg.toLowerCase().includes('generate') || lastMsg.toLowerCase().includes('draw') || lastMsg.toLowerCase().includes('create image')) {
        try {
            const backend = req.headers['x-backend'] || 'pollinations';
            const result = await backends[backend]({ prompt: lastMsg, n: 1 }, req.headers);
            const imageUrl = result.data?.[0]?.url || result.data?.[0]?.b64_json;
            
            res.json({
                choices: [{
                    message: {
                        role: 'assistant',
                        content: imageUrl ? `![Generated Image](${imageUrl})` : 'Failed to generate image'
                    }
                }]
            });
        } catch (e) {
            res.json({ choices: [{ message: { role: 'assistant', content: 'Error: ' + e.message } }] });
        }
    } else {
        res.status(400).json({ error: 'This endpoint is for image generation only' });
    }
});

// Models list
app.get('/v1/models', (req, res) => {
    res.json({
        data: [
            { id: 'local', name: 'Local A1111/ComfyUI' },
            { id: 'pollinations', name: 'Pollinations (Free)' },
            { id: 'nanogpt', name: 'NanoGPT' },
            { id: 'pixai', name: 'PixAI' }
        ]
    });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`SD Proxy running on http://localhost:${PORT}`));

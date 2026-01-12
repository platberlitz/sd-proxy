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
body{font-family:-apple-system,system-ui,sans-serif;background:#0d1a0d;color:#c8d6c8;min-height:100vh;padding:12px;font-size:13px}
.container{max-width:1000px;margin:0 auto}
h1{color:#4ade80;font-size:18px;margin-bottom:8px}
.tabs{display:flex;gap:4px;margin-bottom:12px}
.tab{padding:6px 14px;background:#1a2e1a;border:1px solid #2d4a2d;color:#8fbc8f;cursor:pointer;border-radius:4px;font-size:12px}
.tab:hover{background:#243824}.tab.active{background:#2d5a2d;color:#4ade80;border-color:#4ade80}
.tab-content{display:none}.tab-content.active{display:block}
.card{background:#142014;border:1px solid #2d4a2d;padding:12px;border-radius:6px;margin-bottom:10px}
label{display:block;margin:8px 0 2px;color:#6b8e6b;font-size:11px;text-transform:uppercase;letter-spacing:0.5px}
input,select,textarea{width:100%;padding:6px 8px;background:#0d1a0d;border:1px solid #2d4a2d;border-radius:4px;color:#c8d6c8;font-size:13px}
input:focus,select:focus,textarea:focus{outline:none;border-color:#4ade80}
textarea{min-height:60px;resize:vertical;font-family:inherit}
button{padding:6px 14px;background:#2d5a2d;border:1px solid #4ade80;color:#4ade80;border-radius:4px;cursor:pointer;font-size:12px}
button:hover{background:#3d6a3d}button:disabled{opacity:0.4;cursor:not-allowed}
.btn-primary{background:#4ade80;color:#0d1a0d;font-weight:600}
.btn-primary:hover{background:#6bee9a}
.btn-sm{padding:3px 8px;font-size:11px}
.row{display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px}
.row-4{grid-template-columns:repeat(4,1fr)}
.result{margin-top:12px}
.img-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px}
.img-card{background:#1a2e1a;padding:6px;border-radius:4px;text-align:center}
.img-card img{width:100%;border-radius:3px;cursor:pointer}
.img-card a{color:#4ade80;font-size:11px}
.modal{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:9999;justify-content:center;align-items:center}
.modal img{max-width:95%;max-height:95%;object-fit:contain}
.modal.show{display:flex}
.history-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:6px;max-height:300px;overflow-y:auto}
.history-item{background:#1a2e1a;padding:4px;border-radius:4px;cursor:pointer}
.history-item img{width:100%;border-radius:3px}
.lora-list{max-height:150px;overflow-y:auto;background:#0d1a0d;border:1px solid #2d4a2d;border-radius:4px;padding:6px;margin-top:6px}
.lora-item{display:flex;align-items:center;gap:6px;padding:4px;border-bottom:1px solid #1a2e1a;font-size:12px}
.lora-item:last-child{border:none}
.lora-item input[type=checkbox]{width:auto}
.lora-item input[type=number]{width:50px}
.flex{display:flex;gap:8px;align-items:center}
.mt{margin-top:10px}
code{background:#1a2e1a;padding:8px;border-radius:4px;display:block;font-size:11px;color:#8fbc8f}
#status{font-size:12px;padding:6px 0}
</style>
</head><body>
<div class="container">
<h1>🎨 SD Proxy</h1>

<div class="tabs">
<button class="tab active" onclick="showTab('generate')">Generate</button>
<button class="tab" onclick="showTab('models')">Models</button>
<button class="tab" onclick="showTab('loras')">LoRAs</button>
<button class="tab" onclick="showTab('history')">History</button>
<button class="tab" onclick="showTab('settings')">Settings</button>
</div>

<div id="tab-generate" class="tab-content active">
<div class="card">
<div class="row">
<div><label>Backend</label>
<select id="backend" onchange="onBackendChange()">
<option value="local">Local A1111</option>
<option value="comfyui">Local ComfyUI</option>
<option value="pollinations">Pollinations (Free)</option>
<option value="nanogpt">NanoGPT</option>
<option value="pixai">PixAI</option>
<option value="custom">Custom</option>
</select></div>
<div><label>API Key</label><input type="password" id="apiKey" placeholder="If required"></div>
<div><label>Model <button class="btn-sm" onclick="fetchModels()" style="float:right">↻</button></label>
<input id="model" list="modelList" placeholder="Type or fetch">
<datalist id="modelList"></datalist></div>
</div>

<div id="customEndpoint" style="display:none;margin-top:8px">
<label>Custom URL</label>
<input id="customUrl" placeholder="https://api.example.com/v1">
</div>

<label>Prompt</label>
<textarea id="prompt" placeholder="Describe your image...">masterpiece, best quality, highly detailed, absurdres, ultra-detailed, intricate details, sharp focus, </textarea>

<label>Negative Prompt</label>
<textarea id="negative" rows="3">lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry, artist name, deformed, disfigured, mutation, mutated, ugly, disgusting, amputation, bad proportions, gross proportions, malformed limbs, missing arms, missing legs, extra arms, extra legs, fused fingers, too many fingers, long neck, out of frame, duplicate, morbid, mutilated</textarea>

<div class="row row-4">
<div><label>Width</label><input type="number" id="width" value="512" step="64"></div>
<div><label>Height</label><input type="number" id="height" value="768" step="64"></div>
<div><label>Steps</label><input type="number" id="steps" value="25"></div>
<div><label>CFG</label><input type="number" id="cfg" value="7" step="0.5"></div>
</div>

<div class="row row-4">
<div><label>Sampler</label>
<select id="sampler">
<option value="euler_ancestral">Euler a</option>
<option value="euler">Euler</option>
<option value="dpmpp_2m" selected>DPM++ 2M</option>
<option value="dpmpp_sde">DPM++ SDE</option>
<option value="ddim">DDIM</option>
<option value="uni_pc">UniPC</option>
</select></div>
<div><label>Scheduler</label>
<select id="scheduler">
<option value="karras" selected>Karras</option>
<option value="normal">Normal</option>
<option value="exponential">Exponential</option>
<option value="sgm_uniform">SGM Uniform</option>
</select></div>
<div><label>Seed</label><input type="number" id="seed" value="-1"></div>
<div><label>Batch</label><input type="number" id="batch" value="1" min="1" max="4"></div>
</div>

<div id="loraSection" class="mt">
<label>Active LoRAs</label>
<div id="activeLoraList" style="font-size:12px;color:#6b8e6b">None</div>
</div>

<div class="flex mt">
<button onclick="generate()" id="genBtn" class="btn-primary">Generate</button>
<button onclick="addToQueue()">+ Queue</button>
</div>
<div id="status"></div>
</div>

<div class="result" id="result"></div>
</div>

<div id="tab-models" class="tab-content">
<div class="card">
<label>Civitai Model URL</label>
<div class="flex">
<input id="civitaiUrl" placeholder="https://civitai.com/models/12345" style="flex:1">
<button onclick="loadCivitaiModel()" class="btn-sm">Load</button>
</div>
<div id="civitaiInfo" class="mt"></div>

<label class="mt">Backend Models</label>
<div id="modelsDisplay" style="color:#6b8e6b;font-size:12px">Click refresh after selecting backend</div>
<button onclick="refreshModels()" class="btn-sm mt">Refresh</button>
</div>
</div>

<div id="tab-loras" class="tab-content">
<div class="card">
<label>Add from Civitai</label>
<div class="flex">
<input id="loraUrl" placeholder="Civitai LoRA URL" style="flex:1">
<button onclick="addCivitaiLora()" class="btn-sm">Add</button>
</div>

<label class="mt">Manual LoRA</label>
<div class="flex">
<input id="loraId" placeholder="LoRA ID" style="flex:1">
<input id="loraWeight" type="number" value="0.7" min="0" max="1" step="0.1" style="width:60px">
<button onclick="addManualLora()" class="btn-sm">Add</button>
</div>

<label class="mt">Your LoRAs</label>
<div id="loraList" class="lora-list">No LoRAs</div>
</div>
</div>

<div id="tab-history" class="tab-content">
<div class="card">
<div id="historyGrid" class="history-grid"></div>
<button onclick="clearHistory()" class="btn-sm mt">Clear</button>
</div>
</div>

<div id="tab-settings" class="tab-content">
<div class="card">
<label>Local A1111 URL</label>
<input id="localUrl" value="http://127.0.0.1:7860" onchange="saveSettings()">

<label>ComfyUI URL</label>
<input id="comfyUrl" value="http://127.0.0.1:8188" onchange="saveSettings()">

<label>Default Quality Tags</label>
<input id="qualityTags" value="masterpiece, best quality, highly detailed, absurdres, ultra-detailed, intricate details, sharp focus, " onchange="saveSettings()">

<label class="mt">API Endpoints</label>
<code>POST /v1/images/generations<br>POST /v1/chat/completions<br>GET /v1/models</code>
</div>
</div>

<div class="modal" id="modal" onclick="this.classList.remove('show')"><img id="modalImg"></div>
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
    const b = $('backend').value;
    $('customEndpoint').style.display = b === 'custom' ? 'block' : 'none';
    $('loraSection').style.display = ['local', 'comfyui', 'pixai'].includes(b) ? 'block' : 'none';
}

function saveSettings() {
    settings = { localUrl: $('localUrl').value, comfyUrl: $('comfyUrl').value, qualityTags: $('qualityTags').value };
    localStorage.setItem('sdproxy_settings', JSON.stringify(settings));
}

function loadSettings() {
    if (settings.localUrl) $('localUrl').value = settings.localUrl;
    if (settings.comfyUrl) $('comfyUrl').value = settings.comfyUrl;
    if (settings.qualityTags) $('qualityTags').value = settings.qualityTags;
}

async function generate() {
    const btn = $('genBtn');
    const status = $('status');
    btn.disabled = true;
    status.textContent = '⏳ Generating...';
    
    try {
        const backend = $('backend').value;
        const body = {
            prompt: $('prompt').value,
            negative_prompt: $('negative').value,
            width: parseInt($('width').value),
            height: parseInt($('height').value),
            steps: parseInt($('steps').value),
            cfg_scale: parseFloat($('cfg').value),
            sampler: $('sampler').value,
            scheduler: $('scheduler').value,
            seed: parseInt($('seed').value),
            n: parseInt($('batch').value),
            model: $('model').value,
            loras: loras.filter(l => l.active).map(l => ({ id: l.id, weight: l.weight }))
        };
        if (body.seed < 0) delete body.seed;
        if (!body.loras.length) delete body.loras;
        
        let headers = { 'Content-Type': 'application/json', 'X-Backend': backend };
        if ($('apiKey').value) headers['Authorization'] = 'Bearer ' + $('apiKey').value;
        if (backend === 'local') headers['X-Local-Url'] = $('localUrl').value;
        if (backend === 'comfyui') headers['X-Local-Url'] = $('comfyUrl').value;
        if (backend === 'custom') headers['X-Custom-Url'] = $('customUrl').value;
        
        const res = await fetch('/v1/images/generations', { method: 'POST', headers, body: JSON.stringify(body) });
        const data = await res.json();
        
        if (data.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
        
        if (data.data?.length) {
            const urls = data.data.map(d => d.url || (d.b64_json?.startsWith('data:') ? d.b64_json : 'data:image/png;base64,' + d.b64_json));
            status.textContent = '✅ Done';
            $('result').innerHTML = '<div class="img-grid">' + urls.map(u => 
                '<div class="img-card"><img src="' + u + '" onclick="showModal(this.src)"><a href="' + u + '" download>Save</a></div>'
            ).join('') + '</div>';
            addToHistory(urls, body.prompt);
        } else throw new Error('No images');
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
    let headers = { 'Content-Type': 'application/json' };
    const apiKey = $('apiKey').value;
    if (apiKey) headers['Authorization'] = 'Bearer ' + apiKey;
    
    try {
        if (backend === 'local') {
            const res = await fetch('/proxy/models?url=' + encodeURIComponent($('localUrl').value + '/sdapi/v1/sd-models'));
            const models = await res.json();
            $('modelList').innerHTML = (models.data || models).map(m => '<option value="' + (m.title || m.id || m) + '">').join('');
        } else if (backend === 'custom') {
            let baseUrl = $('customUrl').value.replace(/\\/images\\/generations.*/, '').replace(/\\/chat\\/completions.*/, '');
            if (!baseUrl.endsWith('/models')) baseUrl = baseUrl.replace(/\\/$/, '') + '/models';
            const res = await fetch('/proxy/models?url=' + encodeURIComponent(baseUrl) + '&key=' + encodeURIComponent(apiKey));
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
        const samplerMap = { euler_ancestral: 'Euler a', euler: 'Euler', dpmpp_2m: 'DPM++ 2M', dpmpp_sde: 'DPM++ SDE', ddim: 'DDIM', uni_pc: 'UniPC' };
        const payload = {
            prompt: body.prompt,
            negative_prompt: body.negative_prompt,
            width: body.width || 512,
            height: body.height || 768,
            steps: body.steps || 25,
            cfg_scale: body.cfg_scale || 7,
            sampler_name: samplerMap[body.sampler] || body.sampler || 'DPM++ 2M',
            scheduler: body.scheduler || 'karras',
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
    
    async comfyui(body, headers) {
        const url = headers['x-local-url'] || 'http://127.0.0.1:8188';
        const seed = body.seed > 0 ? body.seed : Math.floor(Math.random() * 999999999);
        
        const workflow = {
            "3": { class_type: "KSampler", inputs: { seed, steps: body.steps || 25, cfg: body.cfg_scale || 7, sampler_name: body.sampler || "dpmpp_2m", scheduler: body.scheduler || "karras", denoise: 1, model: ["4", 0], positive: ["6", 0], negative: ["7", 0], latent_image: ["5", 0] }},
            "4": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: body.model || "v1-5-pruned-emaonly.safetensors" }},
            "5": { class_type: "EmptyLatentImage", inputs: { width: body.width || 512, height: body.height || 768, batch_size: body.n || 1 }},
            "6": { class_type: "CLIPTextEncode", inputs: { text: body.prompt, clip: ["4", 1] }},
            "7": { class_type: "CLIPTextEncode", inputs: { text: body.negative_prompt || "", clip: ["4", 1] }},
            "8": { class_type: "VAEDecode", inputs: { samples: ["3", 0], vae: ["4", 2] }},
            "9": { class_type: "SaveImage", inputs: { filename_prefix: "sdproxy", images: ["8", 0] }}
        };
        
        const queueRes = await fetch(`${url}/prompt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: workflow })
        });
        const { prompt_id } = await queueRes.json();
        if (!prompt_id) throw new Error('Failed to queue');
        
        for (let i = 0; i < 120; i++) {
            await new Promise(r => setTimeout(r, 1000));
            const histRes = await fetch(`${url}/history/${prompt_id}`);
            const hist = await histRes.json();
            if (hist[prompt_id]?.outputs?.["9"]?.images?.length) {
                const imgs = hist[prompt_id].outputs["9"].images;
                return { data: imgs.map(img => ({ url: `${url}/view?filename=${img.filename}&subfolder=${img.subfolder || ''}&type=${img.type || 'output'}` })) };
            }
        }
        throw new Error('Timeout');
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
    },
    
    async custom(body, headers) {
        let customUrl = headers['x-custom-url'];
        if (!customUrl) throw new Error('Custom URL required');
        
        // Default to chat/completions
        if (!customUrl.includes('/images/generations') && !customUrl.includes('/chat/completions')) {
            customUrl = customUrl.replace(/\/$/, '') + '/chat/completions';
        }
        
        const apiKey = headers.authorization?.replace('Bearer ', '');
        const reqHeaders = { 'Content-Type': 'application/json' };
        if (apiKey) reqHeaders['Authorization'] = `Bearer ${apiKey}`;
        
        // Convert to chat completions format
        const chatBody = {
            model: body.model || 'gpt-4o',
            messages: [{ role: 'user', content: body.prompt }]
        };
        
        const res = await fetch(customUrl, {
            method: 'POST',
            headers: reqHeaders,
            body: JSON.stringify(chatBody)
        });
        const data = await res.json();
        
        // Extract images from response
        const msg = data.choices?.[0]?.message || {};
        
        // Check for images array (Gemini format)
        if (msg.images?.length) {
            return { data: msg.images.map(img => ({ url: img.image_url?.url || img.url })) };
        }
        
        // Check for URLs in content
        const content = msg.content || '';
        const urls = content.match(/https?:\/\/[^\s\)]+\.(png|jpg|jpeg|webp|gif)/gi) || [];
        if (urls.length) {
            return { data: urls.map(url => ({ url })) };
        }
        
        throw new Error(content || JSON.stringify(data));
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
            { id: 'local', name: 'Local A1111' },
            { id: 'comfyui', name: 'Local ComfyUI' },
            { id: 'pollinations', name: 'Pollinations (Free)' },
            { id: 'nanogpt', name: 'NanoGPT' },
            { id: 'pixai', name: 'PixAI' }
        ]
    });
});

// Proxy for fetching models from external APIs (avoids CORS)
app.get('/proxy/models', async (req, res) => {
    const { url, key } = req.query;
    if (!url) return res.status(400).json({ error: 'url required' });
    
    try {
        const headers = { 'Content-Type': 'application/json' };
        if (key) headers['Authorization'] = `Bearer ${key}`;
        
        const response = await fetch(url, { headers });
        const data = await response.json();
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`SD Proxy running on http://localhost:${PORT}`));

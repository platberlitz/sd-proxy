const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const app = express();
app.use(express.json({ limit: '100mb' }));
app.use(express.static('public'));

// Data storage
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
const getDataFile = (name) => path.join(DATA_DIR, `${name}.json`);
const loadData = (name, def = []) => { try { return JSON.parse(fs.readFileSync(getDataFile(name))); } catch { return def; } };
const saveData = (name, data) => fs.writeFileSync(getDataFile(name), JSON.stringify(data, null, 2));

let queue = [];
let history = loadData('history', []);
let favorites = loadData('favorites', []);
let folders = loadData('folders', []);
let presets = loadData('presets', []);
let costs = loadData('costs', { total: 0, byBackend: {} });

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Methods', '*');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// Serve dashboard
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Backend handlers
const backends = {
    async local(body, headers) {
        const url = headers['x-local-url'] || 'http://127.0.0.1:7860';
        const samplerMap = { euler_ancestral: 'Euler a', euler: 'Euler', dpmpp_2m: 'DPM++ 2M', dpmpp_sde: 'DPM++ SDE', ddim: 'DDIM', uni_pc: 'UniPC' };
        
        const payload = {
            prompt: body.prompt,
            negative_prompt: body.negative_prompt || '',
            width: body.width || 512,
            height: body.height || 768,
            steps: body.steps || 25,
            cfg_scale: body.cfg_scale || 7,
            sampler_name: samplerMap[body.sampler] || body.sampler || 'DPM++ 2M',
            scheduler: body.scheduler || 'karras',
            seed: body.seed ?? -1,
            batch_size: body.n || 1,
            restore_faces: body.face_restore || false,
            enable_hr: body.hires_fix || false,
            hr_scale: body.hires_scale || 1.5,
            hr_upscaler: body.hires_upscaler || 'Latent',
            denoising_strength: body.denoising_strength || 0.7
        };
        
        // Img2Img
        if (body.init_image) {
            payload.init_images = [body.init_image];
            payload.denoising_strength = body.strength || 0.75;
            const res = await fetch(`${url}/sdapi/v1/img2img`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            return { data: (data.images || []).map(b64 => ({ b64_json: b64 })) };
        }
        
        // Inpainting
        if (body.mask) {
            payload.init_images = [body.init_image];
            payload.mask = body.mask;
            payload.inpainting_fill = body.inpaint_fill || 1;
            payload.inpaint_full_res = true;
            const res = await fetch(`${url}/sdapi/v1/img2img`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            return { data: (data.images || []).map(b64 => ({ b64_json: b64 })) };
        }
        
        const res = await fetch(`${url}/sdapi/v1/txt2img`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        return { data: (data.images || []).map(b64 => ({ b64_json: b64 })), info: data.info };
    },
    
    async comfyui(body, headers) {
        const url = headers['x-local-url'] || 'http://127.0.0.1:8188';
        const seed = body.seed > 0 ? body.seed : Math.floor(Math.random() * 999999999);
        
        const workflow = {
            "3": { class_type: "KSampler", inputs: { seed, steps: body.steps || 25, cfg: body.cfg_scale || 7, sampler_name: body.sampler || "dpmpp_2m", scheduler: body.scheduler || "karras", denoise: body.init_image ? (body.strength || 0.75) : 1, model: ["4", 0], positive: ["6", 0], negative: ["7", 0], latent_image: ["5", 0] }},
            "4": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: body.model || "v1-5-pruned-emaonly.safetensors" }},
            "5": { class_type: "EmptyLatentImage", inputs: { width: body.width || 512, height: body.height || 768, batch_size: body.n || 1 }},
            "6": { class_type: "CLIPTextEncode", inputs: { text: body.prompt, clip: ["4", 1] }},
            "7": { class_type: "CLIPTextEncode", inputs: { text: body.negative_prompt || "", clip: ["4", 1] }},
            "8": { class_type: "VAEDecode", inputs: { samples: ["3", 0], vae: ["4", 2] }},
            "9": { class_type: "SaveImage", inputs: { filename_prefix: "sdproxy", images: ["8", 0] }}
        };
        
        const queueRes = await fetch(`${url}/prompt`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
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
        const seed = body.seed > 0 ? body.seed : Math.floor(Math.random() * 999999);
        const params = new URLSearchParams({ width: body.width || 512, height: body.height || 768, seed, nologo: 'true' });
        if (body.model) params.set('model', body.model);
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(body.prompt)}?${params}`;
        return { data: [{ url }] };
    },
    
    async nanogpt(body, headers) {
        const apiKey = headers.authorization?.replace('Bearer ', '');
        if (!apiKey) throw new Error('NanoGPT requires API key');
        const res = await fetch('https://nano-gpt.com/api/v1/images/generations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ prompt: body.prompt, model: body.model || 'flux-schnell', n: body.n || 1 })
        });
        return await res.json();
    },
    
    async pixai(body, headers) {
        const apiKey = headers.authorization?.replace('Bearer ', '');
        if (!apiKey) throw new Error('PixAI requires API key');
        const params = { prompts: body.prompt, modelId: body.model || '1648918127446573124', width: body.width || 512, height: body.height || 768, batchSize: Math.min(body.n || 1, 4) };
        if (body.negative_prompt) params.negativePrompts = body.negative_prompt;
        if (body.steps) params.samplingSteps = body.steps;
        if (body.cfg_scale) params.cfgScale = body.cfg_scale;
        if (body.loras?.length) { params.lora = {}; body.loras.forEach(l => { params.lora[l.id] = l.weight || 0.7; }); }
        
        const createRes = await fetch('https://api.pixai.art/v1/task', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ parameters: params })
        });
        const createData = await createRes.json();
        if (!createData.id) throw new Error(createData.message || 'Failed');
        
        for (let i = 0; i < 60; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const statusRes = await fetch(`https://api.pixai.art/v1/task/${createData.id}`, { headers: { 'Authorization': `Bearer ${apiKey}` } });
            const task = await statusRes.json();
            if (task.status === 'completed' && task.outputs?.mediaUrls?.length) return { data: task.outputs.mediaUrls.filter(u => u).map(url => ({ url })) };
            if (task.status === 'failed') throw new Error('Generation failed');
        }
        throw new Error('Timeout');
    },
    
    async stability(body, headers) {
        const apiKey = headers.authorization?.replace('Bearer ', '');
        if (!apiKey) throw new Error('Stability AI requires API key');
        const res = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                text_prompts: [{ text: body.prompt, weight: 1 }, { text: body.negative_prompt || '', weight: -1 }],
                cfg_scale: body.cfg_scale || 7, steps: body.steps || 30, width: body.width || 1024, height: body.height || 1024, samples: body.n || 1
            })
        });
        const data = await res.json();
        return { data: (data.artifacts || []).map(a => ({ b64_json: a.base64 })) };
    },
    
    async replicate(body, headers) {
        const apiKey = headers.authorization?.replace('Bearer ', '');
        if (!apiKey) throw new Error('Replicate requires API key');
        const res = await fetch('https://api.replicate.com/v1/predictions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${apiKey}` },
            body: JSON.stringify({
                version: body.model || 'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
                input: { prompt: body.prompt, negative_prompt: body.negative_prompt, width: body.width || 1024, height: body.height || 1024, num_outputs: body.n || 1 }
            })
        });
        const pred = await res.json();
        for (let i = 0; i < 60; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const statusRes = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, { headers: { 'Authorization': `Token ${apiKey}` } });
            const status = await statusRes.json();
            if (status.status === 'succeeded') return { data: status.output.map(url => ({ url })) };
            if (status.status === 'failed') throw new Error(status.error || 'Failed');
        }
        throw new Error('Timeout');
    },
    
    async fal(body, headers) {
        const apiKey = headers.authorization?.replace('Bearer ', '');
        if (!apiKey) throw new Error('Fal.ai requires API key');
        const res = await fetch('https://fal.run/fal-ai/flux/schnell', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Key ${apiKey}` },
            body: JSON.stringify({ prompt: body.prompt, image_size: { width: body.width || 1024, height: body.height || 1024 }, num_images: body.n || 1 })
        });
        const data = await res.json();
        return { data: (data.images || []).map(img => ({ url: img.url })) };
    },
    
    async together(body, headers) {
        const apiKey = headers.authorization?.replace('Bearer ', '');
        if (!apiKey) throw new Error('Together AI requires API key');
        const res = await fetch('https://api.together.xyz/v1/images/generations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model: body.model || 'stabilityai/stable-diffusion-xl-base-1.0', prompt: body.prompt, negative_prompt: body.negative_prompt, width: body.width || 1024, height: body.height || 1024, n: body.n || 1, steps: body.steps || 20 })
        });
        return await res.json();
    },
    
    async custom(body, headers) {
        let customUrl = headers['x-custom-url'];
        if (!customUrl) throw new Error('Custom URL required');
        if (!customUrl.includes('/images/generations') && !customUrl.includes('/chat/completions')) customUrl = customUrl.replace(/\/$/, '') + '/chat/completions';
        const apiKey = headers.authorization?.replace('Bearer ', '');
        const reqHeaders = { 'Content-Type': 'application/json' };
        if (apiKey) reqHeaders['Authorization'] = `Bearer ${apiKey}`;
        const res = await fetch(customUrl, { method: 'POST', headers: reqHeaders, body: JSON.stringify({ model: body.model || 'gpt-4o', messages: [{ role: 'user', content: body.prompt }] }) });
        const data = await res.json();
        const msg = data.choices?.[0]?.message || {};
        if (msg.images?.length) return { data: msg.images.map(img => ({ url: img.image_url?.url || img.url })) };
        const content = msg.content || '';
        const urls = content.match(/https?:\/\/[^\s\)]+\.(png|jpg|jpeg|webp|gif)/gi) || [];
        if (urls.length) return { data: urls.map(url => ({ url })) };
        throw new Error(content || JSON.stringify(data));
    }
};

// Upscale endpoint (A1111)
app.post('/api/upscale', async (req, res) => {
    try {
        const { image, scale, upscaler } = req.body;
        const url = req.headers['x-local-url'] || 'http://127.0.0.1:7860';
        const response = await fetch(`${url}/sdapi/v1/extra-single-image`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image, upscaling_resize: scale || 2, upscaler_1: upscaler || 'R-ESRGAN 4x+' })
        });
        const data = await response.json();
        res.json({ image: data.image });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Main generation endpoint
app.post('/v1/images/generations', async (req, res) => {
    try {
        const backend = req.headers['x-backend'] || 'local';
        const handler = backends[backend];
        if (!handler) throw new Error('Unknown backend: ' + backend);
        const result = await handler(req.body, req.headers);
        
        // Track costs
        const cost = req.body.cost || 0;
        if (cost > 0) {
            costs.total += cost;
            costs.byBackend[backend] = (costs.byBackend[backend] || 0) + cost;
            saveData('costs', costs);
        }
        
        // Add to history
        if (result.data?.length) {
            const entry = { id: Date.now(), prompt: req.body.prompt, negative: req.body.negative_prompt, params: req.body, images: result.data, backend, date: new Date().toISOString() };
            history.unshift(entry);
            history = history.slice(0, 500);
            saveData('history', history);
        }
        
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Queue endpoints
app.get('/api/queue', (req, res) => res.json(queue));
app.post('/api/queue', (req, res) => { queue.push({ id: Date.now(), ...req.body }); res.json({ success: true, length: queue.length }); });
app.delete('/api/queue/:id', (req, res) => { queue = queue.filter(q => q.id != req.params.id); res.json({ success: true }); });
app.post('/api/queue/process', async (req, res) => {
    if (!queue.length) return res.json({ message: 'Queue empty' });
    const results = [];
    while (queue.length) {
        const item = queue.shift();
        try {
            const handler = backends[item.backend || 'local'];
            const result = await handler(item, req.headers);
            results.push({ id: item.id, success: true, data: result.data });
        } catch (e) { results.push({ id: item.id, success: false, error: e.message }); }
    }
    res.json(results);
});

// History endpoints
app.get('/api/history', (req, res) => {
    const { search, folder, limit = 50, offset = 0 } = req.query;
    let filtered = history;
    if (search) filtered = filtered.filter(h => h.prompt?.toLowerCase().includes(search.toLowerCase()));
    if (folder) filtered = filtered.filter(h => h.folder === folder);
    res.json({ total: filtered.length, items: filtered.slice(offset, offset + limit) });
});
app.delete('/api/history/:id', (req, res) => { history = history.filter(h => h.id != req.params.id); saveData('history', history); res.json({ success: true }); });
app.delete('/api/history', (req, res) => { history = []; saveData('history', history); res.json({ success: true }); });

// Favorites endpoints
app.get('/api/favorites', (req, res) => res.json(favorites));
app.post('/api/favorites', (req, res) => { favorites.unshift({ id: Date.now(), ...req.body }); saveData('favorites', favorites); res.json({ success: true }); });
app.delete('/api/favorites/:id', (req, res) => { favorites = favorites.filter(f => f.id != req.params.id); saveData('favorites', favorites); res.json({ success: true }); });

// Folders endpoints
app.get('/api/folders', (req, res) => res.json(folders));
app.post('/api/folders', (req, res) => { folders.push({ id: Date.now(), name: req.body.name }); saveData('folders', folders); res.json({ success: true }); });
app.delete('/api/folders/:id', (req, res) => { folders = folders.filter(f => f.id != req.params.id); saveData('folders', folders); res.json({ success: true }); });
app.post('/api/history/:id/folder', (req, res) => {
    const item = history.find(h => h.id == req.params.id);
    if (item) { item.folder = req.body.folder; saveData('history', history); }
    res.json({ success: true });
});

// Presets endpoints
app.get('/api/presets', (req, res) => res.json(presets));
app.post('/api/presets', (req, res) => { presets.push({ id: Date.now(), ...req.body }); saveData('presets', presets); res.json({ success: true }); });
app.delete('/api/presets/:id', (req, res) => { presets = presets.filter(p => p.id != req.params.id); saveData('presets', presets); res.json({ success: true }); });

// Costs endpoint
app.get('/api/costs', (req, res) => res.json(costs));
app.delete('/api/costs', (req, res) => { costs = { total: 0, byBackend: {} }; saveData('costs', costs); res.json({ success: true }); });

// PNG metadata extraction
app.post('/api/metadata', (req, res) => {
    try {
        const { image } = req.body;
        const buffer = Buffer.from(image.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        // Simple PNG tEXt chunk extraction
        let params = {};
        const pngSig = buffer.slice(0, 8);
        let offset = 8;
        while (offset < buffer.length) {
            const len = buffer.readUInt32BE(offset);
            const type = buffer.slice(offset + 4, offset + 8).toString('ascii');
            if (type === 'tEXt' || type === 'iTXt') {
                const data = buffer.slice(offset + 8, offset + 8 + len).toString('utf8');
                const [key, ...val] = data.split('\0');
                if (key === 'parameters' || key === 'prompt') params.raw = val.join('');
            }
            offset += 12 + len;
            if (type === 'IEND') break;
        }
        res.json(params);
    } catch (e) { res.json({ error: e.message }); }
});

// Proxy for external APIs
app.get('/proxy/models', async (req, res) => {
    const { url, key } = req.query;
    if (!url) return res.status(400).json({ error: 'url required' });
    try {
        const headers = { 'Content-Type': 'application/json' };
        if (key) headers['Authorization'] = `Bearer ${key}`;
        const response = await fetch(url, { headers });
        res.json(await response.json());
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Models list
app.get('/v1/models', (req, res) => res.json({ data: Object.keys(backends).map(id => ({ id, name: id })) }));

// Chat completions (for compatibility)
app.post('/v1/chat/completions', async (req, res) => {
    const lastMsg = req.body.messages?.[req.body.messages.length - 1]?.content || '';
    try {
        const backend = req.headers['x-backend'] || 'pollinations';
        const result = await backends[backend]({ prompt: lastMsg, n: 1 }, req.headers);
        const imageUrl = result.data?.[0]?.url || result.data?.[0]?.b64_json;
        res.json({ choices: [{ message: { role: 'assistant', content: imageUrl ? `![Image](${imageUrl})` : 'Failed' } }] });
    } catch (e) { res.json({ choices: [{ message: { role: 'assistant', content: 'Error: ' + e.message } }] }); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`SD Proxy running on http://localhost:${PORT}`));

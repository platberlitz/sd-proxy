const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const session = require('express-session');
const app = express();

// Auth config
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin';

app.use(express.json({ limit: '100mb' }));
app.use(session({ secret: process.env.SESSION_SECRET || 'sd-proxy-secret', resave: false, saveUninitialized: false }));

// Auth middleware
function auth(req, res, next) {
    if (req.session.loggedIn) return next();
    if (req.path === '/login' || req.path.startsWith('/api/')) return next();
    res.redirect('/login');
}

// Login page
app.get('/login', (req, res) => res.send(`
<!DOCTYPE html><html><head><title>Login - SD Proxy</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{box-sizing:border-box}body{font-family:system-ui;background:#0d1a0d;color:#c8e6c9;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0}.card{background:#1a2e1a;padding:2rem;border-radius:12px;width:100%;max-width:360px;border:1px solid #2d5a2d}h1{margin:0 0 1.5rem;text-align:center;color:#4caf50}input{width:100%;padding:12px;margin:8px 0;border:1px solid #2d5a2d;border-radius:6px;background:#0d1a0d;color:#c8e6c9}button{width:100%;padding:12px;background:#4caf50;border:none;border-radius:6px;color:#fff;font-size:16px;cursor:pointer;margin-top:12px}button:hover{background:#66bb6a}.error{color:#f44336;text-align:center;margin-top:8px}</style></head>
<body><div class="card"><h1>🎨 SD Proxy</h1><form method="POST" action="/login">
<input name="user" placeholder="Username" required>
<input name="pass" type="password" placeholder="Password" required>
<button type="submit">Login</button>
${req.query.error ? '<p class="error">Invalid credentials</p>' : ''}
</form></div></body></html>`));

app.post('/login', express.urlencoded({ extended: true }), (req, res) => {
    if (req.body.user === ADMIN_USER && req.body.pass === ADMIN_PASS) {
        req.session.loggedIn = true;
        res.redirect('/');
    } else res.redirect('/login?error=1');
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });

app.use(auth);
app.use(express.static('public'));

// Data storage
const DATA_DIR = path.join(__dirname, 'data');
const MODELS_DIR = path.join(__dirname, 'models');
[DATA_DIR, MODELS_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d); });
const getDataFile = (name) => path.join(DATA_DIR, `${name}.json`);
const loadData = (name, def = []) => { try { return JSON.parse(fs.readFileSync(getDataFile(name))); } catch { return def; } };
const saveData = (name, data) => fs.writeFileSync(getDataFile(name), JSON.stringify(data, null, 2));

let queue = [];
let history = loadData('history', []);
let favorites = loadData('favorites', []);
let folders = loadData('folders', []);
let presets = loadData('presets', []);
let templates = loadData('templates', []);
let costs = loadData('costs', { total: 0, byBackend: {} });
let currentGeneration = null; // For progress tracking

// SSE clients with session isolation
let sseClients = new Map(); // sessionId -> { progress: res, logs: res }

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

// Session endpoint - get unique session ID
app.get('/api/session', (req, res) => {
    const sessionId = crypto.randomUUID();
    res.json({ sessionId });
});

// Progress SSE endpoint (session-isolated)
app.get('/api/progress/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (!sseClients.has(sessionId)) sseClients.set(sessionId, {});
    sseClients.get(sessionId).progress = res;
    req.on('close', () => { if (sseClients.has(sessionId)) { delete sseClients.get(sessionId).progress; if (!Object.keys(sseClients.get(sessionId)).length) sseClients.delete(sessionId); } });
});

// Logs SSE endpoint (session-isolated)
app.get('/api/logs/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (!sseClients.has(sessionId)) sseClients.set(sessionId, {});
    sseClients.get(sessionId).logs = res;
    req.on('close', () => { if (sseClients.has(sessionId)) { delete sseClients.get(sessionId).logs; if (!Object.keys(sseClients.get(sessionId)).length) sseClients.delete(sessionId); } });
});

function sendProgress(sessionId, data) {
    const client = sseClients.get(sessionId);
    if (client?.progress) client.progress.write(`data: ${JSON.stringify(data)}\n\n`);
}

function log(sessionId, message, level = 'info') {
    const entry = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`;
    console.log(entry);
    const client = sseClients.get(sessionId);
    if (client?.logs) client.logs.write(`data: ${JSON.stringify({ message, level })}\n\n`);
}

// Prompt matrix expansion: [a|b] [c|d] -> 4 prompts
function expandMatrix(prompt) {
    const matches = prompt.match(/\[([^\]]+)\]/g);
    if (!matches) return [prompt];
    const options = matches.map(m => m.slice(1, -1).split('|'));
    const combinations = options.reduce((acc, opts) => acc.flatMap(a => opts.map(o => [...a, o])), [[]]);
    return combinations.map(combo => {
        let result = prompt;
        matches.forEach((m, i) => { result = result.replace(m, combo[i]); });
        return result;
    });
}

// Wildcard expansion: {a|b|c} -> random pick
function expandWildcards(text) {
    return text.replace(/\{([^}]+)\}/g, (m, p) => {
        const opts = p.split('|');
        return opts[Math.floor(Math.random() * opts.length)];
    });
}

// Backend handlers
const backends = {
    async local(body, headers, sessionId) {
        const url = headers['x-local-url'] || 'http://127.0.0.1:7860';
        
        // A1111 sampler names - scheduler is part of sampler name
        const getSamplerName = (sampler, scheduler) => {
            const base = {
                'euler_ancestral': 'Euler a', 'euler': 'Euler',
                'dpmpp_2m': 'DPM++ 2M', 'dpmpp_2m_sde': 'DPM++ 2M SDE',
                'dpmpp_2s_ancestral': 'DPM++ 2S a', 'dpmpp_sde': 'DPM++ SDE',
                'dpm_2': 'DPM2', 'dpm_2_ancestral': 'DPM2 a',
                'heun': 'Heun', 'lms': 'LMS', 'ddim': 'DDIM', 'ddpm': 'DDPM',
                'uni_pc': 'UniPC', 'lcm': 'LCM'
            }[sampler] || sampler || 'DPM++ 2M';
            // Append scheduler suffix if not normal
            if (scheduler === 'karras') return base + ' Karras';
            if (scheduler === 'exponential') return base + ' Exponential';
            return base;
        };
        
        const payload = {
            prompt: expandWildcards(body.prompt),
            negative_prompt: body.negative_prompt || '',
            width: body.width || 512,
            height: body.height || 768,
            steps: body.steps || 25,
            cfg_scale: body.cfg_scale || 7,
            sampler_name: getSamplerName(body.sampler, body.scheduler),
            seed: body.seed ?? -1,
            batch_size: body.n || 1,
            restore_faces: body.face_restore || false,
            tiling: body.tiling || false
        };
        
        // Hires fix
        if (body.hires_fix) {
            payload.enable_hr = true;
            payload.hr_scale = body.hires_scale || 1.5;
            payload.hr_upscaler = body.hires_upscaler || 'Latent';
            payload.denoising_strength = body.denoising_strength || 0.7;
            payload.hr_second_pass_steps = body.hr_second_pass_steps || 0;
        }
        
        // ControlNet
        if (body.controlnet) {
            payload.alwayson_scripts = {
                controlnet: {
                    args: [{
                        enabled: true,
                        module: body.controlnet.preprocessor || 'none',
                        model: body.controlnet.model || 'control_v11p_sd15_canny',
                        weight: body.controlnet.weight || 1,
                        image: body.controlnet.image,
                        guidance_start: body.controlnet.guidance_start || 0,
                        guidance_end: body.controlnet.guidance_end || 1
                    }]
                }
            };
        }
        
        // Regional prompting (via BREAK keyword)
        if (body.regional_prompts?.length) {
            payload.prompt = body.regional_prompts.map(r => r.prompt).join(' BREAK ');
        }
        
        // Img2Img
        if (body.init_image && !body.mask) {
            payload.init_images = [body.init_image];
            payload.denoising_strength = body.strength || 0.75;
            payload.resize_mode = body.resize_mode || 0;
            const res = await fetch(`${url}/sdapi/v1/img2img`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            return { data: (data.images || []).map(b64 => ({ b64_json: b64 })), info: data.info };
        }
        
        // Inpainting
        if (body.mask) {
            payload.init_images = [body.init_image];
            payload.mask = body.mask;
            payload.inpainting_fill = body.inpaint_fill ?? 1;
            payload.inpaint_full_res = body.inpaint_full_res ?? true;
            payload.inpaint_full_res_padding = body.inpaint_padding || 32;
            payload.denoising_strength = body.strength || 0.75;
            const res = await fetch(`${url}/sdapi/v1/img2img`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            return { data: (data.images || []).map(b64 => ({ b64_json: b64 })), info: data.info };
        }
        
        // Outpainting
        if (body.outpaint) {
            payload.init_images = [body.init_image];
            payload.script_name = 'outpainting mk2';
            payload.script_args = [body.outpaint.pixels || 128, body.outpaint.direction || 'left,right,up,down'];
            const res = await fetch(`${url}/sdapi/v1/img2img`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            return { data: (data.images || []).map(b64 => ({ b64_json: b64 })), info: data.info };
        }
        
        // Track progress
        currentGeneration = { backend: 'local', startTime: Date.now() };
        const progressInterval = setInterval(async () => {
            try {
                const progRes = await fetch(`${url}/sdapi/v1/progress`);
                const prog = await progRes.json();
                sendProgress(sessionId, { type: 'generation', progress: prog.progress, eta: prog.eta_relative, preview: prog.current_image });
            } catch {}
        }, 1000);
        
        try {
            const res = await fetch(`${url}/sdapi/v1/txt2img`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            return { data: (data.images || []).map(b64 => ({ b64_json: b64 })), info: data.info };
        } finally {
            clearInterval(progressInterval);
            currentGeneration = null;
            sendProgress(sessionId, { type: 'generation', progress: 1, done: true });
        }
    },
    
    async comfyui(body, headers, sessionId) {
        const url = headers['x-local-url'] || 'http://127.0.0.1:8188';
        
        // User must provide workflow JSON exported from ComfyUI
        if (!body.workflow) throw new Error('ComfyUI requires workflow JSON. Export from ComfyUI: Save (API Format)');
        
        let workflow = typeof body.workflow === 'string' ? JSON.parse(body.workflow) : body.workflow;
        
        // Replace placeholders in workflow if provided
        const replacements = {
            '%prompt%': body.prompt || '',
            '%negative%': body.negative_prompt || '',
            '%seed%': body.seed > 0 ? body.seed : Math.floor(Math.random() * 999999999),
            '%width%': body.width || 512,
            '%height%': body.height || 768,
            '%steps%': body.steps || 25,
            '%cfg%': body.cfg_scale || 7
        };
        
        // Deep replace placeholders in workflow
        const replaceInObj = (obj) => {
            for (const key in obj) {
                if (typeof obj[key] === 'string') {
                    for (const [placeholder, value] of Object.entries(replacements)) {
                        obj[key] = obj[key].replace(placeholder, value);
                    }
                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    replaceInObj(obj[key]);
                }
            }
        };
        replaceInObj(workflow);
        
        log(sessionId, `ComfyUI: Queueing workflow with ${Object.keys(workflow).length} nodes`);
        
        const queueRes = await fetch(`${url}/prompt`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: workflow })
        });
        const queueData = await queueRes.json();
        if (!queueData.prompt_id) throw new Error(queueData.error || 'Failed to queue workflow');
        
        log(sessionId, `ComfyUI: Queued as ${queueData.prompt_id}`);
        
        // Poll for completion
        for (let i = 0; i < 300; i++) {
            await new Promise(r => setTimeout(r, 1000));
            const histRes = await fetch(`${url}/history/${queueData.prompt_id}`);
            const hist = await histRes.json();
            const result = hist[queueData.prompt_id];
            if (result?.outputs) {
                // Find any SaveImage/PreviewImage outputs
                const images = [];
                for (const nodeId in result.outputs) {
                    const output = result.outputs[nodeId];
                    if (output.images?.length) {
                        for (const img of output.images) {
                            images.push({ url: `${url}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || '')}&type=${img.type || 'output'}` });
                        }
                    }
                }
                if (images.length) {
                    log(sessionId, `ComfyUI: Got ${images.length} images`);
                    return { data: images };
                }
            }
        }
        throw new Error('Timeout waiting for ComfyUI');
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
    
    async novelai(body, headers, sessionId) {
        const apiKey = headers.authorization?.replace('Bearer ', '');
        if (!apiKey) throw new Error('NovelAI requires API key');
        
        const nai = body.nai || {};
        const model = nai.model || 'nai-diffusion-4-5-curated';
        const params = {
            width: body.width || 832,
            height: body.height || 1216,
            n_samples: body.n || 1,
            seed: body.seed ?? Math.floor(Math.random() * 2147483647),
            sampler: nai.sampler || 'k_euler_ancestral',
            steps: nai.steps || 28,
            scale: nai.scale || 5,
            cfg_rescale: nai.cfg_rescale || 0,
            noise_schedule: nai.noise_schedule || 'native',
            uc_preset: nai.uc_preset ?? 0,
            uncond_scale: nai.uncond_scale || 1,
            negative_prompt: body.negative_prompt || '',
            sm: nai.smea || false,
            sm_dyn: nai.smea_dyn || false,
            decrisper: nai.decrisper || false,
            quality_toggle: nai.quality_toggle !== false,
            variety_plus: nai.variety_plus || false
        };
        
        log(sessionId, `NovelAI request: model=${model}, ${params.width}x${params.height}, steps=${params.steps}`);
        
        const res = await fetch('https://image.novelai.net/ai/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                input: body.prompt,
                model: model,
                action: 'generate',
                parameters: params
            })
        });
        
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`NovelAI error ${res.status}: ${errText}`);
        }
        
        // NovelAI returns a zip file with PNG images
        const zipBuffer = await res.arrayBuffer();
        const bytes = new Uint8Array(zipBuffer);
        
        // Find PNG signatures in the zip
        const images = [];
        for (let i = 0; i < bytes.length - 8; i++) {
            if (bytes[i] === 0x89 && bytes[i+1] === 0x50 && bytes[i+2] === 0x4E && bytes[i+3] === 0x47) {
                // Find PNG end
                let end = i + 8;
                while (end < bytes.length - 8) {
                    if (bytes[end] === 0x49 && bytes[end+1] === 0x45 && bytes[end+2] === 0x4E && bytes[end+3] === 0x44) {
                        end += 8; // Include IEND chunk
                        break;
                    }
                    end++;
                }
                const pngData = bytes.slice(i, end);
                const b64 = Buffer.from(pngData).toString('base64');
                images.push({ b64_json: b64 });
                i = end - 1;
            }
        }
        
        log(sessionId, `NovelAI returned ${images.length} image(s)`);
        return { data: images };
    },
    
    async gemini(body, headers, sessionId) {
        const apiKey = headers.authorization?.replace('Bearer ', '');
        if (!apiKey) throw new Error('Gemini requires API key');
        
        const opts = body.gemini || {};
        const model = opts.model || 'gemini-2.5-flash-image';
        
        // Build parts array with reference images and prompt
        const parts = [];
        if (body.reference_images?.length) {
            log(sessionId, `Adding ${body.reference_images.length} reference images`);
            for (const img of body.reference_images) {
                const match = img.match(/^data:([^;]+);base64,(.+)$/);
                if (match) {
                    parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
                }
            }
        }
        parts.push({ text: body.prompt });
        
        log(sessionId, `Gemini request: model=${model}, prompt=${(body.prompt || '').substring(0, 50)}...`);
        
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts }],
                generationConfig: {
                    responseModalities: ['TEXT', 'IMAGE'],
                    ...(opts.aspect_ratio && { aspectRatio: opts.aspect_ratio })
                }
            })
        });
        
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Gemini error ${res.status}: ${errText}`);
        }
        
        const data = await res.json();
        const images = [];
        
        for (const candidate of data.candidates || []) {
            for (const part of candidate.content?.parts || []) {
                if (part.inlineData?.data) {
                    images.push({ b64_json: part.inlineData.data });
                }
            }
        }
        
        log(sessionId, `Gemini returned ${images.length} image(s)`);
        return { data: images };
    },
    
    async naistera(body, headers, sessionId) {
        const apiKey = headers.authorization?.replace('Bearer ', '');
        if (!apiKey) throw new Error('Naistera requires API token');
        
        const opts = body.naistera || {};
        const n = body.n || 1;
        const varietyWords = ['', ', detailed', ', beautiful', ', stunning', ', elegant', ', graceful', ', vibrant', ', atmospheric'];
        
        // Limit prompt length to prevent timeouts (Naistera seems to struggle with very long prompts)
        const maxPromptLength = 500;
        let basePrompt = body.prompt;
        if (basePrompt.length > maxPromptLength) {
            basePrompt = basePrompt.substring(0, maxPromptLength).trim();
            log(sessionId, `Naistera prompt truncated to ${maxPromptLength} chars`);
        }
        
        // Generate all requests in parallel to avoid blocking
        const requests = [];
        for (let i = 0; i < Math.min(n, 4); i++) {
            let variedPrompt = basePrompt;
            if (n > 1) {
                const variety = varietyWords[i % varietyWords.length];
                variedPrompt = basePrompt + variety;
            }
            
            const params = new URLSearchParams({ token: apiKey });
            if (opts.aspect_ratio) params.set('aspect_ratio', opts.aspect_ratio);
            if (opts.preset) params.set('preset', opts.preset);
            
            // Add cache-busting timestamp to prevent stuck results
            params.set('_t', Date.now().toString() + '_' + i);
            
            const url = `https://naistera.org/prompt/${encodeURIComponent(variedPrompt)}?${params}`;
            log(sessionId, `Naistera request ${i+1}: ${url.substring(0, 80)}...`);
            
            // Create individual request promise with proper cleanup
            const requestPromise = (async () => {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => {
                    controller.abort();
                    log(sessionId, `Naistera request ${i+1} timed out after 2 minutes`);
                }, 120000); // 2 minutes
                
                try {
                    const res = await fetch(url, { 
                        signal: controller.signal,
                        headers: {
                            'Cache-Control': 'no-cache, no-store, must-revalidate',
                            'Pragma': 'no-cache'
                        }
                    });
                    clearTimeout(timeoutId);
                    
                    if (!res.ok) throw new Error(`Naistera error: ${res.status}`);
                    
                    const buffer = await res.arrayBuffer();
                    const b64 = Buffer.from(buffer).toString('base64');
                    return { b64_json: b64 };
                } catch (error) {
                    clearTimeout(timeoutId);
                    if (error.name === 'AbortError') {
                        throw new Error(`Naistera request ${i+1} was aborted (timeout)`);
                    }
                    throw error;
                }
            })();
            
            requests.push(requestPromise);
        }
        
        // Wait for all requests to complete
        const results = await Promise.all(requests);
        
        log(sessionId, `Naistera returned ${results.length} images`);
        return { data: results };
    },
    
    async civitai(body, headers, sessionId) {
        const apiKey = headers.authorization?.replace('Bearer ', '');
        if (!apiKey) throw new Error('CivitAI requires API token');
        
        const opts = body.civitai || {};
        const input = {
            model: opts.model || 'urn:air:sd1:checkpoint:civitai:4201@130072',
            params: {
                prompt: body.prompt,
                negativePrompt: body.negative_prompt,
                scheduler: opts.scheduler || 'EulerA',
                steps: body.steps || 20,
                cfgScale: body.cfg_scale || 7,
                width: body.width || 512,
                height: body.height || 512,
                seed: body.seed || -1,
                clipSkip: opts.clipSkip || 2
            },
            batchSize: body.n || 1
        };
        
        if (opts.additionalNetworks) {
            input.additionalNetworks = opts.additionalNetworks;
        }
        
        log(sessionId, `CivitAI request: model=${input.model.split(':').pop()}, ${input.params.width}x${input.params.height}`);
        
        // Use CivitAI's actual generation endpoint
        const res = await fetch('https://civitai.com/api/v1/jobs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                type: 'txt2img',
                input
            })
        });
        
        if (!res.ok) {
            const error = await res.text();
            throw new Error(`CivitAI error: ${res.status} - ${error}`);
        }
        
        const data = await res.json();
        const jobId = data.jobId || data.jobs?.[0]?.jobId;
        if (!jobId) throw new Error('No job ID returned');
        
        log(sessionId, `CivitAI job started: ${jobId}`);
        
        // Poll for completion (10 minute timeout)
        for (let i = 0; i < 120; i++) {
            await new Promise(r => setTimeout(r, 5000)); // 5 second intervals
            
            const statusRes = await fetch(`https://civitai.com/api/v1/jobs/${jobId}`, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            
            if (!statusRes.ok) continue;
            
            const job = await statusRes.json();
            
            if (job.result?.available && job.result?.blobUrl) {
                log(sessionId, `CivitAI completed: ${jobId}`);
                return {
                    data: [{
                        url: job.result.blobUrl,
                        b64_json: null
                    }]
                };
            }
            
            if (job.scheduled === false && !job.result?.available) {
                throw new Error('CivitAI generation failed');
            }
        }
        
        throw new Error('CivitAI timeout (10 minutes)');
    },
    
    async pixai(body, headers, sessionId) {
        const apiKey = headers.authorization?.replace('Bearer ', '');
        if (!apiKey) throw new Error('PixAI requires API key');
        
        const opts = body.pixai || {};
        const params = {
            prompts: body.prompt,
            modelId: opts.modelId || '1648918127446573124',
            width: body.width || 768,
            height: body.height || 1280,
            batchSize: Math.min(body.n || 1, 4)
        };
        
        // Core params
        if (body.negative_prompt) params.negativePrompts = body.negative_prompt;
        if (body.steps) params.samplingSteps = body.steps;
        if (body.cfg_scale) params.cfgScale = body.cfg_scale;
        if (body.seed) params.seed = body.seed;
        if (opts.sampler) params.samplingMethod = opts.sampler;
        
        // LoRAs
        if (body.loras?.length) {
            params.lora = {};
            body.loras.forEach(l => { params.lora[l.id] = l.weight || 0.7; });
        }
        
        // Quality boosters
        if (opts.enableADetailer) params.enableADetailer = true;
        if (opts.upscale > 1) {
            params.upscale = opts.upscale;
            if (opts.upscaleSampler) params.upscaleSampler = opts.upscaleSampler;
            if (opts.upscaleDenoisingStrength) params.upscaleDenoisingStrength = opts.upscaleDenoisingStrength;
            if (opts.upscaleDenoisingSteps) params.upscaleDenoisingSteps = opts.upscaleDenoisingSteps;
            if (opts.enableTile) params.enableTile = true;
        }
        
        // Img2Img
        if (opts.mediaUrl) {
            params.mediaUrl = opts.mediaUrl;
            if (opts.strength) params.strength = opts.strength;
        }
        
        // Prompt helper
        if (opts.promptHelper) params.promptHelper = { enable: true };
        
        log(sessionId, `PixAI request: model=${params.modelId}, ${params.width}x${params.height}, sampler=${params.samplingMethod || 'default'}`);
        
        const createRes = await fetch('https://api.pixai.art/v1/task', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ parameters: params })
        });
        const createData = await createRes.json();
        if (!createData.id) throw new Error(createData.message || 'Failed to create task');
        
        log(sessionId, `PixAI task created: ${createData.id}`);
        
        for (let i = 0; i < 120; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const statusRes = await fetch(`https://api.pixai.art/v1/task/${createData.id}`, { headers: { 'Authorization': `Bearer ${apiKey}` } });
            const task = await statusRes.json();
            if (task.status === 'completed' && task.outputs?.mediaUrls?.length) {
                log(sessionId, `PixAI completed: ${task.outputs.mediaUrls.length} images`);
                return { data: task.outputs.mediaUrls.filter(u => u).map(url => ({ url })) };
            }
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
    
    async custom(body, headers, sessionId) {
        let customUrl = headers['x-custom-url'];
        if (!customUrl) throw new Error('Custom URL required');
        if (!customUrl.includes('/images/generations') && !customUrl.includes('/chat/completions')) customUrl = customUrl.replace(/\/$/, '') + '/chat/completions';
        const apiKey = headers.authorization?.replace('Bearer ', '');
        const reqHeaders = { 'Content-Type': 'application/json' };
        if (apiKey) reqHeaders['Authorization'] = `Bearer ${apiKey}`;
        
        // Build message content with reference images
        const content = [];
        if (body.reference_images?.length) {
            log(sessionId, `Adding ${body.reference_images.length} reference images to request`);
            for (const img of body.reference_images) {
                content.push({ type: 'image_url', image_url: { url: img } });
            }
        }
        content.push({ type: 'text', text: body.prompt });
        
        log(sessionId, `Custom backend request to: ${customUrl}`);
        const res = await fetch(customUrl, { method: 'POST', headers: reqHeaders, body: JSON.stringify({ model: body.model || 'gpt-4o', messages: [{ role: 'user', content }] }) });
        const data = await res.json();
        log(sessionId, `Custom backend response status: ${res.status}`);
        const msg = data.choices?.[0]?.message || {};
        if (msg.images?.length) { log(sessionId, `Found ${msg.images.length} images in response`); return { data: msg.images.map(img => ({ url: img.image_url?.url || img.url })) }; }
        const msgContent = msg.content || '';
        const urls = msgContent.match(/https?:\/\/[^\s\)]+\.(png|jpg|jpeg|webp|gif)/gi) || [];
        if (urls.length) { log(sessionId, `Found ${urls.length} image URLs in content`); return { data: urls.map(url => ({ url })) }; }
        throw new Error(msgContent || JSON.stringify(data));
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

// Interrogate/Caption image (BLIP/CLIP)
app.post('/api/interrogate', async (req, res) => {
    try {
        const { image, model } = req.body;
        const url = req.headers['x-local-url'] || 'http://127.0.0.1:7860';
        const response = await fetch(`${url}/sdapi/v1/interrogate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image, model: model || 'clip' })
        });
        const data = await response.json();
        res.json({ caption: data.caption });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get A1111 progress
app.get('/api/a1111/progress', async (req, res) => {
    try {
        const url = req.headers['x-local-url'] || 'http://127.0.0.1:7860';
        const response = await fetch(`${url}/sdapi/v1/progress`);
        res.json(await response.json());
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Interrupt generation
app.post('/api/interrupt', async (req, res) => {
    try {
        const url = req.headers['x-local-url'] || 'http://127.0.0.1:7860';
        await fetch(`${url}/sdapi/v1/interrupt`, { method: 'POST' });
        currentGeneration = null;
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get available models from A1111
app.get('/api/a1111/models', async (req, res) => {
    try {
        const url = req.headers['x-local-url'] || 'http://127.0.0.1:7860';
        const [models, vaes, loras, embeddings] = await Promise.all([
            fetch(`${url}/sdapi/v1/sd-models`).then(r => r.json()),
            fetch(`${url}/sdapi/v1/sd-vae`).then(r => r.json()).catch(() => []),
            fetch(`${url}/sdapi/v1/loras`).then(r => r.json()).catch(() => []),
            fetch(`${url}/sdapi/v1/embeddings`).then(r => r.json()).catch(() => ({}))
        ]);
        res.json({ models, vaes, loras, embeddings: Object.keys(embeddings.loaded || {}) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Switch model in A1111
app.post('/api/a1111/model', async (req, res) => {
    try {
        const url = req.headers['x-local-url'] || 'http://127.0.0.1:7860';
        const { model, vae } = req.body;
        const options = {};
        if (model) options.sd_model_checkpoint = model;
        if (vae) options.sd_vae = vae;
        await fetch(`${url}/sdapi/v1/options`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(options)
        });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ControlNet preprocessors
app.post('/api/controlnet/preprocess', async (req, res) => {
    try {
        const url = req.headers['x-local-url'] || 'http://127.0.0.1:7860';
        const { image, module } = req.body;
        const response = await fetch(`${url}/controlnet/detect`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ controlnet_input_images: [image], controlnet_module: module || 'canny' })
        });
        const data = await response.json();
        res.json({ images: data.images });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Download model from Civitai
app.post('/api/civitai/download', async (req, res) => {
    try {
        const { url: modelUrl, filename } = req.body;
        const localUrl = req.headers['x-local-url'] || 'http://127.0.0.1:7860';
        
        // Get model path from A1111
        const optRes = await fetch(`${localUrl}/sdapi/v1/options`);
        const options = await optRes.json();
        const modelDir = options.outdir_samples?.replace('/outputs', '/models/Stable-diffusion') || path.join(MODELS_DIR, 'checkpoints');
        
        const filePath = path.join(modelDir, filename || 'model.safetensors');
        const response = await fetch(modelUrl);
        const fileStream = fs.createWriteStream(filePath);
        
        const totalSize = parseInt(response.headers.get('content-length'), 10);
        let downloaded = 0;
        
        response.body.on('data', chunk => {
            downloaded += chunk.length;
            sendProgress({ type: 'download', progress: downloaded / totalSize, filename });
        });
        
        await new Promise((resolve, reject) => {
            response.body.pipe(fileStream);
            response.body.on('error', reject);
            fileStream.on('finish', resolve);
        });
        
        res.json({ success: true, path: filePath });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Prompt enhancement via LLM
app.post('/api/enhance-prompt', async (req, res) => {
    try {
        const { prompt, style } = req.body;
        const apiKey = req.headers.authorization?.replace('Bearer ', '');
        
        // Use Pollinations text API (free)
        const enhancePrompt = `Enhance this image generation prompt with more details and artistic descriptions. Keep it concise (under 200 words). Style: ${style || 'detailed'}. Original: "${prompt}"`;
        const response = await fetch(`https://text.pollinations.ai/${encodeURIComponent(enhancePrompt)}`);
        const enhanced = await response.text();
        res.json({ enhanced: enhanced.trim() });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// X/Y/Z Plot generation
app.post('/api/xyz-plot', async (req, res) => {
    try {
        const { baseParams, xAxis, yAxis, zAxis } = req.body;
        const results = [];
        const xValues = xAxis?.values || [''];
        const yValues = yAxis?.values || [''];
        const zValues = zAxis?.values || [''];
        
        for (const z of zValues) {
            for (const y of yValues) {
                for (const x of xValues) {
                    const params = { ...baseParams };
                    if (xAxis?.param) params[xAxis.param] = x;
                    if (yAxis?.param) params[yAxis.param] = y;
                    if (zAxis?.param) params[zAxis.param] = z;
                    
                    sendProgress({ type: 'xyz', x, y, z, status: 'generating' });
                    const handler = backends[params.backend || 'local'];
                    const result = await handler(params, req.headers);
                    results.push({ x, y, z, images: result.data });
                }
            }
        }
        res.json({ results, grid: { x: xValues, y: yValues, z: zValues } });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Batch from file
app.post('/api/batch-file', async (req, res) => {
    try {
        const { prompts, baseParams } = req.body;
        const results = [];
        for (let i = 0; i < prompts.length; i++) {
            sendProgress({ type: 'batch', current: i + 1, total: prompts.length });
            const params = { ...baseParams, prompt: prompts[i] };
            const handler = backends[params.backend || 'local'];
            const result = await handler(params, req.headers);
            results.push({ prompt: prompts[i], images: result.data });
        }
        res.json({ results });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Templates endpoints
app.get('/api/templates', (req, res) => res.json(templates));
app.post('/api/templates', (req, res) => { templates.push({ id: Date.now(), ...req.body }); saveData('templates', templates); res.json({ success: true }); });
app.delete('/api/templates/:id', (req, res) => { templates = templates.filter(t => t.id != req.params.id); saveData('templates', templates); res.json({ success: true }); });

// Main generation endpoint
app.post('/v1/images/generations', async (req, res) => {
    const sessionId = req.headers['x-session-id'];
    try {
        const backend = req.headers['x-backend'] || 'local';
        log(sessionId, `Generation request: backend=${backend}, model=${req.body.model || 'default'}`);
        log(sessionId, `Prompt: ${(req.body.prompt || '').substring(0, 100)}...`);
        if (req.body.reference_images?.length) log(sessionId, `Reference images: ${req.body.reference_images.length}`);
        
        const handler = backends[backend];
        if (!handler) throw new Error('Unknown backend: ' + backend);
        const result = await handler(req.body, req.headers, sessionId);
        
        log(sessionId, `Generation complete: ${result.data?.length || 0} images`);
        
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
    } catch (e) { log(sessionId, `Generation error: ${e.message}`, 'error'); res.status(500).json({ error: e.message }); }
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
const server = app.listen(PORT, () => console.log(`SD Proxy running on http://localhost:${PORT}`));

// Increase timeout for large image generations
server.timeout = 300000; // 5 minutes
server.keepAliveTimeout = 300000;
server.headersTimeout = 300000;

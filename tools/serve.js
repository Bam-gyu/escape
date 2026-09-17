// 방을 짜는 동안 쓰는 서버. <b>배포본에는 안 올라간다.</b>
//
// 하는 일이 둘뿐이다.
//   1. 파일을 그대로 내보낸다 (python3 -m http.server가 하던 일)
//   2. 편집기가 보낸 방 목록을 src/data/rooms.js에 다시 쓰고, 검사를 돌려 결과를 돌려준다
//
// 의존성은 없다. node에 들어 있는 것만 쓴다 — 검사에 이미 node를 쓰고 있으니
// 새로 깔 것이 없다. `npm install`은 여전히 안 한다.
//
//   npm start          8173에 연다
//   PORT=9000 npm start

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ROOMS_PATH = join(ROOT, 'src', 'data', 'rooms.js');
const PORT = Number(process.env.PORT) || 8173;

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg',
    '.ico': 'image/x-icon',
};

function send(res, status, body, type = 'application/json; charset=utf-8') {
    res.writeHead(status, {
        'Content-Type': type,
        // 방을 고치고 새로고침했는데 옛 파일이 나오면, 고친 것이 안 먹은 줄 알고
        // 엉뚱한 데를 파게 된다. 만드는 동안에는 캐시가 도움이 안 된다.
        'Cache-Control': 'no-store',
    });
    res.end(body);
}

/// 요청한 주소가 이 폴더 밖을 가리키지 않게 한다. ../../ 같은 것을 막는다.
function resolveInsideRoot(urlPath) {
    const decoded = decodeURIComponent(urlPath.split('?')[0]);
    const relative = normalize(decoded).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
    const full = join(ROOT, relative || 'index.html');
    if (!full.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) return null;
    return full.endsWith(sep) ? join(full, 'index.html') : full;
}

async function serveFile(res, urlPath) {
    const path = resolveInsideRoot(urlPath);
    if (!path) return send(res, 403, 'nope', 'text/plain; charset=utf-8');

    try {
        const body = await readFile(path);
        send(res, 200, body, TYPES[extname(path)] ?? 'application/octet-stream');
    } catch {
        send(res, 404, '없다', 'text/plain; charset=utf-8');
    }
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let text = '';
        req.on('data', chunk => {
            text += chunk;
            // 방 목록은 커봐야 수십 KB다. 그보다 크면 뭔가 잘못 보낸 것이다.
            if (text.length > 2_000_000) { reject(new Error('너무 크다')); req.destroy(); }
        });
        req.on('end', () => resolve(text));
        req.on('error', reject);
    });
}

/// 저장한 뒤 검사를 돌린다. <b>돌려주는 것이 저장의 절반이다.</b>
///
/// 편집기는 못 깨는 방을 만들 수 있다 — 출구를 함정으로 막아버리는 것이 제일 쉽다.
/// 파일에 쓰기만 하고 끝내면 그걸 나중에, 직접 해보다가 알게 된다.
/// 이미 있는 검사를 그대로 돌려서 저장한 자리에서 바로 알려준다.
function runTests() {
    return new Promise(resolve => {
        const child = spawn(process.execPath, ['--test'], { cwd: ROOT });
        let output = '';
        child.stdout.on('data', d => { output += d; });
        child.stderr.on('data', d => { output += d; });
        child.on('close', code => resolve({ passed: code === 0, output }));
        child.on('error', error => resolve({ passed: false, output: String(error) }));
    });
}

/// 검사 출력에서 사람에게 보여줄 줄만 고른다. 통째로 보내면 패널이 로그창이 된다.
function summarize(output) {
    const failures = output.split('\n')
        .filter(line => /^\s*(not ok|✖)/.test(line) || /Error:/.test(line))
        .slice(0, 8);
    const counts = output.match(/^ℹ (?:pass|fail) \d+$/gm) ?? [];
    return [...counts, ...failures].join('\n').trim();
}

async function saveRooms(req, res) {
    let rooms;
    try {
        rooms = JSON.parse(await readBody(req)).rooms;
        if (!Array.isArray(rooms) || rooms.length === 0) throw new Error('방이 없다');
    } catch (error) {
        return send(res, 400, JSON.stringify({ ok: false, message: `못 읽었다: ${error.message}` }));
    }

    // serialize는 여기서 불러온다. 서버가 뜬 뒤에 고쳐도 다시 켜면 반영된다.
    const { serializeRooms, splitHeader } = await import('../src/editor/serialize.js');

    try {
        const header = splitHeader(await readFile(ROOMS_PATH, 'utf8'));
        await writeFile(ROOMS_PATH, serializeRooms(rooms, header));
    } catch (error) {
        return send(res, 500, JSON.stringify({ ok: false, message: `못 썼다: ${error.message}` }));
    }

    const { passed, output } = await runTests();
    send(res, 200, JSON.stringify({
        ok: true,
        testsPassed: passed,
        message: passed ? '저장했다. 검사도 통과했다.' : '저장은 했는데 검사가 깨졌다.',
        detail: summarize(output),
    }));
}

createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/rooms') return saveRooms(req, res);
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, '안 된다', 'text/plain');
    serveFile(res, req.url);
})
    // 127.0.0.1에만 연다. 이 서버는 요청 하나로 저장소의 파일을 고칠 수 있어서
    // 같은 망에 있는 다른 사람이 닿을 수 있으면 안 된다.
    .listen(PORT, '127.0.0.1', () => {
        console.log(`http://localhost:${PORT}  —  H를 누르면 방 편집기가 열린다`);
    });

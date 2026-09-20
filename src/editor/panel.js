// 방 편집기. H를 누르면 열린다. <b>배포본에는 안 실린다</b> —
// main.js가 H를 누른 그 순간에만 이 파일을 불러온다.
//
// 하는 일: 오른쪽 서랍에서 그림을 끌어다 방에 놓고, 놓은 것의 종류와 숫자를
// 고치고, 저장을 누르면 src/data/rooms.js가 다시 써진다.
//
// 고치는 대상은 <b>게임이 지금 보고 있는 그 방 객체</b>다. 사본이 아니라서
// 숫자를 만지는 즉시 화면이 바뀐다. 따로 "미리보기"가 없는 것이 그 때문이다.

import { ART, ART_LABEL } from '../view/art.js';
import {
    DRAWERS, KINDS, FIELD_HELP, makeItem, changeKind,
    DEFAULT_TRAVEL, TRAVEL_FIELDS, TRAVEL_HELP,
} from './defaults.js';
import { pickAt, itemOf, moveBy, removeFrom, outlineOf } from './pick.js';

const CSS = `
#editor {
    position: fixed; top: 0; right: 0; bottom: 0; width: 330px; z-index: 20;
    background: #151a24; border-left: 2px solid #2d3647; color: #cfd8e6;
    font-family: system-ui, sans-serif; font-size: 13px;
    display: flex; flex-direction: column; overflow: hidden;
}
#editor[hidden] { display: none; }
#editor h3 { margin: 0; font-size: 12px; letter-spacing: 1px; color: #7c8aa0; font-weight: 600; }
#editor section { padding: 10px 12px; border-bottom: 1px solid #222a38; }
#editor .scroll { overflow-y: auto; flex: 1; }
#editor select, #editor input {
    font: inherit; background: #0d1016; color: #f3eee6;
    border: 1px solid #39435a; border-radius: 3px; padding: 3px 5px;
}
#editor button {
    font: inherit; font-size: 13px; padding: 4px 10px; border-radius: 3px; cursor: pointer;
    transform: none; border: 1px solid #39435a; background: #222a38; color: #cfd8e6;
}
#editor button:hover { background: #2d3647; color: #fff; }
#editor button.go { border-color: #ff9ec4; color: #ff9ec4; }
#editor button.go:hover { background: #ff9ec4; color: #16121a; }
#editor button.danger { border-color: #b4566f; color: #ff9ec4; }

#ed-top { display: flex; gap: 6px; align-items: center; }
#ed-room { flex: 1; }
#ed-status { margin: 0; padding: 8px 12px; font-size: 12px; line-height: 1.5; color: #7c8aa0;
    white-space: pre-wrap; border-bottom: 1px solid #222a38; }
#ed-status.bad { color: #ff9ec4; }
#ed-status.good { color: #8fd8a8; }

#ed-time { display: flex; gap: 8px; align-items: center; }
#ed-view label { display: flex; gap: 6px; align-items: center; cursor: pointer; color: #cfd8e6; }
#ed-view .help { display: block; margin-top: 3px; font-size: 10px; color: #5c6779; line-height: 1.3; }
#ed-time input[type=range] { flex: 1; }

.drawer { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 8px; }
.chip {
    background: #0d1016; border: 1px solid #2d3647; border-radius: 4px;
    padding: 4px 2px 2px; text-align: center; cursor: grab; user-select: none;
}
.chip:hover { border-color: #ff9ec4; }
.chip img { display: block; width: 100%; height: 34px; object-fit: contain; pointer-events: none; }
.chip span { font-size: 10px; color: #7c8aa0; }

/* 아직 png가 없는 것. 놓을 수는 있다 — 게임은 그림이 없으면 도형으로 그린다. */
.chip.missing { border-style: dashed; border-color: #4a3a46; }
.chip.missing img { visibility: hidden; }
.chip.missing::before { content: '그림 없음'; display: block; height: 34px; line-height: 34px;
    margin-bottom: -34px; font-size: 9px; color: #6b5560; }

.field { display: flex; align-items: center; gap: 6px; margin-top: 5px; }
.field label { width: 78px; color: #9fb0c8; }
.field input { width: 74px; }
.field .help { flex: 1; font-size: 10px; color: #5c6779; line-height: 1.3; }
#ed-hint { margin: 8px 0 0; font-size: 11px; line-height: 1.6; color: #5c6779; }
body.editing #stage { width: min(calc(100vw - 350px), 133.333vh); margin-right: 330px; }
body.editing #screen { cursor: crosshair; }
`;

/// 패널 한 채를 만든다. main.js는 이 함수 하나만 안다.
export function createEditor({ canvas, game, rooms, toGameCoords, goToRoom }) {
    document.head.appendChild(document.createElement('style')).textContent = CSS;

    const panel = document.createElement('aside');
    panel.id = 'editor';
    panel.hidden = true;
    panel.innerHTML = `
        <section id="ed-top">
            <select id="ed-room"></select>
            <button type="button" class="go" id="ed-save">저장</button>
        </section>
        <p id="ed-status">그림을 끌어다 방에 놓는다. 놓인 것을 눌러 고친다.</p>
        <section id="ed-time">
            <button type="button" id="ed-pause">멈춤</button>
            <input type="range" id="ed-scrub" min="0" max="15" step="0.05" value="0">
            <span id="ed-clock">0.0초</span>
        </section>
        <section id="ed-view">
            <label><input type="checkbox" id="ed-player" checked> 주인공 보이기</label>
            <span class="help">함정 위에 겹쳐 서면 그 함정을 볼 수 없다. 그럴 때 끈다</span>
        </section>
        <div class="scroll">
            <section id="ed-drawers"></section>
            <section id="ed-inspector"></section>
        </div>`;
    document.body.appendChild(panel);

    const $ = id => panel.querySelector(`#${id}`);
    const roomSelect = $('ed-room');
    const status = $('ed-status');
    const inspector = $('ed-inspector');
    const scrub = $('ed-scrub');
    const clock = $('ed-clock');

    let selection = null;
    let dragging = null;

    const room = () => rooms[game.roomIndex];

    function say(text, tone = '') {
        status.textContent = text;
        status.className = tone;
    }

    // ── 방 고르기 ─────────────────────────────────────────────
    rooms.forEach((r, i) => {
        roomSelect.append(new Option(`${i + 1}. ${r.name}`, String(i)));
    });
    roomSelect.addEventListener('change', () => {
        selection = null;
        goToRoom(Number(roomSelect.value));
        drawInspector();
    });

    // ── 시간 ─────────────────────────────────────────────────
    // 움직이는 함정을 눈으로 잡으려면 시간을 세울 수 있어야 한다.
    // 흐르는 중에 놓으면 "지금 이 자리"가 어디였는지 알 수 없다.
    $('ed-pause').addEventListener('click', () => {
        game.editPaused = !game.editPaused;
        $('ed-pause').textContent = game.editPaused ? '이어서' : '멈춤';
    });
    // 주인공 켜고 끄기. 커서를 따라다니는 게임이라 손을 치울 수가 없어서,
    // 함정 위에 겹쳐 선 주인공을 비키게 할 방법이 이것뿐이다.
    $('ed-player').addEventListener('change', e => { game.showPlayer = e.target.checked; });

    scrub.addEventListener('input', () => {
        game.editPaused = true;
        $('ed-pause').textContent = '이어서';
        game.editTime = Number(scrub.value);
        // 멈춘 동안에는 tick이 안 도니 여기서 직접 적는다.
        clock.textContent = `${game.editTime.toFixed(1)}초`;
    });

    // ── 서랍 ─────────────────────────────────────────────────
    const drawers = $('ed-drawers');
    for (const { title, as, arts } of DRAWERS) {
        const box = document.createElement('div');
        box.innerHTML = `<h3>${title}</h3><div class="drawer"></div>`;
        const grid = box.querySelector('.drawer');

        for (const art of arts) {
            const chip = document.createElement('div');
            chip.className = 'chip';
            chip.draggable = true;
            chip.title = art;
            chip.innerHTML = `<img src="${ART[art].src}" alt=""><span>${ART_LABEL[art] ?? art}</span>`;

            // png가 아직 없어도 <b>칸은 남겨둔다.</b> 아예 안 보이면 "빠졌나"
            // 싶어 코드를 뒤지게 된다. 없다고 말해주면 그림만 넣으면 되는 걸 안다.
            chip.querySelector('img').addEventListener('error', () => {
                chip.classList.add('missing');
                chip.title = `${art} — art/${art.replace(/(\d)$/, '-$1')}.png 가 없다`;
            });

            chip.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', `${as}:${art}`));
            grid.appendChild(chip);
        }
        drawers.appendChild(box);
    }

    // ── 캔버스에 놓기 ─────────────────────────────────────────
    canvas.addEventListener('dragover', e => { if (game.admin) e.preventDefault(); });
    canvas.addEventListener('drop', e => {
        if (!game.admin) return;
        e.preventDefault();

        // 어느 서랍에서 끌어왔는지가 같이 온다. 같은 그림이라도 함정 서랍에서
        // 끌면 닿으면 들키는 것이 되고, 소품 서랍에서 끌면 장식이 된다.
        const [as, art] = e.dataTransfer.getData('text/plain').split(':');
        if (!ART[art]) return;

        const at = toGameCoords(e);
        const item = makeItem(art, at.x, at.y, as);

        if (as === 'prop') {
            (room().props ??= []).push(item);
            selection = { what: 'prop', index: room().props.length - 1 };
        } else {
            room().hazards.push(item);
            selection = { what: 'hazard', index: room().hazards.length - 1 };
        }

        say(`${ART_LABEL[art] ?? art}을(를) 놓았다.`);
        drawInspector();
    });

    // ── 집고 옮기기 ───────────────────────────────────────────
    canvas.addEventListener('mousedown', e => {
        if (!game.admin) return;
        const at = toGameCoords(e);
        selection = pickAt(room(), at.x, at.y, game.editTime);
        dragging = selection ? at : null;
        drawInspector();
    });

    addEventListener('mousemove', e => {
        if (!game.admin || !dragging) return;
        const at = toGameCoords(e);
        moveBy(itemOf(room(), selection), at.x - dragging.x, at.y - dragging.y);
        dragging = at;
        fillFields();
    });

    addEventListener('mouseup', () => { dragging = null; });

    addEventListener('keydown', e => {
        if (!game.admin || !selection) return;
        if (e.key !== 'Delete' && e.key !== 'Backspace') return;
        // 입력칸에서 지우는 중이면 함정을 지우면 안 된다.
        if (e.target instanceof HTMLInputElement) return;

        if (removeFrom(room(), selection)) {
            say('지웠다.');
            selection = null;
            drawInspector();
        } else {
            say('시작 자리와 출구는 못 지운다. 방이 아니게 된다.', 'bad');
        }
    });

    // ── 고르고 나서 고치기 ────────────────────────────────────
    function numberField(item, key) {
        const row = document.createElement('div');
        row.className = 'field';
        row.innerHTML = `<label for="f-${key}">${key}</label>
            <input type="number" id="f-${key}" step="1" value="${item[key] ?? 0}">
            <span class="help">${FIELD_HELP[key] ?? ''}</span>`;

        const input = row.querySelector('input');
        if (['period', 'on', 'offset', 'walkPeriod'].includes(key)) input.step = '0.1';
        input.addEventListener('input', () => {
            const value = Number(input.value);
            if (Number.isFinite(value)) item[key] = value;
        });
        return row;
    }

    /// 끌어서 옮기는 동안 숫자칸도 같이 움직여야 한다.
    /// 화면과 숫자가 어긋나면 어느 쪽이 진짜인지 알 수 없다.
    function fillFields() {
        const item = itemOf(room(), selection);
        if (!item) return;

        for (const input of inspector.querySelectorAll('input[type=number]')) {
            if (document.activeElement === input) continue;

            // f-는 함정 자신의 값, t-는 가로지르기 덩이 안의 값이다.
            // 가르지 않으면 끌어 옮길 때마다 가로지르기 칸이 0으로 덮인다.
            const from = input.id.startsWith('t-') ? item.travel : item;
            const key = input.id.slice(2);
            if (from) input.value = String(from[key] ?? 0);
        }
    }

    /// 체크박스 한 줄. 같은 모양을 여러 번 쓰게 되어 한 곳으로 모았다.
    function toggleRow(label, help, checked, onChange) {
        const row = document.createElement('div');
        row.className = 'field';
        row.innerHTML = `<label>${label}</label>
            <input type="checkbox" ${checked ? 'checked' : ''}>
            <span class="help">${help}</span>`;
        row.querySelector('input').addEventListener('change', e => onChange(e.target.checked));
        return row;
    }

    /// 가로지르기 칸. 켜면 함정이 제 자리에서 한 방향으로 흘러가 화면 밖으로
    /// 사라지고, 잠시 뒤 처음 자리에서 다시 나온다.
    ///
    /// <b>어떤 함정에든 붙는다</b> — 감시자도, 벽도, 소파도. 종류가 아니라
    /// 얹는 것이라서 종류를 바꿔도 그대로 남는다.
    function travelBox(item) {
        const box = document.createElement('div');
        box.style.marginTop = '10px';

        const head = document.createElement('div');
        head.className = 'field';
        head.innerHTML = `<label>가로지르기</label>
            <input type="checkbox" id="f-travel" ${item.travel ? 'checked' : ''}>
            <span class="help">맵을 지나가 사라졌다가 처음 자리에서 다시 나온다</span>`;
        head.querySelector('input').addEventListener('change', e => {
            if (e.target.checked) item.travel = { ...DEFAULT_TRAVEL };
            else delete item.travel;
            drawInspector();
        });
        box.appendChild(head);

        if (!item.travel) return box;

        for (const key of TRAVEL_FIELDS) {
            const row = document.createElement('div');
            row.className = 'field';
            row.innerHTML = `<label for="t-${key}">${key}</label>
                <input type="number" id="t-${key}" step="${key === 'duration' || key === 'gap' || key === 'offset' ? '0.1' : '10'}"
                    value="${item.travel[key] ?? 0}">
                <span class="help">${TRAVEL_HELP[key] ?? ''}</span>`;
            const input = row.querySelector('input');
            input.addEventListener('input', () => {
                const v = Number(input.value);
                if (Number.isFinite(v)) item.travel[key] = v;
            });
            box.appendChild(row);
        }

        // 방향. dx의 부호가 방향이고, 그림도 같이 뒤집어야 뒤로 달리지 않는다.
        // 숫자에 마이너스를 붙이는 것보다 단추 두 개가 무엇을 하는지 분명하다.
        const way = document.createElement('div');
        way.className = 'field';
        way.innerHTML = '<label>방향</label>';

        for (const [text, sign] of [['← 왼쪽', -1], ['오른쪽 →', 1]]) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = text;
            button.style.marginRight = '4px';
            // 켜진 단추는 dx의 부호를 그대로 따른다. 0이면 어느 쪽도 안 켠다.
            if (Math.sign(item.travel.dx) === sign) button.classList.add('go');

            button.addEventListener('click', () => {
                // dx가 0이면 방향만 정해도 아무 데도 안 간다. 기본 거리를 준다 —
                // 단추를 눌렀는데 아무 일도 안 일어나면 고장으로 보인다.
                const far = Math.abs(item.travel.dx) || Math.abs(DEFAULT_TRAVEL.dx);
                item.travel.dx = far * sign;
                if (sign < 0) item.flip = true; else delete item.flip;
                drawInspector();
            });
            way.appendChild(button);
        }
        box.appendChild(way);

        box.appendChild(toggleRow('반복', '끄면 한 번 지나가고 다시 안 나온다',
            item.travel.loop, on => { item.travel.loop = on; }));

        return box;
    }

    function drawInspector() {
        inspector.innerHTML = '';
        roomSelect.value = String(game.roomIndex);

        const item = itemOf(room(), selection);
        if (!item) {
            inspector.innerHTML = `<h3>고를 것</h3>
                <p id="ed-hint">방에 놓인 것을 누르면 여기서 고칠 수 있다.<br>
                끌어서 옮기고, Delete로 지운다.<br><br>
                <b>시야 각도는 0이 오른쪽, 90이 아래쪽</b>이다.</p>`;
            return;
        }

        const title = document.createElement('h3');
        title.textContent = { hazard: '함정', prop: '소품 — 판정 없음', spawn: '시작 자리', exit: '출구' }[selection.what];
        inspector.appendChild(title);

        // 함정만 종류를 바꿀 수 있다. 소품은 판정이 없고, 시작 자리와 출구는 종류가 없다.
        if (selection.what === 'hazard') {
            const row = document.createElement('div');
            row.className = 'field';
            row.innerHTML = '<label>종류</label>';
            const select = document.createElement('select');
            for (const [kind, spec] of Object.entries(KINDS)) {
                select.append(new Option(`${kind} — ${spec.label}`, kind));
            }
            select.value = item.kind;
            select.addEventListener('change', () => {
                room().hazards[selection.index] = changeKind(item, select.value);
                drawInspector();
            });
            row.appendChild(select);
            inspector.appendChild(row);
        }

        const fields = selection.what === 'hazard'
            ? [...KINDS[item.kind].fields, ...KINDS[item.kind].extras]
            : selection.what === 'spawn' ? ['x', 'y']
                : ['x', 'y', 'w', 'h'];
        for (const key of fields) inspector.appendChild(numberField(item, key));

        // 출구도 배경에 맡길 수 있다. 배경이 이미 문을 그리고 있으면
        // 문 그림을 한 장 더 얹을 이유가 없다.
        if (selection.what === 'exit') {
            inspector.appendChild(toggleRow('배경에 있음',
                '배경 그림이 이미 문을 보여준다. 판정만 두고 안 그린다',
                item.inBackground,
                on => { if (on) item.inBackground = true; else delete item.inBackground; }));
        }

        if (selection.what === 'prop' || selection.what === 'hazard') {
            inspector.appendChild(toggleRow('좌우 뒤집기',
                '그림만 뒤집는다. 왼쪽으로 가는 차는 이걸 켜야 뒤로 안 달린다',
                item.flip,
                on => { if (on) item.flip = true; else delete item.flip; }));
        }

        if (selection.what === 'hazard') {
            inspector.appendChild(toggleRow('안 보이게',
                '판정만 두고 안 그린다. <b>마지막 방에만</b> — 검사가 본다',
                item.hidden,
                on => { if (on) item.hidden = true; else delete item.hidden; }));

            inspector.appendChild(toggleRow('배경에 있음',
                '배경 그림이 이미 보여주는 것. 판정만 두고 안 그린다',
                item.inBackground,
                on => { if (on) item.inBackground = true; else delete item.inBackground; }));

            inspector.appendChild(travelBox(item));

            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'danger';
            remove.textContent = '지우기';
            remove.style.marginTop = '10px';
            remove.addEventListener('click', () => {
                removeFrom(room(), selection);
                selection = null;
                drawInspector();
            });
            inspector.appendChild(remove);
        }
    }

    // ── 저장 ─────────────────────────────────────────────────
    $('ed-save').addEventListener('click', async () => {
        say('저장하는 중…');
        try {
            const res = await fetch('/api/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rooms }),
            });
            const result = await res.json();
            say(`${result.message}\n${result.detail ?? ''}`.trim(),
                result.ok && result.testsPassed ? 'good' : 'bad');
        } catch (error) {
            // python 서버로 띄우면 /api/rooms가 없다. 그걸 모르면 저장이 조용히 실패한다.
            say(`못 보냈다: ${error.message}\nnpm start로 띄운 서버인지 봐라.`, 'bad');
        }
    });

    /// 게임이 안 그리는 것들을 얹는다. 소품과 시작 자리는 판정이 없어서
    /// 판정 보기에도 안 나오는데, 집으려면 어디 있는지는 보여야 한다.
    function drawOverlay(ctx) {
        ctx.save();
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);

        ctx.strokeStyle = 'rgba(143, 216, 168, 0.75)';
        for (const prop of room().props ?? []) ctx.strokeRect(prop.x, prop.y, prop.w, prop.h);

        ctx.strokeStyle = 'rgba(255, 226, 122, 0.85)';
        ctx.strokeRect(room().exit.x, room().exit.y, room().exit.w, room().exit.h);

        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(room().spawn.x, room().spawn.y, 12, 0, Math.PI * 2);
        ctx.strokeStyle = '#8fd8a8';
        ctx.stroke();

        const outline = outlineOf(room(), selection, game.editTime);
        if (outline) {
            ctx.strokeStyle = '#ff9ec4';
            ctx.lineWidth = 3;
            if (outline.round) {
                ctx.beginPath();
                ctx.arc(outline.x + outline.w / 2, outline.y + outline.h / 2, outline.w / 2, 0, Math.PI * 2);
                ctx.stroke();
            } else {
                ctx.strokeRect(outline.x, outline.y, outline.w, outline.h);
            }
        }

        ctx.restore();
    }

    function setOpen(open) {
        panel.hidden = !open;
        document.body.classList.toggle('editing', open);
        if (open) {
            $('ed-player').checked = game.showPlayer;
            drawInspector();
        }
    }

    /// 화면의 시계 표시. 그리기 루프가 매 프레임 부른다.
    function tick() {
        if (document.activeElement !== scrub) scrub.value = String(game.editTime % 15);
        clock.textContent = `${game.editTime.toFixed(1)}초`;
    }

    drawInspector();
    return { setOpen, drawOverlay, tick, roomChanged: drawInspector };
}

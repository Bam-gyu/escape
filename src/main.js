import { ROOMS } from './data/rooms.js';
import { stepRoom, ROOM_WIDTH, ROOM_HEIGHT } from './rules/room.js';
import { loadArt, IDOL_WALK, WALK_FRAME_SECONDS } from './view/art.js';
import { createAudio } from './view/audio.js';
import { drawRoom } from './view/render.js';
import { COLOR } from './view/palette.js';

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
canvas.width = ROOM_WIDTH;
canvas.height = ROOM_HEIGHT;

const images = loadArt();
const params = new URLSearchParams(location.search);
const audio = createAudio(params.has('mute'));

/// ?room=2 로 그 방부터 연다. 방을 짜는 동안 앞 방을 매번 다시 깨지 않으려는 것이다.
const startRoom = Math.min(Math.max(0, (Number(params.get('room')) || 1) - 1), ROOMS.length - 1);

/// 방과 방 사이, 그리고 들킨 뒤에는 커서가 시작 자리에 올 때까지 기다린다.
/// 이게 없으면 앞 방에서 커서가 있던 자리에 아이돌이 튀어나와 그대로 들킨다.
///
/// 첫 진입만은 예외다. 연출 화면의 버튼이 시작 자리 위에 놓여 있어서,
/// 누르는 순간 커서가 이미 거기 있다. 플레이어에게는 규칙이 아니라 그냥 버튼으로 보인다.
const READY_RADIUS = 26;

/// 오프닝 연출. [게임 시작]을 누르면 차례로 나온다.
/// 불을 끄고 방에서 몰래 나가는 것이 이 게임의 첫 장면이다.
/// 그림이 아직 없으면 조용히 건너뛴다 — 그림을 기다리며 멈추지 않는다.
const OPENING = [
    { art: 'openLightOn', seconds: 1.1 },
    { art: 'openLightOff', seconds: 1.3 },
];

/// 엔딩. 간식을 먹고 잠들었다. 누를 때까지 머문다.
const ENDING_ART = 'endNap';

const game = {
    screen: 'title',
    roomIndex: startRoom,
    deaths: 0,
    enteredAt: 0,
    openingAt: 0,
    openingStep: 0,

    /// 걷기 시계. <b>실제로 움직인 시간만 더한다.</b> 그냥 흐르게 두면
    /// 커서를 멈춰도 발을 계속 굴러 제자리걸음으로 보인다.
    walkPhase: 0,
    lastPointer: { x: 0, y: 0 },
    lastFrameAt: 0,
    pointer: { x: ROOM_WIDTH / 2, y: ROOM_HEIGHT / 2 },
    last: null,
    showHitboxes: false,

    /// 방을 짜는 동안만 켜는 모드. H로 연다. <b>배포본에는 안 실린다</b> —
    /// 편집기는 여기서 처음 켤 때 import()로 불러오므로, 안 켜면 내려받지도 않는다.
    admin: false,
    editor: null,

    /// 관리자 모드의 시계. 흐르는 시간을 세우고 되감을 수 있어야
    /// 움직이는 함정을 눈으로 잡을 수 있다.
    editTime: 0,
    editPaused: false,

    /// 주인공을 그리는가. 방을 짤 때만 끈다.
    /// 주인공이 함정 위에 겹쳐 서 있으면 그 함정이 어떻게 생겼는지 볼 수가 없는데,
    /// 커서를 따라다니는 게임이라 <b>손을 치울 수가 없다.</b>
    showPlayer: true,

    /// 이 방에서 나를 이미 한 번 들키게 한 숨은 함정들의 번호.
    /// <b>기억은 여기가 든다.</b> 함정에 들리면 되감기도 건너뛰기도 안 되고,
    /// 다시 시작할 때 함정을 되돌리는 코드가 따로 필요해진다.
    revealed: new Set(),
};

const room = () => ROOMS[game.roomIndex];

const titleScreen = document.getElementById('title');
const introScreen = document.getElementById('intro');
const goButton = document.getElementById('go');

/// 연출 화면의 버튼을 1번 방의 시작 자리 위에 정확히 올린다.
/// 캔버스는 화면 크기에 따라 늘었다 줄었다 하므로 비율로 놓는다.
function placeGoButton() {
    const spawn = ROOMS[startRoom].spawn;
    goButton.style.left = `${spawn.x / ROOM_WIDTH * 100}%`;
    goButton.style.top = `${spawn.y / ROOM_HEIGHT * 100}%`;
}

function enterRoom(index) {
    game.roomIndex = index;
    game.screen = 'ready';
    game.enteredAt = performance.now();

    // 새 방의 첫 모습을 여기서 바로 만들어 둔다. <b>null로 비우면 안 된다.</b>
    // 방을 통과했을 때만은 enterRoom이 update() 안에서 불려서, 같은 프레임의
    // draw()가 그 null을 그대로 받는다. 그리기가 터지면 frame() 끝의
    // requestAnimationFrame까지 못 가고 루프가 통째로 멎는다.
    const spawn = ROOMS[index].spawn;
    game.last = stepRoom(ROOMS[index], spawn.x, spawn.y, 0);

    // 방을 넘어가면 숨은 함정을 다시 잊는다. 방마다 새로 배우는 것이 맞다.
    game.revealed = new Set();
}

/// point를 target에서 radius 안으로 끌어당긴다. 이미 안에 있으면 그대로 둔다.
function pullToward(point, target, radius) {
    const dx = point.x - target.x;
    const dy = point.y - target.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= radius) return point;
    return { x: target.x + dx / distance * radius, y: target.y + dy / distance * radius };
}

function toGameCoords(event) {
    const box = canvas.getBoundingClientRect();
    const point = event.touches ? event.touches[0] : event;
    return {
        x: (point.clientX - box.left) / box.width * ROOM_WIDTH,
        y: (point.clientY - box.top) / box.height * ROOM_HEIGHT,
    };
}

function onPointerMove(event) {
    game.pointer = toGameCoords(event);
    if (event.touches) event.preventDefault();
}

canvas.addEventListener('mousemove', onPointerMove);
canvas.addEventListener('touchmove', onPointerMove, { passive: false });
canvas.addEventListener('touchstart', onPointerMove, { passive: false });

canvas.addEventListener('click', () => {
    // 판정 보기(H) 중에는 누른 자리를 콘솔에 남긴다. rooms.js에 그대로 붙여넣으면 된다.
    if (game.showHitboxes) {
        const x = Math.round(game.pointer.x);
        const y = Math.round(game.pointer.y);
        console.log(`x: ${x}, y: ${y}`);
    }

    if (game.screen === 'opening') { showIntro(); return; }
    if (game.screen === 'dead') { restartRoom(); return; }

    if (game.screen === 'ending') { game.deaths = 0; showTitle(); return; }
    if (game.screen === 'clear') { game.deaths = 0; showTitle(); }
});

addEventListener('keydown', event => {
    if (event.target instanceof HTMLInputElement) return;

    const key = event.key.toLowerCase();
    if (key === 'h') toggleAdmin();
    if (key === 'm') audio.setMuted(!audio.muted);
});

/// 편집기는 <b>내 컴퓨터에서 띄웠을 때만</b> 열린다.
///
/// 이 게임은 빌드가 없는 정적 파일이라 src/editor도 올린 곳에 그대로 따라간다.
/// 막지 않으면 올려둔 게임에서 누가 H를 눌러 무적이 되고 편집기를 연다.
/// 저장은 어차피 안 되지만(서버가 없다), 게임이 게임이 아니게 된다.
const IS_LOCAL = ['localhost', '127.0.0.1', '[::1]', ''].includes(location.hostname);

/// 불러오는 중이라는 표시. <b>하나로 묶어 두지 않으면</b> 다 불러오기 전에 H를
/// 두 번 누른 만큼 편집기가 겹쳐 만들어지고, 그만큼 리스너가 붙어서
/// 한 번 끌어다 놓은 것이 둘이 된다.
let editorLoading = null;

/// H. 판정 보기와 방 편집기를 함께 연다.
///
/// 원래 H가 하던 일(판정을 빨간 선으로 보기)이 곧 "방 짜는 모드"였다.
/// 둘을 한 키로 묶은 것은 기억할 키를 늘리지 않으려는 것이다.
async function toggleAdmin() {
    if (!IS_LOCAL) return;

    game.admin = !game.admin;
    game.showHitboxes = game.admin;

    if (!game.admin) {
        // 꺼둔 채로 편집기를 닫으면 주인공 없는 게임이 된다. 반드시 되돌린다.
        game.showPlayer = true;
        game.editor?.setOpen(false);
        return;
    }

    // 타이틀이나 연출 중에 눌렀어도 곧장 방으로 들어간다.
    titleScreen.hidden = true;
    introScreen.hidden = true;
    if (game.screen !== 'play') { enterRoom(game.roomIndex); game.screen = 'play'; }

    editorLoading ??= import('./editor/panel.js').then(({ createEditor }) => createEditor({
        canvas, game, rooms: ROOMS, toGameCoords,
        goToRoom: index => { enterRoom(index); game.screen = 'play'; game.editTime = 0; },
    }));
    game.editor = await editorLoading;

    // 불러오는 사이에 다시 껐을 수도 있다. 지금 상태를 따른다.
    game.editor.setOpen(game.admin);
}

/// 들킨 뒤 다시 시작. 방을 새로 여는 것과 달리 <b>드러난 함정은 기억한다.</b>
/// 이게 없으면 안 보이는 함정이 배울 수 없는 것이 되어 그냥 운이 된다.
function restartRoom() {
    const learned = game.revealed;
    enterRoom(game.roomIndex);
    game.revealed = learned;
}

/// 타이틀로 돌아간다. 다 깬 뒤와 처음 열었을 때 쓴다.
function showTitle() {
    game.screen = 'title';
    introScreen.hidden = true;
    titleScreen.hidden = false;
}

/// 연출이 끝나고 시작 자리 위의 버튼을 보여준다.
/// 이 버튼이 곧 시작 자리라서, 누르면 커서가 이미 거기 있다.
function showIntro() {
    game.screen = 'intro';
    placeGoButton();
    introScreen.hidden = false;
}

document.getElementById('start').addEventListener('click', () => {
    audio.play('click');
    titleScreen.hidden = true;
    game.screen = 'opening';
    game.openingAt = performance.now();
    game.openingStep = 0;
});

goButton.addEventListener('click', event => {
    // 버튼이 시작 자리 위에 있으니 누른 자리가 곧 시작 자리다.
    //
    // 다만 버튼은 점이 아니라 글자 넓이만큼 크다. 가장자리를 누르면 시작 자리에서
    // READY_RADIUS를 넘어, 버튼을 눌렀는데도 시작이 안 되고 마우스를 다시 옮겨야 한다.
    // 그래서 누른 자리를 시작 자리 쪽으로 붙잡는다 — 눌렀으면 반드시 시작한다.
    //
    // 누른 자리를 아예 버리고 시작 자리로 못 박지 않는 것은, 그러면 진짜 커서와
    // 주인공이 어긋난 채로 시작해 첫 마우스 움직임에 주인공이 그만큼 순간이동하기 때문이다.
    game.pointer = pullToward(toGameCoords(event), ROOMS[startRoom].spawn, READY_RADIUS);
    introScreen.hidden = true;
    audio.play('click');
    audio.startMusic();
    enterRoom(startRoom);
});

function update(now) {
    if (game.screen === 'ready') {
        const spawn = room().spawn;
        const reached = Math.hypot(game.pointer.x - spawn.x, game.pointer.y - spawn.y) <= READY_RADIUS;
        game.last = stepRoom(room(), spawn.x, spawn.y, 0);
        if (reached) { game.screen = 'play'; game.enteredAt = now; }
        return;
    }

    if (game.screen === 'opening') {
        let elapsed = (now - game.openingAt) / 1000;
        let step = 0;
        while (step < OPENING.length && elapsed >= OPENING[step].seconds) {
            elapsed -= OPENING[step].seconds;
            step++;
        }

        // 연출이 끝나면 시작 자리 위의 버튼을 보여준다.
        if (step >= OPENING.length) { showIntro(); return; }
        game.openingStep = step;
        return;
    }

    if (game.screen !== 'play') return;

    // 관리자 모드에서는 편집기의 시계를 쓴다. 멈춘 시간 위에 함정을 놓을 수 있어야 한다.
    const t = game.admin ? game.editTime : (now - game.enteredAt) / 1000;
    const state = stepRoom(room(), game.pointer.x, game.pointer.y, t);
    game.last = state;

    // 방을 짜는 동안에는 들키지도, 통과하지도 않는다. 함정을 놓으려고 커서를
    // 그 위로 가져가는 것이 곧 죽음이면 아무것도 놓을 수 없다.
    if (game.admin) return;

    if (state.dead) {
        game.deaths++;
        game.screen = 'dead';

        // 나를 들키게 한 것이 안 보이는 함정이었다면, 이제부터 보인다.
        if (room().hazards[state.killedBy]?.hidden) game.revealed.add(state.killedBy);

        audio.play('death');
        return;
    }

    if (state.cleared) {
        if (game.roomIndex + 1 < ROOMS.length) {
            audio.play('clear');
            enterRoom(game.roomIndex + 1);
        } else {
            audio.play('win');
            game.screen = 'ending';
        }
    }
}

/// 글자는 언제나 어두운 테두리를 두르고 그린다.
///
/// 방마다 배경이 다르고, 헬스장처럼 밝은 방에서는 흰 글자가 그대로 묻힌다.
/// 색을 방마다 고르게 하면 방을 추가할 때마다 글자색을 다시 정해야 한다.
/// 테두리를 두르면 어떤 배경 위에서도 읽힌다.
function label(text, x, y, size, align = 'left', color = '#f3eee6') {
    ctx.font = `${size}px "Nanum Pen Script", "Gaegu", system-ui, sans-serif`;
    ctx.textAlign = align;

    ctx.lineWidth = Math.max(3, size / 9);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(13, 16, 22, 0.85)';
    ctx.strokeText(text, x, y);

    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
}

function drawReadyMark() {
    const spawn = room().spawn;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(spawn.x, spawn.y, READY_RADIUS, 0, Math.PI * 2);
    // 어두운 선을 굵게 깔고 흰 선을 얹는다. 밝은 방에서도 어두운 방에서도 보인다.
    ctx.strokeStyle = 'rgba(13, 16, 22, 0.85)';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.strokeStyle = '#f3eee6';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.setLineDash([]);
    label('여기로 마우스를 옮기면 시작', spawn.x, spawn.y - 44, 34, 'center');
}

/// H를 눌렀을 때 판정과 함께 나오는 눈금과 좌표.
///
/// 함정을 손으로 놓으려면 x·y를 눈으로 잴 수 있어야 한다. 이게 없으면
/// 숫자를 찍고 새로고침하기를 반복하게 된다. 120씩 끊은 건 방 하나가
/// 가로 8칸, 세로 6칸으로 떨어져서 머릿속으로 세기 쉬운 크기이기 때문이다.
function drawGrid() {
    const STEP = 120;

    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.beginPath();
    for (let x = STEP; x < ROOM_WIDTH; x += STEP) { ctx.moveTo(x, 0); ctx.lineTo(x, ROOM_HEIGHT); }
    for (let y = STEP; y < ROOM_HEIGHT; y += STEP) { ctx.moveTo(0, y); ctx.lineTo(ROOM_WIDTH, y); }
    ctx.stroke();
    ctx.restore();

    for (let x = STEP; x < ROOM_WIDTH; x += STEP) label(String(x), x + 5, 20, 22, 'left', '#cfd8e6');
    for (let y = STEP; y < ROOM_HEIGHT; y += STEP) label(String(y), 5, y - 5, 22, 'left', '#cfd8e6');

    // 커서를 따라다니는 좌표. 화면 밖으로 안 밀려나게 가장자리에서 붙잡는다.
    const x = Math.round(game.pointer.x);
    const y = Math.round(game.pointer.y);
    const at = (v, low, high) => Math.min(Math.max(v, low), high);
    label(`${x}, ${y}`, at(x, 70, ROOM_WIDTH - 70), at(y - 20, 30, ROOM_HEIGHT - 10), 32, 'center', '#ffe27a');
}

function drawHud() {
    const ink = '#f3eee6';
    label(`${game.roomIndex + 1} / ${ROOMS.length}  ${room().name}`, 20, 46, 34, 'left', ink);
    label(`들킨 횟수 ${game.deaths}`, ROOM_WIDTH - 20, 46, 34, 'right', ink);
}

function drawVeil(alpha) {
    ctx.fillStyle = `rgba(13, 16, 22, ${alpha})`;
    ctx.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
}

function drawDead() {
    drawVeil(0.72);
    label('들켰다', ROOM_WIDTH / 2, 320, 110, 'center');
    label(`${game.deaths}번째`, ROOM_WIDTH / 2, 390, 44, 'center', '#9fb0c8');

    // 방금 당한 것이 안 보이는 함정이었으면 그렇다고 말해준다.
    // 말해주지 않으면 화면에 갑자기 생긴 붉은 자국이 무엇인지 알 수 없다.
    const killer = room().hazards[game.last?.killedBy ?? -1];
    if (killer?.hidden) {
        label('안 보이는 것이 있었다', ROOM_WIDTH / 2, 442, 38, 'center', '#ff9ec4');
    }

    label('아무데나 눌러서 다시', ROOM_WIDTH / 2, 500, 40, 'center', '#9fb0c8');
}

/// 오프닝 한 장. 그림이 없으면 단색으로 버틴다.
function drawOpening() {
    const image = images[OPENING[Math.min(game.openingStep, OPENING.length - 1)].art];
    if (image) { ctx.drawImage(image, 0, 0, ROOM_WIDTH, ROOM_HEIGHT); return; }

    ctx.fillStyle = COLOR.floor;
    ctx.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
}

/// 엔딩. 간식을 먹고 잠든 그림 위에 아래쪽 띠만 얹는다.
/// 그림이 없으면 예전의 글자 화면으로 물러난다.
function drawEnding() {
    const image = images[ENDING_ART];
    if (!image) { drawClear(); return; }

    ctx.drawImage(image, 0, 0, ROOM_WIDTH, ROOM_HEIGHT);

    ctx.fillStyle = 'rgba(13, 16, 22, 0.72)';
    ctx.fillRect(0, ROOM_HEIGHT - 150, ROOM_WIDTH, 150);
    label('무사히 돌아왔다', ROOM_WIDTH / 2, ROOM_HEIGHT - 92, 60, 'center');
    label(`${game.deaths}번 들키고 왔다`, ROOM_WIDTH / 2, ROOM_HEIGHT - 50, 36, 'center', '#9fb0c8');
    label('아무데나 눌러서 처음부터', ROOM_WIDTH / 2, ROOM_HEIGHT - 18, 30, 'center', '#9fb0c8');
}

function drawClear() {
    drawVeil(0.86);
    label('편의점 도착', ROOM_WIDTH / 2, 300, 110, 'center');
    label(`${game.deaths}번 들키고 왔다`, ROOM_WIDTH / 2, 380, 46, 'center', '#9fb0c8');
    label('아무데나 눌러서 처음부터', ROOM_WIDTH / 2, 450, 36, 'center', '#9fb0c8');
}

function draw() {
    if (game.screen === 'title') {
        ctx.fillStyle = COLOR.floor;
        ctx.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
        return;
    }

    // 연출과, 그 뒤로 버튼이 떠 있는 동안은 같은 그림을 계속 깐다.
    if (game.screen === 'opening' || game.screen === 'intro') { drawOpening(); return; }

    if (game.screen === 'ending') { drawEnding(); return; }

    drawRoom(ctx, room(), game.last, images, {
        showHitboxes: game.showHitboxes,
        revealed: game.revealed,
        playerFrame: walkFrame(),
        showPlayer: game.showPlayer,
    });
    drawHud();

    if (game.showHitboxes) drawGrid();
    if (game.admin) game.editor?.drawOverlay(ctx);
    if (game.screen === 'ready') drawReadyMark();
    if (game.screen === 'dead') drawDead();
    if (game.screen === 'clear') drawClear();
    if (game.screen === 'ending') drawEnding();
}

/// 커서가 실제로 움직였을 때만 걷기 시계를 돌린다.
function advanceWalk(now) {
    const dt = game.lastFrameAt ? (now - game.lastFrameAt) / 1000 : 0;
    game.lastFrameAt = now;

    const moved = Math.hypot(game.pointer.x - game.lastPointer.x,
        game.pointer.y - game.lastPointer.y);
    game.lastPointer = { x: game.pointer.x, y: game.pointer.y };

    // 1px도 안 움직인 프레임은 걷는 것이 아니다.
    if (moved > 1 && game.screen === 'play') game.walkPhase += dt;
}

/// 지금 그릴 걷기 프레임. 멈춰 있으면 null이라 서 있는 그림이 나온다.
function walkFrame() {
    if (game.screen !== 'play' || game.walkPhase <= 0) return null;
    const step = Math.floor(game.walkPhase / WALK_FRAME_SECONDS) % IDOL_WALK.length;
    return IDOL_WALK[step];
}

function frame(now) {
    if (game.admin && !game.editPaused) {
        game.editTime += game.lastFrameAt ? (now - game.lastFrameAt) / 1000 : 0;
        game.editor?.tick();
    }

    advanceWalk(now);
    update(now);
    draw();
    requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

import { ROOMS } from './data/rooms.js';
import { stepRoom, ROOM_WIDTH, ROOM_HEIGHT } from './rules/room.js';
import { loadArt } from './view/art.js';
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

/// 방에 들어서면 커서가 시작 자리에 올 때까지 기다린다.
/// 이게 없으면 앞 방에서 커서가 있던 자리에 죄수가 튀어나와 그대로 죽는다.
const READY_RADIUS = 26;

const game = {
    screen: 'card',
    roomIndex: 0,
    deaths: 0,
    enteredAt: 0,
    pointer: { x: ROOM_WIDTH / 2, y: ROOM_HEIGHT / 2 },
    last: null,
    showHitboxes: false,
    name: '범죄자',
    crime: '이름 자체가 죄',
};

const room = () => ROOMS[game.roomIndex];

function enterRoom(index) {
    game.roomIndex = index;
    game.screen = 'ready';
    game.enteredAt = performance.now();
    game.last = null;
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
    if (game.screen === 'dead') { enterRoom(game.roomIndex); return; }
    if (game.screen === 'clear') { game.deaths = 0; enterRoom(startRoom); }
});

addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if (key === 'h') game.showHitboxes = !game.showHitboxes;
    if (key === 'm') audio.setMuted(!audio.muted);
});

document.getElementById('card').addEventListener('submit', event => {
    event.preventDefault();
    game.name = document.getElementById('name').value.trim() || '범죄자';
    game.crime = document.getElementById('crime').value.trim() || '이름 자체가 죄';
    document.getElementById('card').hidden = true;
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

    if (game.screen !== 'play') return;

    const t = (now - game.enteredAt) / 1000;
    const state = stepRoom(room(), game.pointer.x, game.pointer.y, t);
    game.last = state;

    if (state.dead) {
        game.deaths++;
        game.screen = 'dead';
        audio.play('death');
        return;
    }

    if (state.cleared) {
        if (game.roomIndex + 1 < ROOMS.length) {
            audio.play('clear');
            enterRoom(game.roomIndex + 1);
        } else {
            audio.play('win');
            game.screen = 'clear';
        }
    }
}

function label(text, x, y, size, align = 'left', color = '#2b2118') {
    ctx.font = `${size}px "Nanum Pen Script", "Gaegu", system-ui, sans-serif`;
    ctx.textAlign = align;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
}

function drawReadyMark() {
    const spawn = room().spawn;
    ctx.strokeStyle = '#2b2118';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(spawn.x, spawn.y, READY_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    label('여기로 마우스를 옮기면 시작', spawn.x, spawn.y - 44, 34, 'center');
}

function drawHud() {
    // 위쪽이 어두운 벽인 방이 많아 밝은 글자로 쓴다. 어두운 글자로 쓰면 벽에 묻힌다.
    const ink = '#f4efe6';
    label(`${game.roomIndex + 1} / ${ROOMS.length}  ${room().name}`, 20, 46, 34, 'left', ink);
    label(`죽은 횟수 ${game.deaths}`, ROOM_WIDTH - 20, 46, 34, 'right', ink);
}

function drawVeil(alpha) {
    ctx.fillStyle = `rgba(250, 248, 243, ${alpha})`;
    ctx.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
}

function drawDead() {
    drawVeil(0.74);
    label('죽었다', ROOM_WIDTH / 2, 320, 110, 'center');
    label(`${game.deaths}번째`, ROOM_WIDTH / 2, 390, 44, 'center', '#6b5b4c');
    label('아무데나 눌러서 다시', ROOM_WIDTH / 2, 470, 40, 'center', '#6b5b4c');
}

function drawClear() {
    drawVeil(0.86);
    label('탈출 성공', ROOM_WIDTH / 2, 300, 110, 'center');
    label(`${game.name} — ${game.crime}`, ROOM_WIDTH / 2, 370, 40, 'center', '#6b5b4c');
    label(`${game.deaths}번 죽고 나왔다`, ROOM_WIDTH / 2, 430, 46, 'center', '#6b5b4c');
    label('아무데나 눌러서 처음부터', ROOM_WIDTH / 2, 500, 36, 'center', '#6b5b4c');
}

function draw() {
    if (game.screen === 'card') {
        ctx.fillStyle = COLOR.floor;
        ctx.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
        return;
    }

    drawRoom(ctx, room(), game.last, images, game.showHitboxes);
    drawHud();

    if (game.screen === 'ready') drawReadyMark();
    if (game.screen === 'dead') drawDead();
    if (game.screen === 'clear') drawClear();
}

function frame(now) {
    update(now);
    draw();
    requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

import { ROOMS } from './data/rooms.js';
import { stepRoom, ROOM_WIDTH, ROOM_HEIGHT } from './rules/room.js';
import { toRoomDelta, movedPointer } from './view/pointer.js';
import { loadArt, caughtArtFor, IDOL_WALK, WALK_FRAME_SECONDS } from './view/art.js';
import { createAudio, musicFor } from './view/audio.js';
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

    /// 마우스를 브라우저가 붙잡고 있는가.
    ///
    /// 붙잡고 있으면 커서는 사라지고 <b>"얼마나 움직였는지"만</b> 온다.
    /// 그러면 주인공의 자리를 게임이 온전히 정할 수 있어서, 방을 넘어갈 때
    /// 시작 자리에 세워놓고 곧바로 조작할 수 있다.
    ///
    /// 못 잡았을 때(터치, 거절, Esc)는 예전처럼 커서 자리를 그대로 쓴다.
    locked: false,

    /// 다시 시작하려면 커서가 와야 하는 자리. 마우스를 못 붙잡았을 때만 쓴다.
    ///
    /// 방에 들어갈 때는 시작 자리, Esc로 놓았을 때는 <b>주인공이 서 있던 자리</b>다.
    /// 놓은 자리에서 이어가야 하니까 — 시작 자리로 되돌리면 지나온 길을 또 가야 한다.
    readyAt: { ...ROOMS[startRoom].spawn },

    /// 다시 시작할 때 돌려놓을 방 시계(초).
    ///
    /// 방에 들어갈 때와 들킨 뒤에는 0이지만, <b>Esc로 놓았을 때는 놓은 그 순간</b>이다.
    /// 0으로 되돌리면 안 움직였는데 죽는다 — 방금 지나간 시야가 다시 그 자리에 온다.
    /// 반대로 Esc를 연타해 함정 박자를 처음으로 되감는 꼼수도 된다.
    readyT: 0,

    /// game.pointer가 <b>진짜 커서에서 온 값인가.</b>
    ///
    /// 잠긴 동안 pointer는 게임이 셈한 주인공 자리지 커서 자리가 아니다.
    /// 놓는 순간 브라우저는 커서를 잠그기 시작한 자리로 되돌려 놓는데,
    /// 그걸 모르고 "커서가 이미 제자리에 있다"고 판단하면 멈추자마자 풀리고,
    /// 다음 마우스 움직임에 주인공이 그 옛 자리로 순간이동한다.
    pointerFresh: true,

    /// 마지막 손길이 터치였는가. <b>터치 기기에서는 마우스를 붙잡으면 안 된다.</b>
    /// 붙잡으면 "움직인 거리"만 오는데 터치에는 그런 것이 없어서 조작이 통째로 막힌다.
    touching: false,

    /// 지금 끌고 있는 손가락의 번호와 마지막 자리.
    ///
    /// <b>터치는 트랙패드처럼 쓴다.</b> 짚은 자리로 주인공이 옮겨가는 것이 아니라,
    /// 화면 아무 데나 끌면 그 움직인 만큼 간다. 이유가 둘이다 —
    /// 손가락이 주인공을 가리지 않고, 손을 뗐다 다시 짚어도 주인공이 안 튄다.
    /// 짚은 자리로 옮기면 함정을 뛰어넘는 꼼수가 되고, 반대로 즉사도 한다.
    touchId: null,
    touchFrom: null,

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
    game.enteredAt = performance.now();

    // 마우스를 붙잡고 있으면 <b>기다릴 이유가 없다.</b> 주인공을 시작 자리에
    // 세워놓고 바로 시작한다 — 커서가 따로 있지 않으니 튀어나올 자리도 없다.
    //
    // 못 붙잡았으면 예전 규칙을 쓴다. 커서가 시작 자리에 올 때까지 기다린다.
    // 이게 없으면 앞 방에서 커서가 있던 자리에 주인공이 튀어나와 그대로 죽는다.
    game.readyAt = { ...ROOMS[index].spawn };
    game.readyT = 0;
    game.pointerFresh = !holdsPosition();

    if (holdsPosition()) {
        game.pointer = { ...game.readyAt };
        game.screen = 'play';
    } else {
        game.screen = 'ready';
    }

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

const ROOM = { width: ROOM_WIDTH, height: ROOM_HEIGHT };

/// 주인공 자리를 <b>게임이 들고 있는가.</b>
///
/// 마우스를 붙잡았거나 터치일 때가 그렇다. 둘 다 "움직인 거리"만 받는다.
/// 그러면 방을 넘어갈 때 시작 자리에 세워놓고 곧바로 조작할 수 있다.
/// 커서를 그대로 따라가는 것(붙잡기 전 마우스)만 예외다.
const holdsPosition = () => game.locked || game.touching;

/// 끌고 있는 손가락을 찾는다. 번호로 집는 것이 중요하다 —
/// 두 번째 손가락이 내려앉을 때 아무거나 집으면 주인공이 그만큼 튄다.
function trackedTouch(event) {
    if (game.touchId === null) return null;
    for (const list of [event.changedTouches, event.touches]) {
        for (const touch of list ?? []) if (touch.identifier === game.touchId) return touch;
    }
    return null;
}

function onTouchStart(event) {
    game.touching = true;

    // 터치로 들어왔으면 키 안내는 쓸모가 없다. 한 번만 지운다.
    document.getElementById('keys')?.remove();
    if (game.touchId !== null) return;          // 이미 하나를 끌고 있다

    const touch = event.changedTouches[0];
    game.touchId = touch.identifier;
    game.touchFrom = { x: touch.clientX, y: touch.clientY };
    event.preventDefault();

    // 기다리는 중이었으면 짚는 것만으로 시작한다. <b>시작 자리를 정확히
    // 짚으라고 하면 안 된다</b> — 그 자리가 손가락에 가려 안 보인다.
    if (game.screen === 'ready') { game.pointer = { ...game.readyAt }; resumePlay(); return; }

    // 들킴·엔딩 화면도 짚어서 넘긴다. 터치에서는 click이 안 만들어진다.
    advanceScreen();
}

function onTouchMove(event) {
    const touch = trackedTouch(event);
    if (!touch) return;
    event.preventDefault();

    // <b>끈 만큼만</b> 움직인다. 짚은 자리로 옮기지 않는다.
    const delta = toRoomDelta(
        { x: touch.clientX - game.touchFrom.x, y: touch.clientY - game.touchFrom.y },
        canvas.getBoundingClientRect(), ROOM);
    game.touchFrom = { x: touch.clientX, y: touch.clientY };
    game.pointer = movedPointer(game.pointer, delta, ROOM);
}

function onTouchEnd(event) {
    // <b>끝난 손가락은 changedTouches에만 있다.</b> touches까지 뒤지면
    // 두 번째 손가락을 뗐을 뿐인데 끌고 있던 첫 손가락을 놓아버린다.
    const ended = [...event.changedTouches].some(t => t.identifier === game.touchId);
    if (!ended) return;

    // 아직 남은 손가락이 있으면 그것으로 이어 끈다. 자리는 그대로 두고
    // 기준점만 그 손가락으로 옮긴다 — 안 그러면 손가락을 바꿀 때 주인공이 튄다.
    const next = event.touches[0];
    if (next) {
        game.touchId = next.identifier;
        game.touchFrom = { x: next.clientX, y: next.clientY };
        return;
    }

    game.touchId = null;
    game.touchFrom = null;
}

function onPointerMove(event) {
    if (game.locked) {
        // 잠긴 동안 들어온 터치는 버린다. 절대 좌표를 그대로 쓰면
        // 주인공이 화면 반대쪽으로 순간이동해 그대로 죽는다.
        if (event.touches) { event.preventDefault(); return; }

        // 붙잡고 있을 때는 커서 자리가 없다. 움직인 만큼 더해 나간다.
        const delta = toRoomDelta(
            { x: event.movementX, y: event.movementY },
            canvas.getBoundingClientRect(), ROOM);
        game.pointer = movedPointer(game.pointer, delta, ROOM);
        return;
    }

    // 진짜 마우스가 움직였다. <b>터치를 쓰다가 마우스로 바꾼 것이다.</b>
    //
    // 아이패드+트랙패드나 터치 노트북에서 일어난다. 그냥 넘기면 안 된다 —
    // 터치인 줄 알고 시작 자리에 세워둔 주인공이 다음 마우스 움직임에
    // 커서 자리로 튀어, 함정을 건너뛰거나 그대로 죽는다.
    // 잠금이 풀렸을 때와 같은 길로 보낸다: 그 자리에서 멈추고 커서를 기다린다.
    if (game.touching) {
        game.touching = false;
        if (game.screen === 'play') holdHere();
    }

    game.pointer = toGameCoords(event);
    game.pointerFresh = true;
}

/// 마우스를 붙잡아 달라고 부탁한다. 거절당해도 조용히 넘어간다 —
/// 그때는 예전 방식(커서 자리를 그대로 쓰기)으로 그냥 돌아간다.
function grabMouse() {
    // 터치 기기에서 붙잡으면 조작이 통째로 막힌다.
    if (game.admin || game.locked || game.touching) return;
    try {
        const asked = canvas.requestPointerLock?.();
        if (asked?.catch) asked.catch(() => { });
    } catch { /* 안 되면 안 되는 대로 */ }
}

/// 멈춰 있던 자리에서 이어 간다. <b>함정 시계도 그 자리에서 이어진다.</b>
function resumePlay() {
    game.screen = 'play';
    game.enteredAt = performance.now() - game.readyT * 1000;
}

/// 지금 자리에서 멈춘다. 커서가 그 자리에 오거나 화면을 누르면 다시 간다.
///
/// <b>'멈춤'이라는 상태를 따로 두지 않는다.</b> 처음에 따로 뒀더니 마우스를
/// 못 붙잡는 환경에서 거기서 빠져나올 길이 없었다 — 누르면 붙잡기만 시도하고,
/// 거절당하면 영영 멈춘 채로 남았다. 기다리는 화면은 원래 있던 것 하나면 된다.
function holdHere() {
    game.readyAt = { ...game.pointer };
    game.readyT = (performance.now() - game.enteredAt) / 1000;
    game.screen = 'ready';

    // 커서가 어디 있는지 아직 모른다. 진짜 움직임이 한 번 올 때까지 기다린다.
    game.pointerFresh = false;
}

document.addEventListener('pointerlockchange', () => {
    game.locked = document.pointerLockElement === canvas;

    // 붙잡은 순간 기다릴 이유가 없어진다. 기다리던 자리에 세우고 곧바로 간다.
    if (game.locked && game.screen === 'ready') {
        game.pointer = { ...game.readyAt };
        resumePlay();
        return;
    }

    // Esc로 풀렸다. 게임 중이었으면 그 자리에서 멈춘다 —
    // 손을 뗀 사이에 죽으면 자기가 뭘 잘못했는지 알 수 없는 죽음이 된다.
    if (!game.locked && game.screen === 'play' && !game.admin) holdHere();
});

document.addEventListener('pointerlockerror', () => { game.locked = false; });

canvas.addEventListener('mousemove', onPointerMove);
canvas.addEventListener('touchstart', onTouchStart, { passive: false });
canvas.addEventListener('touchmove', onTouchMove, { passive: false });
canvas.addEventListener('touchend', onTouchEnd);
canvas.addEventListener('touchcancel', onTouchEnd);

// 버튼을 눌러 들어와도 터치인 줄 알아야 한다. 모르면 마우스를 붙잡으려 들고,
// 붙잡히면 터치에는 움직인 거리가 안 와서 조작이 통째로 막힌다.
addEventListener('touchstart', () => { game.touching = true; }, { passive: true, capture: true });

canvas.addEventListener('click', () => {
    // 판정 보기(H) 중에는 누른 자리를 콘솔에 남긴다. rooms.js에 그대로 붙여넣으면 된다.
    if (game.showHitboxes) {
        const x = Math.round(game.pointer.x);
        const y = Math.round(game.pointer.y);
        console.log(`x: ${x}, y: ${y}`);
    }

    advanceScreen();
});

/// "아무데나 눌러서 다시" 같은 것들. <b>클릭과 터치가 같은 길을 쓴다.</b>
///
/// 터치에서는 캔버스가 preventDefault를 부르므로 click이 안 만들어진다.
/// 클릭에만 적어두면 모바일에서 들킨 뒤 다시 시작을 못 한다 —
/// 이 게임은 계속 죽으니 그대로 갇힌다.
function advanceScreen() {
    if (game.screen === 'opening') { showIntro(); return; }

    // 기다리는 중에 누르면 마우스를 붙잡아 본다. 붙잡히면 곧바로 이어진다.
    // 안 붙잡혀도 괜찮다 — 커서를 그 자리로 옮기면 예전처럼 시작된다.
    if (game.screen === 'ready') { grabMouse(); return; }
    if (game.screen === 'dead') { grabMouse(); restartRoom(); return; }

    if (game.screen === 'ending' || game.screen === 'clear') { game.deaths = 0; showTitle(); }
}

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

    // 편집기는 진짜 커서로 끌고 놓는 것이라 마우스를 놓아줘야 한다.
    // 다시 닫으면 '멈췄다'가 뜨고, 누르면 그때 다시 붙잡는다.
    if (game.admin) document.exitPointerLock?.();

    if (!game.admin) {
        // 꺼둔 채로 편집기를 닫으면 주인공 없는 게임이 된다. 반드시 되돌린다.
        game.showPlayer = true;
        game.editor?.setOpen(false);

        // 마우스를 다시 붙잡으려면 사람의 손길이 필요하다. 그 자리에서 기다린다.
        if (game.screen === 'play') holdHere();
        return;
    }

    // 타이틀이나 연출 중에 눌렀어도 곧장 방으로 들어간다.
    titleScreen.hidden = true;
    introScreen.hidden = true;

    // 방 밖(타이틀·연출·엔딩)에서 눌렀을 때만 방을 새로 연다.
    // <b>기다리는 중이었으면 그대로 둔다</b> — enterRoom을 부르면 함정 시계도
    // 드러난 숨은 함정 기억도 초기화되어, 10초까지 온 것이 0초로 되감긴다.
    if (['title', 'opening', 'intro', 'ending'].includes(game.screen)) {
        enterRoom(game.roomIndex);
    }
    if (game.screen !== 'play') resumePlay();

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
    // 잠긴 채로 타이틀에 오면 마우스 이벤트가 전부 캔버스로 가서
    // [게임 시작] 버튼을 누를 수가 없다. 게임 밖에서는 진짜 커서를 돌려준다.
    document.exitPointerLock?.();
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

const startButton = document.getElementById('start');

// 버튼에 커서가 닿을 때. 누르기 전에 "눌리는 것"임을 소리가 먼저 알려준다.
for (const button of [startButton, goButton]) {
    button.addEventListener('mouseenter', () => audio.play('hover'));
}

startButton.addEventListener('click', () => {
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

    // 누른 것이 사람의 손길이라 여기서만 마우스를 붙잡을 수 있다.
    // 붙잡히면 이 방부터 기다림이 사라진다.
    grabMouse();
    enterRoom(startRoom);
});

function update(now) {
    if (game.screen === 'ready') {
        const at = game.readyAt;

        // 멈춰 있는 동안 보여주는 것은 <b>다시 시작할 그 순간의 모습</b>이다.
        // 0초의 모습을 보여주면 눈으로 본 것과 시작하는 것이 달라진다.
        game.last = stepRoom(room(), at.x, at.y, game.readyT);

        // 진짜 커서가 한 번이라도 움직였어야 자리를 견줄 수 있다.
        const reached = game.pointerFresh
            && Math.hypot(game.pointer.x - at.x, game.pointer.y - at.y) <= READY_RADIUS;
        if (reached) resumePlay();
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

        return;
    }

    if (state.cleared) {
        if (game.roomIndex + 1 < ROOMS.length) {
            enterRoom(game.roomIndex + 1);
        } else {
            document.exitPointerLock?.();
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
    const spawn = game.readyAt;
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

    // 소리가 꺼져 있으면 그렇다고 말한다. M을 눌렀는지, ?mute=1로 들어왔는지
    // <b>화면에 표가 안 나면 소리가 고장 난 줄 안다.</b> 실제로 그렇게 헤맸다.
    if (audio.muted) label('소리 꺼짐 — M', 20, 84, 26, 'left', '#9fb0c8');
}

function drawVeil(alpha) {
    ctx.fillStyle = `rgba(13, 16, 22, ${alpha})`;
    ctx.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
}

/// 들킴 화면. 무엇에 들켰느냐에 따라 그림이 다르다.
///
/// 글자는 그림이 있든 없든 <b>같은 자리에 같은 말이 나온다.</b> 그림은 뒤에
/// 깔리는 것이고, 무엇을 말해주는지는 안 바뀐다 — 그림이 아직 없던 때와
/// 같은 화면을 읽을 수 있어야 한다.
function drawDead() {
    const killer = room().hazards[game.last?.killedBy ?? -1];
    const image = images[caughtArtFor(killer)];

    if (image) {
        ctx.drawImage(image, 0, 0, ROOM_WIDTH, ROOM_HEIGHT);
        // 그림 위에서도 글자가 읽혀야 한다. 다만 0.72로 덮으면 그림이 안 보인다.
        drawVeil(0.42);
    } else {
        drawVeil(0.72);
    }

    label('들켰다', ROOM_WIDTH / 2, 320, 110, 'center');
    label(`${game.deaths}번째`, ROOM_WIDTH / 2, 390, 44, 'center', '#9fb0c8');

    // 방금 당한 것이 안 보이는 함정이었으면 그렇다고 말해준다.
    // 말해주지 않으면 화면에 갑자기 생긴 붉은 자국이 무엇인지 알 수 없다.
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
    // 지금 화면에 맞는 곡. 이미 그게 돌고 있으면 아무 일도 안 한다.
    // 화면을 바꾸는 자리마다 곡을 같이 갈면 언젠가 한 군데를 잊는다.
    audio.playMusic(musicFor(game.screen));

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

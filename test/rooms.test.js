import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOMS } from '../src/data/rooms.js';
import { stepRoom, ROOM_WIDTH, ROOM_HEIGHT, PLAYER_RADIUS } from '../src/rules/room.js';
import { shapeHitsCircle, shapeAt } from '../src/rules/hazards.js';

/// 15초를 1/60초 간격으로 훑는다. 방에 있는 가장 긴 주기보다 넉넉히 길다.
function* everyFrame(seconds = 15) {
    for (let frame = 0; frame < seconds * 60; frame++) yield frame / 60;
}

test('모든 방이 필요한 것을 다 갖고 있다', () => {
    assert.ok(ROOMS.length > 0);

    for (const room of ROOMS) {
        assert.ok(room.name, '이름이 없는 방이 있다');
        assert.ok(room.spawn && room.exit, `${room.name}에 시작 자리나 출구가 없다`);
        assert.ok(room.hazards.length > 0, `${room.name}에 함정이 하나도 없다`);
    }
});

test('시작 자리는 언제나 안전하다', () => {
    // 이게 깨지면 아무것도 안 했는데 죽는 방이 된다. 다시 시작해도 또 죽으니
    // 플레이어는 자기가 뭘 잘못했는지 영원히 알 수 없다.
    for (const room of ROOMS) {
        for (const t of everyFrame()) {
            const state = stepRoom(room, room.spawn.x, room.spawn.y, t);
            assert.equal(state.dead, false,
                `${room.name}: 시작 자리가 ${t.toFixed(2)}초에 죽는다`);
        }
    }
});

test('시작하자마자 깨지는 방은 없다', () => {
    for (const room of ROOMS) {
        const state = stepRoom(room, room.spawn.x, room.spawn.y, 0);
        assert.equal(state.cleared, false, `${room.name}: 시작 자리가 출구 안이다`);
    }
});

/// 출구에 닿으면서 안 죽는 자리가 있는가. 있으면 그 자리와 시각, 없으면 null.
///
/// <b>출구 전체를 훑는다.</b> 예전에는 한가운데만 찍어봤는데, 문을 벽에 걸쳐
/// 놓으면 — 문틀 위쪽이 벽에 묻히게 놓는 것은 자연스럽다 — 한가운데가 늘 벽
/// 안이라 "못 깨는 방"이라고 우겼다. 실제로는 문 아래쪽으로 들어갈 수 있었다.
/// 검사가 멀쩡한 방을 막으면 방 짜는 사람이 검사를 안 믿게 된다.
function wayIntoExit(room) {
    const e = room.exit;

    // 닿기만 하면 통과다. 그래서 <b>서 있을 수 있는 자리는 출구보다 반지름만큼
    // 넓다.</b> 출구 안쪽만 훑으면 문틀에 살짝 걸치는 자리를 못 봐서,
    // 깰 수 있는 방을 못 깬다고 우긴다.
    const left = Math.max(PLAYER_RADIUS, e.x - PLAYER_RADIUS);
    const right = Math.min(ROOM_WIDTH - PLAYER_RADIUS, e.x + e.w + PLAYER_RADIUS);
    const top = Math.max(PLAYER_RADIUS, e.y - PLAYER_RADIUS);
    const bottom = Math.min(ROOM_HEIGHT - PLAYER_RADIUS, e.y + e.h + PLAYER_RADIUS);

    // 훑을 점 수에 상한을 둔다. 출구를 화면만 하게 늘려놓고 막아버리면
    // 900프레임 × 넓이가 되어 저장이 안 끝난다 — 편집기에서 숫자를 아무렇게나
    // 넣을 수 있으니 실제로 일어난다. 촘촘함보다 끝나는 것이 먼저다.
    //
    // <b>격자보다 좁은 틈은 못 본다.</b> 2px보다 좁은 길만 남은 방은 "못 깬다"고
    // 나온다. 사람 손으로 통과할 수 있는 틈이 아니므로 그걸로 친다.
    const FINEST = 2;
    const BUDGET = 2400;
    const points = ((right - left) / FINEST + 1) * ((bottom - top) / FINEST + 1);
    const step = Math.max(FINEST, FINEST * Math.sqrt(Math.max(1, points) / BUDGET));

    // <b>끝점을 반드시 넣는다.</b> 성긴 격자가 오른쪽·아래 끝을 건너뛰면,
    // 벽에 밀려 가장자리에만 남은 안전한 띠를 통째로 못 본다.
    const along = (from, to) => {
        const out = [];
        for (let v = from; v < to; v += step) out.push(v);
        out.push(to);
        return out;
    };
    const xs = along(left, right);
    const ys = along(top, bottom);

    for (const t of everyFrame()) {
        for (const x of xs) {
            for (const y of ys) {
                const state = stepRoom(room, x, y, t);
                if (state.cleared && !state.dead) return { t: +t.toFixed(2), x, y };
            }
        }
    }
    return null;
}

test('출구에 설 수 있는 순간이 있다', () => {
    // 출구가 함정에 영영 덮여 있으면 깰 수 없는 방이다.
    for (const room of ROOMS) {
        assert.notEqual(wayIntoExit(room), null,
            `${room.name}: 출구 어디에도, 15초 어느 때에도 설 수가 없다 — 못 깨는 방이다`);
    }
});

test('출구가 벽에 걸쳐 있어도 아래로 들어갈 수 있으면 괜찮다', () => {
    // 이걸 막으면 문을 벽에 붙여 놓는 자연스러운 배치를 못 하게 된다.
    const room = {
        name: '검사용',
        spawn: { x: 480, y: 650 },
        exit: { x: 449, y: 64, w: 60, h: 105 },
        hazards: [{ kind: 'rect', x: 0, y: -25, w: 960, h: 159 }],
        props: [],
    };

    const way = wayIntoExit(room);
    assert.notEqual(way, null, '문 아래쪽으로 들어갈 수 있어야 한다');
    assert.ok(way.y > 134, '벽 아래에서 닿아야 한다');
});

test('출구 바로 바깥에 서서 닿는 것도 찾아낸다', () => {
    // 출구 안쪽에는 못 서지만 문턱 아래에 붙어 서면 닿는 방. 닿기만 하면 통과다.
    const room = {
        name: '문턱',
        spawn: { x: 480, y: 650 },
        exit: { x: 100, y: 100, w: 60, h: 60 },
        hazards: [{ kind: 'rect', x: 0, y: 0, w: 960, h: 158 }],
        props: [],
    };

    const way = wayIntoExit(room);
    assert.notEqual(way, null, '출구 밖에 서서 닿는 자리를 놓쳤다');
    assert.ok(way.y > 160, '벽 아래에 서야 한다');
});

test('커다란 출구에서 가장자리에만 길이 남아도 찾아낸다', () => {
    // 성긴 격자가 끝을 건너뛰면 깰 수 있는 방을 못 깬다고 우긴다.
    const room = {
        name: '가장자리',
        spawn: { x: 480, y: 650 },
        exit: { x: 0, y: 0, w: 960, h: 720 },
        hazards: [{ kind: 'rect', x: -50, y: -50, w: 995, h: 900 }],
        props: [],
    };

    const way = wayIntoExit(room);
    assert.notEqual(way, null, '오른쪽 끝에 남은 띠를 놓쳤다');
    assert.ok(way.x > 945, `오른쪽 끝에서 찾아야 하는데 x=${way?.x}`);
});

test('출구가 화면만 해도 검사가 끝난다', () => {
    // 편집기에서 숫자를 아무렇게나 넣을 수 있다. 저장이 안 끝나면 안 된다.
    const room = {
        name: '커다란 문',
        spawn: { x: 480, y: 650 },
        exit: { x: 0, y: 0, w: 960, h: 720 },
        hazards: [{ kind: 'rect', x: -50, y: -50, w: 1100, h: 900 }],
        props: [],
    };

    const began = Date.now();
    assert.equal(wayIntoExit(room), null);
    assert.ok(Date.now() - began < 3000, `너무 오래 걸린다 (${Date.now() - began}ms)`);
});

test('출구가 통째로 덮여 있으면 잡아낸다', () => {
    // 느슨해진 김에 진짜 못 깨는 방도 여전히 잡는지 본다.
    const room = {
        name: '막힌 방',
        spawn: { x: 480, y: 650 },
        exit: { x: 449, y: 64, w: 60, h: 105 },
        hazards: [{ kind: 'rect', x: 400, y: 0, w: 200, h: 300 }],
        props: [],
    };

    assert.equal(wayIntoExit(room), null);
});

test('방 밖으로는 못 나간다', () => {
    const room = ROOMS[0];

    const left = stepRoom(room, -500, 400, 0);
    assert.equal(left.x, PLAYER_RADIUS);

    const bottomRight = stepRoom(room, 99999, 99999, 0);
    assert.equal(bottomRight.x, ROOM_WIDTH - PLAYER_RADIUS);
    assert.equal(bottomRight.y, ROOM_HEIGHT - PLAYER_RADIUS);
});

test('죽는 것이 도착보다 먼저다', () => {
    // 출구 위에 늘 켜진 함정을 얹은 가짜 방. 죽으면서 통과하면 안 된다.
    const trapped = {
        name: '시험',
        spawn: { x: 10, y: 10 },
        exit: { x: 400, y: 400, w: 60, h: 60 },
        hazards: [{ kind: 'rect', x: 400, y: 400, w: 60, h: 60 }],
        props: [],
    };

    const state = stepRoom(trapped, 430, 430, 0);
    assert.equal(state.dead, true);
    assert.equal(state.cleared, false);
});

/// 가로지르는 함정이 방 한가운데에 들어와 있는 때. 없으면 null.
///
/// <b>화면을 지나가기만 하고 방에 안 들어오는 함정</b>은 놓은 사람이 실수한 것이다.
/// y를 잘못 줘서 도로가 아니라 화면 아래를 지나가는 차 같은 것 — 검사가 잡는다.
function momentInsideRoom(hazard) {
    for (let t = 0; t < 30; t += 0.05) {
        const shape = shapeAt(hazard, t);
        if (shape.gone) continue;

        const inside = shape.x >= 0 && shape.x + shape.w <= ROOM_WIDTH
            && shape.y >= 0 && shape.y + shape.h <= ROOM_HEIGHT;
        if (inside) return Math.round(t * 100) / 100;
    }
    return null;
}

test('함정에 닿으면 죽는다', () => {
    // 특정 좌표를 적어두지 않는다. 방을 고칠 때마다 이 검사가 같이 깨져서
    // 진짜 고장과 방 수정을 구별할 수 없게 되기 때문이다.
    // 모든 방의 가만히 있는 함정을 한가운데에서 밟아본다.
    let checked = 0;

    for (const room of ROOMS) {
        for (const hazard of room.hazards) {
            if (hazard.kind !== 'rect') continue;

            // 가로지르는 것은 <b>화면 밖에서 시작한다.</b> 그래서 0초에 밟아보면
            // 방 밖이라 못 밟는다. 방 안에 들어와 있는 순간을 찾아서 밟는다.
            const t = hazard.travel ? momentInsideRoom(hazard) : 0;
            assert.ok(t !== null, `${room.name}: ${hazard.art}가 방 안에 들어오는 때가 없다`);

            const shape = shapeAt(hazard, t);
            const state = stepRoom(room, shape.x + shape.w / 2, shape.y + shape.h / 2, t);
            assert.equal(state.dead, true,
                `${room.name}: ${hazard.art ?? '벽'} 한가운데를 밟았는데 안 죽는다 (${t}초)`);
            checked++;
        }
    }

    assert.ok(checked > 0, '가만히 있는 함정이 한 방에도 없다');
});

test('소품이 벽에 가려 안 보이는 자리에 있지 않다', () => {
    // 소품은 판정이 없어서 벽 안에 넣어도 게임은 아무 말도 안 한다.
    // 그림만 영영 안 보일 뿐이라 화면을 봐도 빠진 줄을 모른다.
    const contains = (outer, inner) =>
        inner.x >= outer.x && inner.y >= outer.y &&
        inner.x + inner.w <= outer.x + outer.w &&
        inner.y + inner.h <= outer.y + outer.h;

    for (const room of ROOMS) {
        for (const prop of room.props ?? []) {
            for (const hazard of room.hazards) {
                if (hazard.kind !== 'rect') continue;
                assert.equal(contains(hazard, prop), false,
                    `${room.name}: 소품 ${prop.name}이 벽 안에 묻혀 있다`);
            }
        }
    }
});

test('방이 여섯 개다', () => {
    assert.equal(ROOMS.length, 6);
});

test('안 보이는 함정은 마지막 방에만 있다', () => {
    // 배울 것을 다 배운 뒤라야 농담이 된다. 앞 방에 숨겨두면
    // 아직 규칙도 모르는 사람이 보이지 않는 것에 당한다.
    ROOMS.forEach((room, index) => {
        const hidden = room.hazards.filter(h => h.hidden);
        if (index === ROOMS.length - 1) return;
        assert.equal(hidden.length, 0, `${room.name}: 마지막 방이 아닌데 숨은 함정이 있다`);
    });

    const last = ROOMS[ROOMS.length - 1];
    assert.ok(last.hazards.some(h => h.hidden), '마지막 방에 숨은 함정이 하나도 없다');
});

test('안 보이는 함정은 시작 자리에서 멀리 있다', () => {
    // 들어서자마자 보이지 않는 것에 당하면 뭘 잘못했는지 알 수 없다.
    // 이 장르에서 가장 나쁜 죽음이다.
    const SAFE = 90;

    for (const room of ROOMS) {
        for (const hazard of room.hazards) {
            if (!hazard.hidden) continue;
            for (const t of everyFrame(5)) {
                const near = stepRoom(room, room.spawn.x, room.spawn.y, t).shapes
                    .filter(shape => shape.of === hazard)
                    .some(shape => shapeHitsCircle(shape, room.spawn.x, room.spawn.y, SAFE));
                assert.equal(near, false,
                    `${room.name}: 숨은 함정이 시작 자리 ${SAFE}px 안에 있다`);
            }
        }
    }
});

test('누가 죽였는지 정확히 가리킨다', () => {
    // 이걸 모르면 당한 숨은 함정을 드러낼 수가 없다.
    const room = {
        name: '시험',
        spawn: { x: 10, y: 10 },
        exit: { x: 900, y: 700, w: 20, h: 20 },
        hazards: [
            { kind: 'rect', x: 100, y: 100, w: 50, h: 50 },
            { kind: 'rect', x: 300, y: 300, w: 50, h: 50 },
        ],
        props: [],
    };

    assert.equal(stepRoom(room, 325, 325, 0).killedBy, 1);
    assert.equal(stepRoom(room, 125, 125, 0).killedBy, 0);
    assert.equal(stepRoom(room, 600, 600, 0).killedBy, -1, '안 죽었으면 -1이다');
});

test('둘이 동시에 닿으면 앞의 것을 가리킨다', () => {
    // 정해두지 않으면 드러나는 함정이 프레임마다 바뀌어 깜빡인다.
    const room = {
        name: '시험',
        spawn: { x: 10, y: 10 },
        exit: { x: 900, y: 700, w: 20, h: 20 },
        hazards: [
            { kind: 'rect', x: 200, y: 200, w: 60, h: 60 },
            { kind: 'rect', x: 200, y: 200, w: 60, h: 60 },
        ],
        props: [],
    };

    assert.equal(stepRoom(room, 230, 230, 0).killedBy, 0);
});

test('시작 자리는 점이 아니라 그 둘레까지 안전하다', () => {
    // main.js가 시작 자리에서 READY_RADIUS 안이면 어디서든 시작시킨다.
    // 연출 버튼을 가장자리로 누른 경우가 그렇다. 점 하나만 안전해서는 모자란다.
    const READY_RADIUS = 26;

    for (const room of ROOMS) {
        for (let deg = 0; deg < 360; deg += 15) {
            const x = room.spawn.x + Math.cos(deg * Math.PI / 180) * READY_RADIUS;
            const y = room.spawn.y + Math.sin(deg * Math.PI / 180) * READY_RADIUS;

            for (const t of everyFrame()) {
                assert.equal(stepRoom(room, x, y, t).dead, false,
                    `${room.name}: 시작 자리 ${deg}° 둘레가 ${t.toFixed(2)}초에 죽는다`);
            }
        }
    }
});

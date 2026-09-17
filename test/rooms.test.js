import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOMS } from '../src/data/rooms.js';
import { stepRoom, ROOM_WIDTH, ROOM_HEIGHT, PLAYER_RADIUS } from '../src/rules/room.js';
import { shapeHitsCircle } from '../src/rules/hazards.js';

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

test('출구에 설 수 있는 순간이 있다', () => {
    // 출구가 함정에 영영 덮여 있으면 깰 수 없는 방이다.
    for (const room of ROOMS) {
        const cx = room.exit.x + room.exit.w / 2;
        const cy = room.exit.y + room.exit.h / 2;

        const openMoment = [...everyFrame()].find(t => {
            const state = stepRoom(room, cx, cy, t);
            return state.cleared && !state.dead;
        });

        assert.notEqual(openMoment, undefined, `${room.name}: 출구가 늘 막혀 있다`);
    }
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

test('함정에 닿으면 죽는다', () => {
    // 특정 좌표를 적어두지 않는다. 방을 고칠 때마다 이 검사가 같이 깨져서
    // 진짜 고장과 방 수정을 구별할 수 없게 되기 때문이다.
    // 모든 방의 가만히 있는 함정을 한가운데에서 밟아본다.
    let checked = 0;

    for (const room of ROOMS) {
        for (const hazard of room.hazards) {
            if (hazard.kind !== 'rect') continue;
            const state = stepRoom(room, hazard.x + hazard.w / 2, hazard.y + hazard.h / 2, 0);
            assert.equal(state.dead, true,
                `${room.name}: ${hazard.art ?? '벽'} 한가운데를 밟았는데 안 죽는다`);
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

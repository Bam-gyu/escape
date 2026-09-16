import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOMS } from '../src/data/rooms.js';
import { stepRoom, ROOM_WIDTH, ROOM_HEIGHT, PLAYER_RADIUS } from '../src/rules/room.js';

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
    const room = ROOMS[0];
    const fence = room.hazards.find(h => h.kind === 'rect' && h.y === 250);

    const state = stepRoom(room, fence.x + fence.w / 2, fence.y + fence.h / 2, 0);
    assert.equal(state.dead, true);
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

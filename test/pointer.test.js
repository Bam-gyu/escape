import { test } from 'node:test';
import assert from 'node:assert/strict';

import { toRoomDelta, movedPointer } from '../src/view/pointer.js';
import { ROOM_WIDTH, ROOM_HEIGHT } from '../src/rules/room.js';

const ROOM = { width: ROOM_WIDTH, height: ROOM_HEIGHT };

test('화면이 방과 같은 크기면 움직인 만큼 그대로 간다', () => {
    const delta = toRoomDelta({ x: 10, y: -4 }, { width: 960, height: 720 }, ROOM);
    assert.deepEqual(delta, { x: 10, y: -4 });
});

test('창을 키워도 손맛이 안 바뀐다', () => {
    // 창이 두 배면 같은 손 움직임이 화면에서 두 배로 보인다.
    // 방 좌표로는 같아야 한다 — 안 그러면 창 크기가 난이도가 된다.
    const small = toRoomDelta({ x: 20, y: 20 }, { width: 960, height: 720 }, ROOM);
    const big = toRoomDelta({ x: 40, y: 40 }, { width: 1920, height: 1440 }, ROOM);
    assert.deepEqual(small, big);
});

test('화면 크기를 못 읽어도 안 터진다', () => {
    // 캔버스가 아직 안 그려졌을 때 0이 온다. 0으로 나누면 NaN이 되고,
    // 그 NaN이 주인공 자리에 들어가면 화면에서 영영 사라진다.
    assert.deepEqual(toRoomDelta({ x: 10, y: 10 }, { width: 0, height: 0 }, ROOM), { x: 0, y: 0 });
});

test('움직인 만큼 더해진다', () => {
    assert.deepEqual(movedPointer({ x: 100, y: 100 }, { x: 30, y: -40 }, ROOM), { x: 130, y: 60 });
});

test('방 밖으로는 안 나간다', () => {
    assert.deepEqual(movedPointer({ x: 950, y: 700 }, { x: 500, y: 500 }, ROOM), { x: 960, y: 720 });
    assert.deepEqual(movedPointer({ x: 10, y: 10 }, { x: -500, y: -500 }, ROOM), { x: 0, y: 0 });
});

test('벽에 밀어붙였다가 돌아올 때 바로 따라온다', () => {
    // 붙잡아 두지 않으면 셈만 계속 커져서, 민 만큼 되밀어야 움직이기 시작한다.
    // 벽에 붙을 때마다 조작이 먹통이 된 것처럼 느껴진다.
    let p = { x: 500, y: 300 };
    for (let i = 0; i < 50; i++) p = movedPointer(p, { x: 100, y: 0 }, ROOM);
    assert.equal(p.x, 960, '벽에 붙어야 한다');

    p = movedPointer(p, { x: -100, y: 0 }, ROOM);
    assert.equal(p.x, 860, '한 번 되밀면 바로 100만큼 돌아와야 한다');
});

test('한 번도 안 움직이면 자리가 그대로다', () => {
    assert.deepEqual(movedPointer({ x: 480, y: 650 }, { x: 0, y: 0 }, ROOM), { x: 480, y: 650 });
});

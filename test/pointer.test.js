import { test } from 'node:test';
import assert from 'node:assert/strict';

import { toRoomDelta, movedPointer, draggedPointer } from '../src/view/pointer.js';
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

// ── 터치는 트랙패드처럼 ───────────────────────────────────────

const PHONE = { width: 800, height: 600 };   // 가로로 든 폰

test('끈 만큼만 움직인다', async () => {
    const { draggedPointer } = await import('../src/view/pointer.js');
    const after = draggedPointer({ x: 480, y: 360 }, { x: 100, y: 100 }, { x: 150, y: 100 }, PHONE, ROOM);

    // 화면 50px은 방 좌표로 60이다 (960/800)
    assert.deepEqual(after, { x: 540, y: 360 });
});

test('화면 어디를 짚든 결과가 같다', () => {
    // 손가락이 주인공을 가리지 않게 하려는 것이다. 구석에서 끌어도 똑같이 간다.
    const a = draggedPointer({ x: 480, y: 360 }, { x: 10, y: 10 }, { x: 60, y: 10 }, PHONE, ROOM);
    const b = draggedPointer({ x: 480, y: 360 }, { x: 700, y: 500 }, { x: 750, y: 500 }, PHONE, ROOM);
    assert.deepEqual(a, b);
});

test('손을 뗐다 다른 데를 짚어도 주인공이 안 튄다', () => {
    // <b>이게 터치의 핵심이다.</b> 짚은 자리로 옮기면 함정을 뛰어넘는 꼼수가 되고,
    // 반대로 함정 위를 짚었다는 이유로 즉사하기도 한다.
    let hero = { x: 480, y: 360 };

    // 한 번 끌고
    hero = draggedPointer(hero, { x: 100, y: 100 }, { x: 140, y: 100 }, PHONE, ROOM);
    const afterFirst = { ...hero };

    // 손을 떼고 화면 반대쪽을 짚는다 — 짚는 것만으로는 아무 일도 없어야 한다
    // (touchstart는 from만 새로 잡고 자리는 안 건드린다)
    assert.deepEqual(hero, afterFirst);

    // 거기서 조금 끌면 그만큼만 간다
    hero = draggedPointer(hero, { x: 700, y: 500 }, { x: 710, y: 500 }, PHONE, ROOM);
    assert.equal(hero.x, afterFirst.x + 12);
    assert.equal(hero.y, afterFirst.y);
});

test('화면 끝까지 끌었다가 다시 짚어 이어 갈 수 있다', () => {
    // 트랙패드처럼 "들었다 놓기"로 계속 갈 수 있어야 한다.
    // 안 그러면 작은 화면에서는 방 끝까지 못 간다.
    let hero = { x: 100, y: 360 };
    for (let i = 0; i < 3; i++) {
        hero = draggedPointer(hero, { x: 100, y: 300 }, { x: 700, y: 300 }, PHONE, ROOM);
    }
    assert.equal(hero.x, 960, '세 번 끌어 오른쪽 끝까지 가야 한다');
});

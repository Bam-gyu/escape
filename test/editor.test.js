import { test } from 'node:test';
import assert from 'node:assert/strict';

import { pickAt, itemOf, moveBy, removeFrom, outlineOf } from '../src/editor/pick.js';
import { makeItem, changeKind, isProp, centerOf, KINDS } from '../src/editor/defaults.js';
import { WATCHERS, ART, ART_LABEL } from '../src/view/art.js';

const room = () => ({
    name: '검사용',
    spawn: { x: 480, y: 650 },
    exit: { x: 890, y: 535, w: 60, h: 105 },
    hazards: [
        { kind: 'rect', x: 100, y: 100, w: 200, h: 80 },
        { kind: 'cone', x: 400, y: 300, radius: 160, spread: 46, from: 55, to: 125, period: 3 },
        { kind: 'spinner', x: 600, y: 400, length: 260, thickness: 22, period: 4 },
    ],
    props: [{ name: 'plant', x: 120, y: 120, w: 85, h: 85 }],
});

test('상자 안을 누르면 그 함정이 집힌다', () => {
    assert.deepEqual(pickAt(room(), 150, 130), { what: 'hazard', index: 0 });
});

test('시야는 사람이 선 발밑에서 집힌다', () => {
    assert.deepEqual(pickAt(room(), 405, 305), { what: 'hazard', index: 1 });
    // 부채꼴 안쪽이어도 발밑에서 멀면 안 집힌다. 시야는 넓어서, 안쪽 아무데나
    // 집히면 그 아래 있는 것을 영영 못 고른다.
    assert.equal(pickAt(room(), 520, 330), null);
});

test('도는 막대는 축에서 집힌다', () => {
    assert.deepEqual(pickAt(room(), 604, 396), { what: 'hazard', index: 2 });
});

test('나중에 놓은 것이 먼저 집힌다', () => {
    const r = room();
    r.hazards.push({ kind: 'rect', x: 100, y: 100, w: 200, h: 80 });
    assert.deepEqual(pickAt(r, 150, 130), { what: 'hazard', index: 3 });
});

test('함정과 소품이 겹치면 함정이 먼저 집힌다', () => {
    // 소품은 판정이 없어서 게임에 영향이 없다. 겹쳤을 때 고칠 것은 함정 쪽이다.
    assert.deepEqual(pickAt(room(), 150, 130), { what: 'hazard', index: 0 });
});

test('시작 자리와 출구도 집힌다', () => {
    assert.deepEqual(pickAt(room(), 484, 654), { what: 'spawn', index: 0 });
    assert.deepEqual(pickAt(room(), 900, 560), { what: 'exit', index: 0 });
});

test('빈 바닥을 누르면 아무것도 안 집힌다', () => {
    assert.equal(pickAt(room(), 800, 690), null);
});

test('집은 것을 옮기면 방 데이터가 바로 바뀐다', () => {
    const r = room();
    moveBy(itemOf(r, pickAt(r, 150, 130)), 40, -10);
    assert.deepEqual([r.hazards[0].x, r.hazards[0].y], [140, 90]);
});

test('시작 자리와 출구는 못 지운다', () => {
    const r = room();
    assert.equal(removeFrom(r, { what: 'spawn', index: 0 }), false);
    assert.equal(removeFrom(r, { what: 'exit', index: 0 }), false);
    assert.ok(r.spawn && r.exit);
});

test('함정과 소품은 지워진다', () => {
    const r = room();
    assert.equal(removeFrom(r, { what: 'hazard', index: 1 }), true);
    assert.equal(r.hazards.length, 2);
    assert.equal(removeFrom(r, { what: 'prop', index: 0 }), true);
    assert.equal(r.props.length, 0);
});

test('가운데를 기준으로 삼는 것은 동그란 테두리가 나온다', () => {
    assert.equal(outlineOf(room(), { what: 'hazard', index: 1 }).round, true);
    assert.equal(outlineOf(room(), { what: 'hazard', index: 0 }).round, false);
});

test('감시자를 놓으면 시야가, 차단바를 놓으면 도는 막대가 된다', () => {
    assert.equal(makeItem('watch1', 400, 300).kind, 'cone');
    assert.equal(makeItem('gate', 400, 300).kind, 'spinner');
    assert.equal(makeItem('cart', 400, 300).kind, 'mover');
    assert.equal(makeItem('sensor', 400, 300).kind, 'blink');
    assert.equal(makeItem('crack', 400, 300).kind, 'rect');
});

test('사람과 축은 누른 자리가 곧 기준점이다', () => {
    // cone과 spinner의 x·y는 가운데다. 다른 것처럼 왼쪽 위로 밀면 딴 데 놓인다.
    assert.deepEqual([makeItem('watch1', 400, 300).x, makeItem('watch1', 400, 300).y], [400, 300]);
    assert.deepEqual([makeItem('gate', 400, 300).x, makeItem('gate', 400, 300).y], [400, 300]);
});

test('상자짜리는 누른 자리가 가운데에 오게 놓인다', () => {
    const item = makeItem('crack', 400, 300);
    assert.equal(item.x + item.w / 2, 400);
    assert.equal(item.y + item.h / 2, 300);
});

test('놓자마자 그 종류에 필요한 값이 다 있다', () => {
    for (const art of ['watch1', 'gate', 'cart', 'sensor', 'crack']) {
        const item = makeItem(art, 400, 300);
        for (const field of KINDS[item.kind].fields) {
            assert.equal(typeof item[field], 'number', `${art}의 ${field}가 없다`);
        }
    }
});

test('종류를 바꿔도 자리는 그대로다', () => {
    const before = makeItem('crack', 400, 300);
    const after = changeKind(before, 'blink');
    assert.deepEqual([after.x, after.y], [before.x, before.y]);
    assert.equal(after.kind, 'blink');
    assert.equal(typeof after.period, 'number');
});

test('종류를 바꿔도 같은 이름의 값은 지켜진다', () => {
    const before = { ...makeItem('crack', 400, 300), w: 33, h: 44 };
    assert.deepEqual([changeKind(before, 'mover').w, changeKind(before, 'mover').h], [33, 44]);
});

test('안 보이는 표시는 종류를 바꿔도 남는다', () => {
    const before = { ...makeItem('crack', 400, 300), hidden: true };
    assert.equal(changeKind(before, 'blink').hidden, true);
});

test('소품과 함정을 가른다', () => {
    assert.equal(isProp('sofa'), true);
    assert.equal(isProp('watch1'), false);
    assert.equal(makeItem('sofa', 400, 300).kind, undefined);
    assert.equal(makeItem('sofa', 400, 300).name, 'sofa');
});

// ── 보이는 자리에서 집힌다 ─────────────────────────────────────
// 함정이 든 x·y가 아니라 "지금 이 순간의 모양"으로 집어야 한다.
// 이게 어긋나면 화면에서 카트가 보이는 곳을 눌러도 안 집히고,
// 아무것도 없어 보이는 허공에서 집힌다.

const movingRoom = () => ({
    name: '움직이는 방',
    spawn: { x: 480, y: 650 },
    exit: { x: 890, y: 535, w: 60, h: 105 },
    hazards: [{ kind: 'mover', x: 100, y: 500, w: 140, h: 34, dx: 300, period: 4 }],
    props: [],
});

test('오가는 것은 지금 있는 자리에서 집힌다', () => {
    // period 4짜리 왕복의 절반이면 dx를 다 간 자리, 곧 x=400이다.
    const r = movingRoom();
    assert.deepEqual(pickAt(r, 410, 510, 2), { what: 'hazard', index: 0 });
    assert.equal(pickAt(r, 110, 510, 2), null);

    // 시각 0에서는 원래 자리에 있다.
    assert.deepEqual(pickAt(r, 110, 510, 0), { what: 'hazard', index: 0 });
});

test('테두리도 지금 있는 자리에 나온다', () => {
    const r = movingRoom();
    assert.equal(outlineOf(r, { what: 'hazard', index: 0 }, 2).x, 400);
    assert.equal(outlineOf(r, { what: 'hazard', index: 0 }, 0).x, 100);
});

test('끌어서 옮기면 왕복의 기준점이 따라온다', () => {
    const r = movingRoom();
    moveBy(itemOf(r, pickAt(r, 410, 510, 2)), 50, 0);
    assert.equal(r.hazards[0].x, 150);
    assert.deepEqual(pickAt(r, 460, 510, 2), { what: 'hazard', index: 0 });
});

test('어떤 그림을 놓아도 누른 자리가 가운데다', () => {
    for (const art of ['cart', 'sensor', 'crack', 'tteokbokki', 'wall']) {
        const item = makeItem(art, 400, 300);
        if (item.w === undefined) continue;
        assert.equal(item.x + item.w / 2, 400, `${art}의 가로 가운데가 어긋난다`);
        assert.equal(item.y + item.h / 2, 300, `${art}의 세로 가운데가 어긋난다`);
    }
});

test('종류를 바꿔도 화면에서 보이는 가운데가 그대로다', () => {
    // 상자의 x·y는 왼쪽 위, 부채꼴의 x·y는 가운데다. 숫자만 베끼면
    // 종류를 바꾼 순간 함정이 제 크기의 절반만큼 뛴다.
    const box = makeItem('crack', 400, 300);
    assert.deepEqual(centerOf(changeKind(box, 'cone')), { x: 400, y: 300 });
    assert.deepEqual(centerOf(changeKind(box, 'spinner')), { x: 400, y: 300 });

    const cone = makeItem('watch1', 400, 300);
    assert.deepEqual(centerOf(changeKind(cone, 'rect')), { x: 400, y: 300 });
    assert.deepEqual(centerOf(changeKind(cone, 'mover')), { x: 400, y: 300 });
});

test('종류를 오가며 바꿔도 자리가 흘러가지 않는다', () => {
    let item = makeItem('crack', 400, 300);
    for (const kind of ['cone', 'rect', 'spinner', 'blink', 'mover', 'rect']) {
        item = changeKind(item, kind);
    }
    assert.deepEqual(centerOf(item), { x: 400, y: 300 });
});


// ── 감시하는 사람 ─────────────────────────────────────────────
// 넷을 두는 것은 방마다 다른 얼굴이 나오게 하려는 것이다.
// 하나라도 빠지면 그 사람을 놓았을 때 시야가 아니라 벽이 나온다.

test('감시자는 모두 놓으면 시야가 된다', () => {
    for (const name of WATCHERS) {
        assert.equal(makeItem(name, 400, 300).kind, 'cone', `${name}이 시야가 아니다`);
    }
});

test('감시자는 모두 그림 목록과 이름을 갖고 있다', () => {
    for (const name of WATCHERS) {
        assert.ok(ART[name], `${name}이 art.js에 없다`);
        assert.equal(ART[name].anchor, 'feet', `${name}의 기준점이 발밑이 아니다`);
        assert.ok(ART_LABEL[name], `${name}의 한글 이름이 없다`);
    }
});

test('감시자는 편집기 서랍에 다 들어 있다', async () => {
    const { DRAWERS } = await import('../src/editor/defaults.js');
    const inDrawers = DRAWERS.flatMap(d => d.arts);
    for (const name of WATCHERS) {
        assert.ok(inDrawers.includes(name), `${name}이 서랍에 없다 — 끌어다 놓을 수가 없다`);
    }
});

test('감시자는 그림이 없어도 서로 다른 색으로 나온다', async () => {
    const { COLOR } = await import('../src/view/palette.js');
    const bodies = WATCHERS.map(name => COLOR[name]);
    for (const name of WATCHERS) {
        assert.ok(COLOR[name], `${name}의 색이 없다`);
        assert.ok(COLOR[`${name}Cap`], `${name}의 모자 색이 없다`);
    }
    assert.equal(new Set(bodies).size, WATCHERS.length, '두 감시자가 같은 색이다');
});

test('방이 쓰는 사람은 모두 그릴 줄 아는 사람이다', async () => {
    // 없는 이름을 적어두면 화면에 엉뚱한 사람이 서 있게 된다. 조용해서 더 나쁘다.
    const { ROOMS } = await import('../src/data/rooms.js');
    for (const room of ROOMS) {
        for (const hazard of room.hazards) {
            if (hazard.kind !== 'cone') continue;
            assert.ok(WATCHERS.includes(hazard.art),
                `${room.name}의 시야가 모르는 사람(${hazard.art})을 쓴다`);
        }
    }
});

// ── 가로지르기는 얹는 것이다 ──────────────────────────────────

test('종류를 바꿔도 가로지르기가 남는다', () => {
    // 종류가 아니라 얹는 것이다. 종류를 바꿨다고 지워지면 다시 다 적어야 한다.
    const car = { ...makeItem('car', 400, 300), travel: { dx: 1200, duration: 5, gap: 2, loop: true } };

    for (const kind of ['blink', 'mover', 'spinner', 'cone', 'rect']) {
        const after = changeKind(car, kind);
        assert.deepEqual(after.travel, car.travel, `${kind}으로 바꾸니 가로지르기가 사라졌다`);
    }
});

test('종류를 바꾸면 가로지르기 덩이도 새로 뜬다', () => {
    // 같은 덩이를 나눠 쓰면 새 함정을 고칠 때 옛 함정까지 같이 바뀐다.
    const car = { ...makeItem('car', 400, 300), travel: { dx: 1200, duration: 5, gap: 2, loop: true } };
    const after = changeKind(car, 'blink');

    after.travel.dx = 99;
    assert.equal(car.travel.dx, 1200, '옛 함정의 값까지 바뀌었다');
});

test('가로지르기가 없으면 안 생긴다', () => {
    assert.equal(changeKind(makeItem('crack', 400, 300), 'blink').travel, undefined);
});

test('사라져 있는 동안은 안 집힌다', async () => {
    // 안 보이고 안 죽이는데 집히면, 원래 자리에서 그 밑의 것을 가린다.
    const r = {
        name: '길',
        spawn: { x: 480, y: 650 },
        exit: { x: 890, y: 535, w: 60, h: 105 },
        hazards: [{
            kind: 'rect', x: 100, y: 400, w: 150, h: 80,
            travel: { dx: 1200, dy: 0, duration: 5, gap: 2, loop: true },
        }],
        props: [],
    };

    // 0초에는 처음 자리에 있다
    assert.deepEqual(pickAt(r, 150, 440, 0), { what: 'hazard', index: 0 });
    // 5.5초에는 사라져 있다 — 그 자리를 눌러도 안 집힌다
    assert.equal(pickAt(r, 150, 440, 5.5), null);
    // 테두리도 안 나온다
    assert.equal(outlineOf(r, { what: 'hazard', index: 0 }, 5.5), null);
});

test('사라진 함정 밑의 소품이 집힌다', () => {
    const r = {
        name: '길',
        spawn: { x: 480, y: 650 },
        exit: { x: 890, y: 535, w: 60, h: 105 },
        hazards: [{
            kind: 'rect', x: 100, y: 400, w: 150, h: 80,
            travel: { dx: 1200, dy: 0, duration: 5, gap: 2, loop: true },
        }],
        props: [{ name: 'trash', x: 120, y: 420, w: 60, h: 60 }],
    };

    assert.deepEqual(pickAt(r, 150, 440, 0), { what: 'hazard', index: 0 });
    assert.deepEqual(pickAt(r, 150, 440, 5.5), { what: 'prop', index: 0 });
});

test('소품 그림도 함정으로 놓을 수 있다', () => {
    // 같은 소파라도 어느 서랍에서 끌었는지로 갈린다.
    const asProp = makeItem('sofa', 400, 300, 'prop');
    const asHazard = makeItem('sofa', 400, 300, 'hazard');

    assert.equal(asProp.name, 'sofa');
    assert.equal(asProp.kind, undefined);
    assert.equal(asHazard.kind, 'rect');
    assert.equal(asHazard.art, 'sofa');
});

test('두 서랍이 같은 그림을 갖되 하는 일이 다르다', async () => {
    const { DRAWERS } = await import('../src/editor/defaults.js');
    const hazardDrawer = DRAWERS.find(d => d.as === 'hazard' && d.arts.includes('sofa'));
    const propDrawer = DRAWERS.find(d => d.as === 'prop');

    assert.ok(hazardDrawer, '소품 그림이 함정 서랍에 없다');
    assert.ok(propDrawer.arts.includes('sofa'), '소품 서랍에서 빠졌다');
    for (const d of DRAWERS) assert.ok(d.as, `'${d.title}' 서랍에 as가 없다`);
});

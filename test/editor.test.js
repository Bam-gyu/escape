import { test } from 'node:test';
import assert from 'node:assert/strict';

import { pickAt, itemOf, moveBy, removeFrom, outlineOf } from '../src/editor/pick.js';
import { makeItem, changeKind, isProp, KINDS } from '../src/editor/defaults.js';

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

test('경비를 놓으면 시야가, 차단바를 놓으면 도는 막대가 된다', () => {
    assert.equal(makeItem('guard', 400, 300).kind, 'cone');
    assert.equal(makeItem('gate', 400, 300).kind, 'spinner');
    assert.equal(makeItem('cart', 400, 300).kind, 'mover');
    assert.equal(makeItem('sensor', 400, 300).kind, 'blink');
    assert.equal(makeItem('crack', 400, 300).kind, 'rect');
});

test('사람과 축은 누른 자리가 곧 기준점이다', () => {
    // cone과 spinner의 x·y는 가운데다. 다른 것처럼 왼쪽 위로 밀면 딴 데 놓인다.
    assert.deepEqual([makeItem('guard', 400, 300).x, makeItem('guard', 400, 300).y], [400, 300]);
    assert.deepEqual([makeItem('gate', 400, 300).x, makeItem('gate', 400, 300).y], [400, 300]);
});

test('상자짜리는 누른 자리가 가운데에 오게 놓인다', () => {
    const item = makeItem('crack', 400, 300);
    assert.equal(item.x + item.w / 2, 400);
    assert.equal(item.y + item.h / 2, 300);
});

test('놓자마자 그 종류에 필요한 값이 다 있다', () => {
    for (const art of ['guard', 'gate', 'cart', 'sensor', 'crack']) {
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
    assert.equal(isProp('guard'), false);
    assert.equal(makeItem('sofa', 400, 300).kind, undefined);
    assert.equal(makeItem('sofa', 400, 300).name, 'sofa');
});

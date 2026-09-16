import { test } from 'node:test';
import assert from 'node:assert/strict';
import { circleHitsRect, circleHitsSector, angleDelta, clamp } from '../src/rules/geometry.js';

const RECT = { x: 100, y: 100, w: 200, h: 50 };

test('사각형 안에 있으면 맞는다', () => {
    assert.equal(circleHitsRect(200, 120, 7, RECT), true);
});

test('사각형에서 멀면 안 맞는다', () => {
    assert.equal(circleHitsRect(200, 300, 7, RECT), false);
});

test('모서리에 스치는 것도 맞는 것이다', () => {
    // 반지름 7인 원이 위쪽 변에서 6만큼 떨어져 있다 — 6 < 7이라 닿았다.
    assert.equal(circleHitsRect(200, 94, 7, RECT), true);
    assert.equal(circleHitsRect(200, 92, 7, RECT), false);
});

test('대각선 모서리는 변보다 멀다', () => {
    // 꼭짓점 (100,100)에서 x로 5, y로 5 떨어진 자리. 거리는 7.07이라 반지름 7로는 못 닿는다.
    // 사각형을 그냥 상하좌우로만 검사하면 여기서 틀린 답이 나온다.
    assert.equal(circleHitsRect(95, 95, 7, RECT), false);
    assert.equal(circleHitsRect(95, 95, 7.2, RECT), true);
});

test('각도 차는 0도를 넘어갈 때도 짧은 쪽으로 잰다', () => {
    assert.equal(angleDelta(350, 10), 20);
    assert.equal(angleDelta(10, 350), -20);
    assert.equal(angleDelta(0, 180), 180);
});

const SECTOR = { x: 500, y: 100, radius: 200, spread: 60, angle: 90 };

test('부채꼴이 보는 쪽에 있으면 맞는다', () => {
    // 각도 90은 아래쪽이다(화면 좌표는 y가 아래로 커진다).
    assert.equal(circleHitsSector(500, 250, 7, SECTOR), true);
});

test('부채꼴 옆쪽은 안 맞는다', () => {
    assert.equal(circleHitsSector(700, 100, 7, SECTOR), false);
});

test('보는 쪽이어도 너무 멀면 안 맞는다', () => {
    assert.equal(circleHitsSector(500, 320, 7, SECTOR), false);
});

test('부채꼴 꼭짓점을 덮고 있으면 각도와 상관없이 맞는다', () => {
    // 간수 등 뒤에 바짝 붙은 경우. 각도로만 따지면 안 맞는 것으로 나와
    // 간수를 통과해 지나갈 수 있게 된다.
    assert.equal(circleHitsSector(498, 98, 7, SECTOR), true);
});

test('원의 가장자리가 걸치면 중심이 밖이어도 맞는다', () => {
    // 부채꼴 경계선 바로 바깥. 원을 점으로 다루면 여기서 놓친다.
    const onEdge = { x: 0, y: 0, radius: 300, spread: 60, angle: 0 };
    assert.equal(circleHitsSector(100, 59, 7, onEdge), true, '경계 안쪽은 당연히 맞는다');
    assert.equal(circleHitsSector(100, 64, 7, onEdge), true, '가장자리가 걸친다');
    assert.equal(circleHitsSector(100, 80, 7, onEdge), false, '완전히 벗어났다');
});

test('clamp는 범위 밖을 끌어당긴다', () => {
    assert.equal(clamp(5, 10, 20), 10);
    assert.equal(clamp(25, 10, 20), 20);
    assert.equal(clamp(15, 10, 20), 15);
});

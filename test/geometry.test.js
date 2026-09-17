import { test } from 'node:test';
import assert from 'node:assert/strict';
import { circleHitsRect, circleHitsSector, circleHitsOrientedRect, angleDelta, clamp } from '../src/rules/geometry.js';

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

test('각도가 0이면 기울어진 사각형은 그냥 사각형이다', () => {
    // x·y가 중심인 것만 다르다. 같은 자리를 가리키면 같은 답이 나와야 한다.
    const box = { x: 100, y: 100, w: 60, h: 20, angle: 0 };
    const plain = { x: 70, y: 90, w: 60, h: 20 };

    for (const [px, py] of [[100, 100], [69, 100], [100, 79], [200, 200], [131, 100]]) {
        assert.equal(
            circleHitsOrientedRect(px, py, 7, box),
            circleHitsRect(px, py, 7, plain),
            `(${px}, ${py})에서 답이 다르다`,
        );
    }
});

test('돌린 막대는 돌아간 쪽만 맞춘다', () => {
    // 가로로 누운 길이 200짜리 막대를 90도 돌리면 세로로 선다.
    const lying = { x: 0, y: 0, w: 200, h: 20, angle: 0 };
    const standing = { x: 0, y: 0, w: 200, h: 20, angle: 90 };

    assert.equal(circleHitsOrientedRect(80, 0, 5, lying), true);
    assert.equal(circleHitsOrientedRect(80, 0, 5, standing), false);

    assert.equal(circleHitsOrientedRect(0, 80, 5, standing), true);
    assert.equal(circleHitsOrientedRect(0, 80, 5, lying), false);
});

test('막대 끝 너머는 안 닿는다', () => {
    const bar = { x: 0, y: 0, w: 200, h: 20, angle: 0 };

    assert.equal(circleHitsOrientedRect(104, 0, 5, bar), true, '끝에서 4 떨어진 곳은 반지름 5에 닿는다');
    assert.equal(circleHitsOrientedRect(112, 0, 5, bar), false, '끝에서 12 떨어진 곳은 안 닿는다');
});

test('45도로 돌린 막대의 모서리', () => {
    const bar = { x: 0, y: 0, w: 200, h: 20, angle: 45 };
    const far = 100 / Math.SQRT2;

    // 막대를 따라간 자리는 닿고, 그 자리에서 직각으로 벗어나면 안 닿는다.
    assert.equal(circleHitsOrientedRect(far, far, 4, bar), true);
    assert.equal(circleHitsOrientedRect(far - 30, far + 30, 4, bar), false);
});

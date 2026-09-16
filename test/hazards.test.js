import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pingPong, shapeAt, shapeHitsCircle } from '../src/rules/hazards.js';

test('왕복은 0에서 시작해 절반에 1이 되고 끝에 0으로 돌아온다', () => {
    assert.equal(pingPong(0, 4), 0);
    assert.equal(pingPong(2, 4), 1);
    assert.equal(pingPong(4, 4), 0);
    assert.equal(pingPong(1, 4), 0.5);
    assert.equal(pingPong(3, 4), 0.5);
});

test('왕복은 몇 바퀴를 돌아도 같은 자리에 온다', () => {
    assert.equal(pingPong(402, 4), pingPong(2, 4));
});

test('전기는 켜진 동안만 죽인다', () => {
    const spark = { kind: 'blink', x: 0, y: 0, w: 10, h: 10, period: 2, on: 0.5 };

    assert.equal(shapeAt(spark, 0).lethal, true);
    assert.equal(shapeAt(spark, 0.4).lethal, true);
    assert.equal(shapeAt(spark, 0.6).lethal, false);
    assert.equal(shapeAt(spark, 1.9).lethal, false);
    assert.equal(shapeAt(spark, 2.1).lethal, true, '다음 바퀴에 다시 켜져야 한다');
});

test('꺼진 전기는 겹쳐도 안 죽는다', () => {
    const spark = { kind: 'blink', x: 0, y: 0, w: 10, h: 10, period: 2, on: 0.5 };

    assert.equal(shapeHitsCircle(shapeAt(spark, 0), 5, 5, 7), true);
    assert.equal(shapeHitsCircle(shapeAt(spark, 1), 5, 5, 7), false);
});

test('오가는 장애물은 양 끝을 정확히 찍는다', () => {
    const bar = { kind: 'mover', x: 100, y: 0, w: 50, h: 20, dx: 200, period: 4 };

    assert.equal(shapeAt(bar, 0).x, 100);
    assert.equal(shapeAt(bar, 2).x, 300);
    assert.equal(shapeAt(bar, 4).x, 100);
});

test('offset은 박자를 밀어놓는다', () => {
    const a = { kind: 'mover', x: 0, y: 0, w: 10, h: 10, dx: 100, period: 4 };
    const b = { ...a, offset: 2 };

    assert.equal(shapeAt(b, 0).x, shapeAt(a, 2).x);
});

test('시야는 from에서 시작해 to까지 갔다가 돌아온다', () => {
    const eye = { kind: 'cone', x: 0, y: 0, radius: 100, spread: 40, from: 90, to: 170, period: 4 };

    assert.equal(shapeAt(eye, 0).angle, 90);
    assert.equal(shapeAt(eye, 2).angle, 170);
    assert.equal(shapeAt(eye, 4).angle, 90);
    assert.equal(shapeAt(eye, 1).angle, 130);
});

test('모르는 함정은 조용히 넘어가지 않고 터진다', () => {
    // 데이터에 오타를 냈을 때 화면에 아무것도 안 나오고 끝나면
    // 방이 왜 쉬운지 알 수가 없다.
    assert.throws(() => shapeAt({ kind: 'rext', x: 0, y: 0, w: 1, h: 1 }, 0), /모르는 함정/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pingPong, spin, shapeAt, shapeHitsCircle } from '../src/rules/hazards.js';

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

test('회전은 왕복하지 않고 한 주기에 한 바퀴를 돈다', () => {
    assert.equal(spin(0, 4), 0);
    assert.equal(spin(1, 4), 90);
    assert.equal(spin(2, 4), 180);
    assert.equal(spin(4, 4), 360);

    // 주기가 음수면 반대로 돈다.
    assert.equal(spin(1, -4), -90);
});

test('차단바는 한 주기 뒤에 같은 자리로 돌아온다', () => {
    const gate = { kind: 'spinner', x: 100, y: 100, length: 200, thickness: 20, period: 3 };

    const now = shapeAt(gate, 0.7);
    const lap = shapeAt(gate, 3.7);

    assert.equal(now.kind, 'obb');
    assert.ok(Math.abs((lap.angle - now.angle) % 360) < 1e-9, '한 바퀴 뒤 각도가 다르다');
});

test('차단바는 돌면서 닿는 자리가 바뀐다', () => {
    // 4초에 한 바퀴. 0초에 가로, 1초에 세로다.
    const gate = { kind: 'spinner', x: 0, y: 0, length: 200, thickness: 20, period: 4 };

    assert.equal(shapeHitsCircle(shapeAt(gate, 0), 80, 0, 5), true);
    assert.equal(shapeHitsCircle(shapeAt(gate, 0), 0, 80, 5), false);

    assert.equal(shapeHitsCircle(shapeAt(gate, 1), 0, 80, 5), true);
    assert.equal(shapeHitsCircle(shapeAt(gate, 1), 80, 0, 5), false);
});

test('안 움직이는 간수는 예전과 똑같다', () => {
    // dx·dy를 안 준 cone은 값이 하나도 안 달라져야 한다.
    // 이게 깨지면 설정만 바꾼 줄 알았는데 기존 방 셋의 난이도가 바뀐 것이다.
    const still = { kind: 'cone', x: 560, y: 150, radius: 235, spread: 44, from: 95, to: 175, period: 3.4 };

    for (const t of [0, 0.5, 1.7, 3.4, 9.1]) {
        const shape = shapeAt(still, t);
        assert.equal(shape.x, 560);
        assert.equal(shape.y, 150);
        assert.equal(shape.angle, 95 + 80 * pingPong(t, 3.4));
    }
});

test('순찰하는 간수는 시야를 든 채 움직인다', () => {
    const patrol = { kind: 'cone', x: 100, y: 200, radius: 150, spread: 40, from: 0, to: 90, period: 2, dx: 400, walkPeriod: 8 };

    assert.equal(shapeAt(patrol, 0).x, 100, '시작에는 제자리다');
    assert.equal(shapeAt(patrol, 4).x, 500, '걷는 주기의 절반에 끝까지 간다');
    assert.equal(shapeAt(patrol, 8).x, 100, '한 주기면 돌아온다');
    assert.equal(shapeAt(patrol, 4).y, 200, 'dy가 없으면 위아래로는 안 움직인다');
});

test('걷는 주기와 보는 주기는 따로 논다', () => {
    // 같이 움직이면 "오른쪽으로 갈 때는 늘 오른쪽을 본다"가 되어
    // 안전한 쪽이 고정되고 방이 한 번 보면 끝나는 것이 된다.
    const patrol = { kind: 'cone', x: 0, y: 0, radius: 100, spread: 40, from: 0, to: 180, period: 2, dx: 100, walkPeriod: 3 };

    // 보는 주기 2초와 걷는 주기 3초가 어긋나 있어서, 같은 자리에 와도
    // 보는 곳이 다르다. 주기를 하나로 묶으면 이 둘이 언제나 같이 움직인다.
    const a = shapeAt(patrol, 1);
    const b = shapeAt(patrol, 4);

    assert.equal(a.x, b.x, '걷는 주기 3초라 1초와 4초는 같은 자리다');
    assert.notEqual(a.angle, b.angle, '같은 자리인데 보는 곳까지 같으면 안 된다');
});

test('센서도 offset만큼 박자가 밀린다', () => {
    // offset은 함정끼리 박자를 어긋나게 하려고 있는 값이다.
    // blink만 이걸 무시하면 방 데이터에 적어둔 offset이 조용히 아무 일도 안 한다 —
    // 화면은 돌아가는데 의도한 박자가 아니라서 알아채기가 어렵다.
    const sensor = { kind: 'blink', x: 0, y: 0, w: 10, h: 10, period: 2, on: 1 };
    const shifted = { ...sensor, offset: 1 };

    assert.equal(shapeAt(sensor, 0).lethal, true);
    assert.equal(shapeAt(shifted, 0).lethal, false, 'offset 1이면 켜지는 때가 뒤집힌다');

    assert.equal(shapeAt(sensor, 1.5).lethal, false);
    assert.equal(shapeAt(shifted, 1.5).lethal, true);
});

// ── 가로질러 지나가는 것 ──────────────────────────────────────
// 도로를 지나가는 차다. 왕복하지 않는다 — 끝까지 가서 화면 밖으로 사라지고,
// 잠시 뒤 처음 자리에서 다시 나온다.

const car = (extra = {}) => ({
    kind: 'rect', x: -150, y: 400, w: 150, h: 80,
    travel: { dx: 1260, dy: 0, duration: 5, gap: 2, loop: true, ...extra },
});

test('가로지르는 것은 처음 자리에서 출발한다', () => {
    const shape = shapeAt(car(), 0);
    assert.equal(shape.x, -150);
    assert.equal(shape.gone, false);
});

test('시간이 흐른 만큼 한 방향으로 간다 — 왕복하지 않는다', () => {
    // 왕복이면 절반에서 제일 멀고 끝에서 돌아온다. 이건 끝이 제일 멀다.
    assert.equal(shapeAt(car(), 2.5).x, -150 + 1260 / 2);
    assert.ok(shapeAt(car(), 4.9).x > shapeAt(car(), 2.5).x, '끝으로 갈수록 멀어야 한다');
});

test('다 가면 사라지고, 사라진 동안은 안 죽인다', () => {
    const gone = shapeAt(car(), 5.5);
    assert.equal(gone.gone, true);
    assert.equal(gone.lethal, false);
    assert.equal(shapeHitsCircle(gone, gone.x + 10, gone.y + 10, 7), false);
});

test('텀이 지나면 처음 자리에서 다시 나온다', () => {
    // duration 5 + gap 2 = 7초마다 한 바퀴.
    const again = shapeAt(car(), 7);
    assert.equal(again.x, -150);
    assert.equal(again.gone, false);

    assert.equal(shapeAt(car(), 7 + 2.5).x, shapeAt(car(), 2.5).x);
});

test('반복을 끄면 한 번 가고 다시 안 나온다', () => {
    const once = car({ loop: false });
    assert.equal(shapeAt(once, 2.5).gone, false);
    assert.equal(shapeAt(once, 5.5).gone, true);
    assert.equal(shapeAt(once, 100).gone, true, '반복이 꺼졌으면 영영 없어야 한다');
});

test('offset은 가로지르기의 박자도 민다', () => {
    // 차 여러 대를 어긋나게 놓을 때 쓴다.
    assert.equal(shapeAt(car({ offset: 2.5 }), 0).x, shapeAt(car(), 2.5).x);
});

test('가로지르기는 종류를 안 가린다', () => {
    // 종류가 아니라 얹는 것이라서 감시자에도, 도는 막대에도 그대로 붙는다.
    const watcher = {
        kind: 'cone', x: 100, y: 300, radius: 160, spread: 46, from: 55, to: 125, period: 3,
        travel: { dx: 600, dy: 0, duration: 4, gap: 1, loop: true },
    };
    assert.equal(shapeAt(watcher, 2).x, 100 + 300);
    assert.equal(shapeAt(watcher, 4.5).gone, true);

    const bar = {
        kind: 'spinner', x: 100, y: 300, length: 200, thickness: 20, period: 4,
        travel: { dx: 0, dy: 400, duration: 4, gap: 1, loop: true },
    };
    assert.equal(shapeAt(bar, 2).y, 300 + 200);
    assert.equal(shapeAt(bar, 4.5).gone, true);
});

test('가로지르지 않는 함정은 예전과 똑같다', () => {
    const plain = { kind: 'rect', x: 10, y: 20, w: 30, h: 40 };
    const shape = shapeAt(plain, 3.7);
    assert.deepEqual([shape.x, shape.y], [10, 20]);
    assert.equal(shape.gone, undefined);
    assert.equal(shape.lethal, true);
});

test('한 바퀴가 0이어도 안 터진다', () => {
    // 편집기에서 숫자를 0으로 두는 순간이 있다. 거기서 터지면 방이 안 보인다.
    const broken = { kind: 'rect', x: 5, y: 5, w: 10, h: 10, travel: { dx: 100, duration: 0, gap: 0, loop: true } };
    assert.equal(shapeAt(broken, 3).gone, false);
});

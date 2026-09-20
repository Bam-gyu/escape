import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { ROOMS } from '../src/data/rooms.js';
import { serializeRooms, splitHeader } from '../src/editor/serialize.js';

const SOURCE = new URL('../src/data/rooms.js', import.meta.url);

/// 쓴 것을 다시 읽으면 같은 값이 나오는가.
///
/// 편집기가 파일을 덮어쓰는 이상 <b>이 검사가 안전장치다.</b> 이게 없으면
/// 저장 한 번에 방이 조용히 뭉개져도 아무도 모른다.
async function roundTrip(rooms) {
    const header = splitHeader(readFileSync(SOURCE, 'utf8'));
    const path = join(mkdtempSync(join(tmpdir(), 'rooms-')), 'rooms.js');
    writeFileSync(path, serializeRooms(rooms, header));
    return (await import(pathToFileURL(path).href)).ROOMS;
}

test('쓴 것을 다시 읽으면 같은 방이 나온다', async () => {
    assert.deepEqual(await roundTrip(ROOMS), ROOMS);
});

test('저장해도 파일 맨 위의 설명이 살아남는다', () => {
    const source = readFileSync(SOURCE, 'utf8');
    const written = serializeRooms(ROOMS, splitHeader(source));
    assert.ok(written.includes('── 여정 ──'));
    assert.ok(written.includes('hidden: true'));
});

test('아무것도 안 고치고 저장하면 파일이 그대로다', () => {
    // 저장만 했는데 git diff가 파일 전체로 번지면 무엇을 바꿨는지 알 수 없게 된다.
    const source = readFileSync(SOURCE, 'utf8');
    assert.equal(serializeRooms(ROOMS, splitHeader(source)), source);
});

test('값을 적는 순서가 함정마다 같다', async () => {
    const moved = await roundTrip([{
        ...ROOMS[0],
        hazards: [{ art: 'cart', dx: 300, period: 4.4, h: 34, w: 140, y: 560, x: 250, kind: 'mover' }],
    }]);

    assert.deepEqual(Object.keys(moved[0].hazards[0]),
        ['kind', 'x', 'y', 'w', 'h', 'period', 'dx', 'art']);
});

test('모르는 이름은 안 써진다', async () => {
    // 편집기가 화면 사정으로 붙인 임시 값(선택했는가 따위)이 파일로 새어나가면 안 된다.
    const rooms = await roundTrip([{
        ...ROOMS[0],
        hazards: [{ kind: 'rect', x: 1, y: 2, w: 3, h: 4, selected: true, _drag: 9 }],
    }]);

    assert.deepEqual(rooms[0].hazards[0], { kind: 'rect', x: 1, y: 2, w: 3, h: 4 });
});

test('작은 따옴표가 든 이름도 깨지지 않는다', async () => {
    const rooms = await roundTrip([{ ...ROOMS[0], name: "매니저's 방" }]);
    assert.equal(rooms[0].name, "매니저's 방");
});

test('뒤집기와 가로지르기가 저장되고 다시 읽힌다', async () => {
    const rooms = await roundTrip([{
        ...ROOMS[0],
        exit: { ...ROOMS[0].exit, inBackground: true },
        hazards: [{
            kind: 'rect', x: -170, y: 396, w: 150, h: 80, art: 'car', flip: true,
            travel: { dx: -1300, dy: 0, duration: 4.6, gap: 2.4, loop: true },
        }],
        props: [{ name: 'car', x: 10, y: 20, w: 30, h: 40, flip: true }],
    }]);

    const car = rooms[0].hazards[0];
    assert.equal(car.flip, true);
    assert.deepEqual(car.travel, { dx: -1300, dy: 0, duration: 4.6, gap: 2.4, loop: true });
    assert.equal(rooms[0].props[0].flip, true);
    assert.equal(rooms[0].exit.inBackground, true);
});

test('반복을 끈 것도 그대로 저장된다', async () => {
    // loop: false는 "적어둘 값이 없다"와 다르다. 빠지면 반복하는 것이 되어버린다.
    const rooms = await roundTrip([{
        ...ROOMS[0],
        hazards: [{ kind: 'rect', x: 0, y: 0, w: 10, h: 10, travel: { dx: 100, duration: 2, gap: 1, loop: false } }],
    }]);
    assert.equal(rooms[0].hazards[0].travel.loop, false);
});

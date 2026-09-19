import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import { ART, WATCHERS } from '../src/view/art.js';
import { opaqueBox } from './png.js';

const at = name => new URL(`../${name}`, import.meta.url);

/// png 앞머리(IHDR)에서 크기만 읽는다. 그림 라이브러리를 들이지 않으려는 것이다 —
/// 이 프로젝트는 의존성이 없고, 크기 두 개 읽자고 그걸 깨뜨릴 이유가 없다.
function sizeOf(path) {
    const buffer = readFileSync(path);
    assert.equal(buffer.toString('ascii', 1, 4), 'PNG', `${path}가 png가 아니다`);
    return { w: buffer.readUInt32BE(16), h: buffer.readUInt32BE(20) };
}

test('감시자 그림이 네 장 다 있다', () => {
    for (const name of WATCHERS) {
        assert.ok(existsSync(at(ART[name].src)), `${ART[name].src}가 없다`);
    }
});

const FOOD = ['tteokbokki', 'chicken', 'ramen', 'icecream'];

test('사람 그림은 표시 크기와 비율이 같다', () => {
    for (const name of ['idol', ...WATCHERS]) {
        const spec = ART[name];
        const file = sizeOf(at(spec.src));
        assert.equal(file.w / file.h, spec.w / spec.h,
            `${name}: 파일은 ${file.w}×${file.h}인데 표시는 ${spec.w}×${spec.h}다`);
    }
});

test('음식은 방에 놓인 상자와 그림 비율이 같다', async () => {
    // <b>화면 크기를 정하는 것은 ART가 아니라 rooms.js다.</b> 그림은 함정 상자에
    // 늘여 붙여진다. 그래서 ART의 w·h만 보면 검사가 헛돈다 — 실제로 그려지는
    // 상자를 봐야 찌그러진 음식을 잡는다.
    //
    // 사람·벽·난간은 안 본다. 벽과 난간은 조각을 이어 붙이는 것이고,
    // 차단바나 갈라진 곳은 길이를 방이 정하는 장치다. 음식은 생긴 모양이
    // 정해져 있어서 늘어나면 바로 이상해 보인다.
    const { ROOMS } = await import('../src/data/rooms.js');

    let checked = 0;
    for (const room of ROOMS) {
        for (const hazard of room.hazards) {
            if (!FOOD.includes(hazard.art)) continue;
            const file = sizeOf(at(ART[hazard.art].src));
            assert.equal(hazard.w / hazard.h, file.w / file.h,
                `${room.name}의 ${hazard.art}: 상자는 ${hazard.w}×${hazard.h}인데 `
                + `그림은 ${file.w}×${file.h}다 — 늘어나서 찌그러진다`);
            checked++;
        }
    }
    assert.equal(checked, FOOD.length, `음식 ${FOOD.length}가지를 다 보지 못했다 (${checked}개만 봤다)`);
});

test('편집기가 놓는 기본 크기도 그림 비율과 같다', () => {
    // 끌어다 놓자마자 찌그러진 음식이 나오면 안 된다.
    for (const name of FOOD) {
        const spec = ART[name];
        assert.ok(spec.w && spec.h, `${name}에 기본 크기가 없다`);
        const file = sizeOf(at(spec.src));
        assert.equal(spec.w / spec.h, file.w / file.h,
            `${name}: 기본 크기 ${spec.w}×${spec.h}가 그림 ${file.w}×${file.h}와 안 맞는다`);
    }
});

test('음식 미끼는 편의점에만 있다', async () => {
    // 간식을 사러 온 사람이 간식에 혹해 붙잡힌다는 농담이 편의점에서만 선다.
    const { ROOMS } = await import('../src/data/rooms.js');

    for (const room of ROOMS) {
        const foods = room.hazards.filter(h => FOOD.includes(h.art));
        if (room.name === '편의점') assert.equal(foods.length, FOOD.length, '편의점에 음식이 덜 있다');
        else assert.equal(foods.length, 0, `${room.name}에 음식 미끼가 있다`);
    }
});

test('사람 그림은 발이 맨 아래에 닿아 있다', () => {
    // 기준점이 발밑이다. 그림 아래에 투명한 줄이 남아 있으면 그만큼 사람이
    // 공중에 뜬다. art-guide가 "자주 하는 실수"로 꼽는 것이 이것이다.
    for (const name of ['idol', ...WATCHERS]) {
        const box = opaqueBox(at(ART[name].src));
        assert.ok(box, `${name}이 통째로 투명하다`);

        const gap = box.height - 1 - box.bottom;
        assert.ok(gap <= 1, `${name}: 발밑에 빈 줄이 ${gap}줄 있다 — 그만큼 공중에 뜬다`);
    }
});

test('사람 그림은 좌우 가운데에 서 있다', () => {
    // 서 있는 자리가 곧 시야의 꼭짓점이다. 그림이 한쪽으로 치우치면
    // 사람과 시야가 어긋나 보인다.
    for (const name of ['idol', ...WATCHERS]) {
        const box = opaqueBox(at(ART[name].src));
        const middle = (box.left + box.right + 1) / 2;
        const off = Math.abs(middle - box.width / 2);

        // 원본 기준 2px까지 봐준다. 손 하나가 튀어나온 그림까지 막을 일은 아니다.
        assert.ok(off <= 2, `${name}: 가운데에서 ${off.toFixed(1)}px 치우쳐 있다`);
    }
});

test('감시자는 넷 다 발밑을 기준으로 삼는다', () => {
    for (const name of WATCHERS) {
        assert.equal(ART[name].anchor, 'feet', `${name}의 기준점이 발밑이 아니다`);
        assert.ok(!ART[name].tile, `${name}는 반복해 그리는 것이 아니다`);
    }
});

test('방이 쓰는 그림은 모두 art.js에 있다', async () => {
    // 없는 이름을 적으면 그 함정만 조용히 도형으로 나온다. 오타를 알 길이 없다.
    const { ROOMS } = await import('../src/data/rooms.js');
    for (const room of ROOMS) {
        if (room.background) assert.ok(ART[room.background], `${room.name}의 배경 ${room.background}`);
        if (room.exit.art) assert.ok(ART[room.exit.art], `${room.name}의 출구 ${room.exit.art}`);
        for (const hazard of room.hazards) {
            if (hazard.art) assert.ok(ART[hazard.art], `${room.name}의 함정 ${hazard.art}`);
        }
        for (const prop of room.props ?? []) {
            assert.ok(ART[prop.name], `${room.name}의 소품 ${prop.name}`);
        }
    }
});

// ── 들킴 화면 ─────────────────────────────────────────────────

test('감시병에 들키면 감시 그림, 함정에 걸리면 함정 그림이다', async () => {
    const { caughtArtFor } = await import('../src/view/art.js');

    assert.equal(caughtArtFor({ kind: 'cone', art: 'watch1' }), 'caughtWatch');
    assert.equal(caughtArtFor({ kind: 'rect', art: 'tteokbokki' }), 'caughtTrap');
    assert.equal(caughtArtFor({ kind: 'rect', art: 'icecream' }), 'caughtTrap');
    assert.equal(caughtArtFor({ kind: 'mover', art: 'cart' }), 'caughtTrap');
    assert.equal(caughtArtFor({ kind: 'blink', art: 'sensor' }), 'caughtTrap');
    assert.equal(caughtArtFor({ kind: 'spinner', art: 'gate' }), 'caughtTrap');
    assert.equal(caughtArtFor({ kind: 'rect', hidden: true }), 'caughtTrap');
});

test('무엇에 들켰는지 모르면 글자만 나온다', async () => {
    const { caughtArtFor } = await import('../src/view/art.js');
    assert.equal(caughtArtFor(null), null);
    assert.equal(caughtArtFor(undefined), null);

    // 모르는 종류를 아는 척하면 안 된다. 새 함정을 만들고 여기를 안 고쳤을 때
    // 엉뚱한 그림이 나오느니 예전 글자 화면으로 돌아가는 편이 낫다.
    assert.equal(caughtArtFor({}), null);
    assert.equal(caughtArtFor({ kind: 'bomb' }), null);
    assert.equal(caughtArtFor({ art: 'icecream' }), null);
});

test('함정 종류가 하나도 빠지지 않았다', async () => {
    // hazards.js가 아는 종류와 들킴 그림이 아는 종류가 같아야 한다.
    // 어긋나면 그 함정에 죽었을 때만 글자 화면이 나온다.
    const { caughtArtFor } = await import('../src/view/art.js');
    const { KINDS } = await import('../src/editor/defaults.js');

    for (const kind of Object.keys(KINDS)) {
        assert.ok(caughtArtFor({ kind }), `${kind}에 들킴 그림이 없다`);
    }
});

test('방에 놓인 모든 함정이 들킴 그림을 갖는다', async () => {
    // 그림 없이 지나가는 함정이 있으면 그 방에서만 글자 화면이 나와서,
    // 고장인지 일부러 그런 것인지 알 수가 없다.
    const { caughtArtFor } = await import('../src/view/art.js');
    const { ROOMS } = await import('../src/data/rooms.js');

    for (const room of ROOMS) {
        for (const hazard of room.hazards) {
            const name = caughtArtFor(hazard);
            assert.ok(name && ART[name], `${room.name}의 ${hazard.kind}에 들킴 그림이 없다`);
        }
    }
});

test('들킴 그림 두 장이 다 있고 화면 크기다', () => {
    for (const name of ['caughtTrap', 'caughtWatch', 'endNap', 'openLightOn', 'openLightOff']) {
        const { w, h } = sizeOf(at(ART[name].src));
        assert.deepEqual([w, h], [960, 720], `${name}이 960×720이 아니다`);
    }
});

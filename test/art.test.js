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

test('사람 그림은 표시 크기와 비율이 같다', () => {
    // 상자에 맞춰 늘여 그리는 방식이라, 비율이 어긋나면 사람이 옆으로 퍼진다.
    // 화면에서 작게 나오는 그림이라 눈으로는 잘 안 잡힌다. 그래서 검사가 본다.
    for (const name of ['idol', ...WATCHERS]) {
        const spec = ART[name];
        const file = sizeOf(at(spec.src));
        assert.equal(file.w / file.h, spec.w / spec.h,
            `${name}: 파일은 ${file.w}×${file.h}인데 표시는 ${spec.w}×${spec.h}다`);
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

// 화면의 한 점에서 "무엇을 집었는가"를 고른다.
//
// 순수하다 — 방 데이터와 점 하나, 그리고 시각만 받는다. 캔버스도 마우스도 모른다.
// 그래서 검사할 수 있고, 집는 규칙이 바뀌면 검사가 먼저 말해준다.

import { shapeAt } from '../rules/hazards.js';

const inBox = (box, x, y) => x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
const near = (px, py, x, y, radius) => Math.hypot(x - px, y - py) <= radius;

/// 부채꼴과 도는 막대는 x·y가 <b>가운데</b>라 상자가 없다. 손잡이만한 원으로 잡는다.
const HANDLE = 26;

/// <b>보이는 자리에서 집힌다.</b>
///
/// 함정의 x·y가 아니라 `shapeAt`이 내놓는 "지금 이 순간의 모양"으로 잡는 것이
/// 중요하다. 오가는 카트는 x가 왼쪽 끝일 때의 자리를 들고 있어서, 그것으로 잡으면
/// 화면에서 카트가 보이는 곳을 눌러도 안 집히고 아무것도 없는 허공에서 집힌다.
function hitsShape(shape, x, y) {
    if (shape.kind === 'sector') return near(shape.x, shape.y, x, y, HANDLE);
    if (shape.kind === 'obb') return near(shape.x, shape.y, x, y, Math.max(HANDLE, shape.h ?? 0));
    return inBox(shape, x, y);
}

/// 이 점에서 집히는 것. 없으면 null.
///
/// 순서가 규칙이다. <b>나중에 놓은 것이 먼저 집힌다</b> — 화면에서도 나중 것이
/// 위에 그려지니, 눈에 보이는 것이 집히는 것과 같아야 한다.
/// 함정 → 소품 → 시작 자리 → 출구 순인 것은 방을 짤 때 함정을 제일 많이 만지기 때문이다.
export function pickAt(room, x, y, t = 0) {
    for (let i = room.hazards.length - 1; i >= 0; i--) {
        if (hitsShape(shapeAt(room.hazards[i], t), x, y)) return { what: 'hazard', index: i };
    }

    const props = room.props ?? [];
    for (let i = props.length - 1; i >= 0; i--) {
        if (inBox(props[i], x, y)) return { what: 'prop', index: i };
    }

    if (near(room.spawn.x, room.spawn.y, x, y, HANDLE)) return { what: 'spawn', index: 0 };
    if (inBox(room.exit, x, y)) return { what: 'exit', index: 0 };

    return null;
}

/// 집은 것의 실체. 방 데이터 안의 <b>그 객체 자체</b>를 돌려준다 —
/// 편집기가 여기에 대고 고치면 게임이 바로 그걸 본다.
export function itemOf(room, selection) {
    if (!selection) return null;
    if (selection.what === 'hazard') return room.hazards[selection.index];
    if (selection.what === 'prop') return room.props[selection.index];
    if (selection.what === 'spawn') return room.spawn;
    return room.exit;
}

/// 집은 것을 dx·dy만큼 옮긴다. 어떤 것이든 x·y를 더하면 되므로 갈래가 없다.
///
/// 오가는 것은 <b>왕복의 기준점</b>이 움직인다. 보이는 자리에서 집어 끌어도
/// 움직이는 것은 기준점이라, 끌던 손과 함정이 어긋나 보이지 않는다.
export function moveBy(item, dx, dy) {
    item.x = Math.round(item.x + dx);
    item.y = Math.round(item.y + dy);
}

/// 집은 것을 방에서 뺀다. 시작 자리와 출구는 없앨 수 없다 — 없으면 방이 아니다.
export function removeFrom(room, selection) {
    if (!selection) return false;
    if (selection.what === 'hazard') { room.hazards.splice(selection.index, 1); return true; }
    if (selection.what === 'prop') { room.props.splice(selection.index, 1); return true; }
    return false;
}

/// 선택한 것을 화면에 표시할 테두리. 없으면 null.
/// 집는 자리와 <b>같은 것</b>을 써야 한다 — 테두리가 딴 데 있으면 어디를 눌러야
/// 집히는지 알 수 없다. 그래서 여기도 "지금 이 순간의 모양"을 본다.
export function outlineOf(room, selection, t = 0) {
    const item = itemOf(room, selection);
    if (!item) return null;

    if (selection.what === 'spawn') {
        return { x: item.x - HANDLE, y: item.y - HANDLE, w: HANDLE * 2, h: HANDLE * 2, round: true };
    }
    if (selection.what !== 'hazard') {
        return { x: item.x, y: item.y, w: item.w, h: item.h, round: false };
    }

    const shape = shapeAt(item, t);
    if (shape.kind === 'sector' || shape.kind === 'obb') {
        const r = shape.kind === 'obb' ? Math.max(HANDLE, shape.h ?? 0) : HANDLE;
        return { x: shape.x - r, y: shape.y - r, w: r * 2, h: r * 2, round: true };
    }
    return { x: shape.x, y: shape.y, w: shape.w, h: shape.h, round: false };
}

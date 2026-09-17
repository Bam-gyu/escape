// 화면의 한 점에서 "무엇을 집었는가"를 고른다.
//
// 순수하다 — 방 데이터와 점 하나만 받는다. 캔버스도 마우스도 모른다.
// 그래서 검사할 수 있고, 집는 규칙이 바뀌면 검사가 먼저 말해준다.

const inBox = (box, x, y) => x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
const near = (px, py, x, y, radius) => Math.hypot(x - px, y - py) <= radius;

/// cone과 spinner는 x·y가 <b>가운데</b>라 상자가 없다. 손잡이만한 원으로 잡는다.
const HANDLE = 26;

/// 함정 하나를 집을 수 있는 범위.
function hitsHazard(hazard, x, y) {
    if (hazard.kind === 'cone') return near(hazard.x, hazard.y, x, y, HANDLE);
    if (hazard.kind === 'spinner') return near(hazard.x, hazard.y, x, y, Math.max(HANDLE, hazard.thickness ?? 0));
    return inBox(hazard, x, y);
}

/// 이 점에서 집히는 것. 없으면 null.
///
/// 순서가 규칙이다. <b>나중에 놓은 것이 먼저 집힌다</b> — 화면에서도 나중 것이
/// 위에 그려지니, 눈에 보이는 것이 집히는 것과 같아야 한다.
/// 함정 → 소품 → 시작 자리 → 출구 순인 것은 방을 짤 때 함정을 제일 많이 만지기 때문이다.
export function pickAt(room, x, y) {
    for (let i = room.hazards.length - 1; i >= 0; i--) {
        if (hitsHazard(room.hazards[i], x, y)) return { what: 'hazard', index: i };
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
/// 그리기는 편집기가 하고, 어디에 그릴지는 여기가 정한다.
export function outlineOf(room, selection) {
    const item = itemOf(room, selection);
    if (!item) return null;

    if (selection.what === 'spawn'
        || (selection.what === 'hazard' && (item.kind === 'cone' || item.kind === 'spinner'))) {
        return { x: item.x - HANDLE, y: item.y - HANDLE, w: HANDLE * 2, h: HANDLE * 2, round: true };
    }
    return { x: item.x, y: item.y, w: item.w, h: item.h, round: false };
}

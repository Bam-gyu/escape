// 방 목록을 rooms.js 소스로 되돌린다.
//
// 편집기가 화면에서 고친 것은 결국 <b>사람이 읽는 파일</b>로 돌아가야 한다.
// 여기가 그 일만 한다 — 화면도 서버도 모르는 순수 함수라서 검사할 수 있고,
// 검사가 "쓴 것을 다시 읽으면 같은 값이 나온다"까지 붙잡아 준다.

/// 값을 적는 순서. <b>여기 없는 이름은 안 써진다.</b>
///
/// 순서를 정해 두는 것은 보기 좋으라고가 아니다. 순서가 들쭉날쭉하면
/// 아무것도 안 고치고 저장만 해도 git diff가 파일 전체로 번져서,
/// 무엇을 실제로 바꿨는지 알 수 없게 된다.
const HAZARD_FIELDS = [
    'kind',
    'x', 'y', 'w', 'h',
    'radius', 'spread', 'from', 'to',
    'length', 'thickness',
    'period', 'on',
    'dx', 'dy', 'walkPeriod', 'walkOffset',
    'offset',
    'travel',
    'art', 'flip', 'hidden', 'inBackground',
];

/// 가로지르기. 함정 안에 덩이 하나로 들어간다.
const TRAVEL_FIELDS = ['dx', 'dy', 'duration', 'gap', 'offset', 'loop'];

const PROP_FIELDS = ['name', 'x', 'y', 'w', 'h', 'flip'];
const BOX_FIELDS = ['x', 'y', 'w', 'h', 'art', 'inBackground'];

/// 소수점이 꼬리를 물지 않게 자른다. 화면에서 끌어다 놓으면
/// 480.00000000001 같은 것이 나오는데, 그게 파일에 남으면 읽을 수가 없다.
function num(value) {
    return String(Math.round(value * 100) / 100);
}

function quote(text) {
    return `'${String(text).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function value(v) {
    if (typeof v === 'number') return num(v);
    if (typeof v === 'boolean') return String(v);
    // 겹친 덩이는 하나뿐이다(travel). 더 생기면 여기에 갈래를 얹는다.
    if (v && typeof v === 'object') return inline(v, TRAVEL_FIELDS);
    return quote(v);
}

/// { kind: 'rect', x: 0, ... } 한 줄. 함정 하나가 한 줄을 넘지 않는 것이
/// 이 파일을 훑어보게 만드는 힘이라서 줄바꿈하지 않는다.
function inline(object, fields) {
    const parts = [];
    for (const key of fields) {
        if (object[key] === undefined || object[key] === null) continue;
        parts.push(`${key}: ${value(object[key])}`);
    }
    return `{ ${parts.join(', ')} }`;
}

/// 방에 달린 설명. <b>주석이 아니라 데이터로 들고 있다.</b>
///
/// 주석으로 두면 편집기가 저장하는 순간 날아간다. 이 프로젝트에서 방 위의
/// 설명은 "이 방은 무엇을 가르치는 방인가"를 적어둔 자리라서, 한 번 저장했다고
/// 사라지면 편집기가 문서를 잡아먹은 것이 된다. 그래서 note로 남긴다.
function noteLines(note, indent) {
    if (!note || note.length === 0) return [];
    if (note.length === 1) return [`${indent}note: [${quote(note[0])}],`];

    const out = [`${indent}note: [`];
    for (const line of note) out.push(`${indent}    ${quote(line)},`);
    out.push(`${indent}],`);
    return out;
}

function serializeRoom(room) {
    const out = [];
    out.push('    {');
    out.push(...noteLines(room.note, '        '));
    out.push(`        name: ${quote(room.name)},`);
    if (room.background) out.push(`        background: ${quote(room.background)},`);
    out.push(`        spawn: { x: ${num(room.spawn.x)}, y: ${num(room.spawn.y)} },`);
    out.push(`        exit: ${inline(room.exit, BOX_FIELDS)},`);

    out.push('        hazards: [');
    for (const hazard of room.hazards ?? []) {
        out.push(`            ${inline(hazard, HAZARD_FIELDS)},`);
    }
    out.push('        ],');

    if (room.props && room.props.length > 0) {
        out.push('        props: [');
        for (const prop of room.props) out.push(`            ${inline(prop, PROP_FIELDS)},`);
        out.push('        ],');
    }

    out.push('    },');
    return out;
}

/// 파일 맨 위의 긴 설명은 건드리지 않고 그대로 이어 붙인다.
///
/// 그 설명이 이 프로젝트에서 방을 짜는 법을 가르치는 유일한 자리다.
/// 편집기가 한 번 저장했다고 그게 사라지면, 편집기가 문서를 잡아먹은 것이 된다.
export function serializeRooms(rooms, header) {
    const lines = ['export const ROOMS = ['];
    for (const room of rooms) lines.push(...serializeRoom(room));
    lines.push('];');
    return `${header}${lines.join('\n')}\n`;
}

/// 지금 파일에서 머리말만 떼어낸다. `export const ROOMS` 앞까지가 머리말이다.
export function splitHeader(source) {
    const at = source.indexOf('export const ROOMS');
    if (at === -1) throw new Error('rooms.js에서 `export const ROOMS`를 못 찾았다');
    return source.slice(0, at);
}

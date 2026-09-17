// 편집기가 아는 것들. <b>규칙이 아니라 편의다.</b>
//
// 여기 적힌 숫자는 "끌어다 놓았을 때 일단 이 정도"라는 뜻일 뿐이다.
// 게임은 이 파일을 안 본다 — 놓고 나서 고친 숫자만 rooms.js로 간다.

import { ART } from '../view/art.js';

/// 종류마다 쓰는 값과 그 뜻. 패널의 입력칸이 이 목록에서 나온다.
/// 새 함정을 만들면 여기에 한 줄 더하면 편집기가 그걸 다룰 줄 알게 된다.
///
/// fields는 <b>없으면 함정이 안 되는 값</b>이고, extras는 안 줘도 되는 값이다.
/// 가른 이유는 파일이다 — extras까지 늘 적으면 방마다 `offset: 0, dx: 0, dy: 0`이
/// 붙어 rooms.js가 0으로 뒤덮인다. 안 쓰는 값은 안 적는 편이 읽힌다.
export const KINDS = {
    rect: {
        label: '가만히 있는 것',
        fields: ['x', 'y', 'w', 'h'],
        extras: [],
    },
    blink: {
        label: '깜빡이는 것',
        fields: ['x', 'y', 'w', 'h', 'period', 'on'],
        extras: ['offset'],
    },
    mover: {
        label: '오가는 것',
        fields: ['x', 'y', 'w', 'h', 'dx', 'period'],
        extras: ['dy', 'offset'],
    },
    spinner: {
        label: '도는 막대',
        fields: ['x', 'y', 'length', 'thickness', 'period'],
        extras: ['offset'],
    },
    cone: {
        label: '사람의 시야',
        fields: ['x', 'y', 'radius', 'spread', 'from', 'to', 'period'],
        extras: ['offset', 'dx', 'dy', 'walkPeriod'],
    },
};

/// 입력칸 하나하나의 설명. 숫자만 늘어놓으면 무엇을 만지는지 알 수 없다.
export const FIELD_HELP = {
    x: '가로 자리', y: '세로 자리',
    w: '너비', h: '높이',
    radius: '보는 거리', spread: '한 번에 보는 넓이(도). 45 넘으면 확 어려워진다',
    from: '고개를 돌리기 시작하는 각도. 0이 오른쪽, 90이 아래쪽',
    to: '고개가 돌아가는 끝 각도. from과 같게 두면 한 곳만 본다',
    length: '막대 길이', thickness: '막대 두께',
    period: '한 번 왕복(또는 한 바퀴)에 걸리는 초. 음수면 반대로 돈다',
    on: '죽이는 시간(초). period 안에서 이만큼만 켜진다',
    offset: '시작 박자를 미는 초. 함정끼리 박자를 어긋나게 할 때',
    dx: '가로로 오가는 거리', dy: '세로로 오가는 거리',
    walkPeriod: '걷는 주기(초). <b>보는 주기와 다르게 줘라</b> — 같으면 안전한 쪽이 고정된다',
};

/// 그림을 끌어다 놓았을 때 무엇이 되는가.
///
/// 경비를 놓으면 시야가, 차단바를 놓으면 도는 막대가 나와야 한다.
/// 놓자마자 "그럴듯한 것"이 되어 있어야 편집기가 쓸모 있다. 놓고 나서 바꿔도 된다.
const BY_ART = {
    guard: 'cone', manager: 'cone',
    cart: 'mover',
    gate: 'spinner',
    sensor: 'blink', lamp: 'blink',
};

/// 판정이 없는 장식. 게임은 이 목록을 아예 안 본다.
const PROP_ARTS = ['sofa', 'vending', 'plant', 'locker', 'shoes', 'car', 'trash', 'sign'];

/// 함정으로 쓰는 그림.
const HAZARD_ARTS = [
    'guard', 'manager', 'cart', 'gate', 'sensor', 'lamp', 'rail', 'wall', 'crack',
    'tteokbokki', 'chicken', 'ramen',
];

/// 패널의 서랍. 배경·오프닝·걷기 같은 것은 놓을 수 있는 것이 아니라 뺀다.
export const DRAWERS = [
    { title: '함정', arts: HAZARD_ARTS },
    { title: '소품 — 판정 없음', arts: PROP_ARTS },
];

export const isProp = art => PROP_ARTS.includes(art);

/// 종류마다의 기본 숫자. 놓자마자 움직이고 보이는 값이라야 한다 —
/// period 0짜리로 놓이면 화면에서 아무 일도 안 일어나 고장으로 보인다.
function base(kind, x, y, art) {
    const spec = ART[art] ?? {};
    const w = spec.w ?? 110;
    const h = spec.h ?? 80;

    if (kind === 'cone') {
        return { kind, x, y, radius: 160, spread: 46, from: 55, to: 125, period: 3.4, art };
    }
    if (kind === 'spinner') {
        return { kind, x, y, length: 260, thickness: 22, period: 4, art };
    }
    if (kind === 'mover') {
        return { kind, x: x - w / 2, y: y - h / 2, w: 140, h: 34, dx: 240, period: 4.4, art };
    }
    if (kind === 'blink') {
        return { kind, x: x - w / 2, y: y - h / 2, w, h, period: 2, on: 1, art };
    }
    return { kind, x: x - w / 2, y: y - h / 2, w, h, art };
}

/// 그림 하나를 x·y에 놓았을 때 생기는 것.
/// cone과 spinner의 x·y는 <b>가운데</b>라서 왼쪽 위로 밀지 않는다.
export function makeItem(art, x, y) {
    if (isProp(art)) {
        const spec = ART[art] ?? {};
        const w = spec.w ?? 110;
        const h = spec.h ?? 90;
        return { name: art, x: Math.round(x - w / 2), y: Math.round(y - h / 2), w, h };
    }
    const item = base(BY_ART[art] ?? 'rect', Math.round(x), Math.round(y), art);
    item.x = Math.round(item.x);
    item.y = Math.round(item.y);
    return item;
}

/// 종류를 바꾼다. 같은 이름의 값은 그대로 두고, 새로 필요한 것만 채운다.
/// 자리를 지키는 것이 중요하다 — 종류를 바꿨다고 함정이 화면 반대쪽으로 뛰면
/// 무엇이 바뀐 건지 알 수 없다.
export function changeKind(item, kind) {
    const fresh = base(kind, item.x, item.y, item.art);
    const next = { kind, x: item.x, y: item.y, art: item.art };

    for (const field of KINDS[kind].fields) {
        if (field === 'x' || field === 'y') continue;
        next[field] = item[field] ?? fresh[field];
    }

    // 안 줘도 되는 값은 <b>이미 준 것만</b> 넘긴다. 없던 것을 0으로 채우면
    // 종류를 한 번 바꿨다고 rooms.js에 0이 줄줄이 붙는다.
    for (const field of KINDS[kind].extras) {
        if (item[field] !== undefined) next[field] = item[field];
    }

    if (item.hidden) next.hidden = true;
    if (item.inBackground) next.inBackground = true;
    return next;
}

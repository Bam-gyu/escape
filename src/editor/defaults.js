// 편집기가 아는 것들. <b>규칙이 아니라 편의다.</b>
//
// 여기 적힌 숫자는 "끌어다 놓았을 때 일단 이 정도"라는 뜻일 뿐이다.
// 게임은 이 파일을 안 본다 — 놓고 나서 고친 숫자만 rooms.js로 간다.

import { ART, WATCHERS } from '../view/art.js';

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
    cart: 'mover',
    gate: 'spinner',
    sensor: 'blink', lamp: 'blink',
};

// 감시하는 사람은 전부 시야가 된다. 한 줄씩 적지 않는 것은 사람이 늘어날 때
// art.js와 여기 두 군데를 고치게 되고, 한 군데를 잊으면 사람을 놓았는데
// 시야가 아니라 벽이 나오기 때문이다.
for (const name of WATCHERS) BY_ART[name] = 'cone';

/// 판정이 없는 장식. 게임은 이 목록을 아예 안 본다.
const PROP_ARTS = ['sofa', 'vending', 'plant', 'locker', 'shoes', 'car', 'trash', 'sign'];

/// 함정으로 쓰는 그림.
const HAZARD_ARTS = [
    'cart', 'gate', 'sensor', 'lamp', 'rail', 'wall', 'crack',
    'tteokbokki', 'chicken', 'ramen', 'icecream',
];

/// 패널의 서랍. 배경·오프닝·걷기 같은 것은 놓을 수 있는 것이 아니라 뺀다.
///
/// <b>감시하는 사람을 맨 위 서랍에 따로 둔다.</b> 방을 짤 때 제일 먼저 놓는 것이
/// 사람이고, 함정 열댓 개에 섞여 있으면 매번 찾아야 한다.
export const DRAWERS = [
    { title: '감시하는 사람 — 놓으면 시야가 된다', arts: [...WATCHERS] },
    { title: '함정', arts: HAZARD_ARTS },
    { title: '소품 — 판정 없음', arts: PROP_ARTS },
];

export const isProp = art => PROP_ARTS.includes(art);

/// x·y가 <b>가운데</b>를 뜻하는 종류. 나머지는 왼쪽 위 모서리다.
/// 이 갈림이 편집기에서 가장 자주 사고를 내는 자리라 한 곳에 모아 둔다.
export const isCentered = kind => kind === 'cone' || kind === 'spinner';

/// 화면에서 보이는 가운데. 종류가 달라도 이걸로 견주면 자리가 안 어긋난다.
export function centerOf(item) {
    if (isCentered(item.kind)) return { x: item.x, y: item.y };
    return { x: item.x + (item.w ?? 0) / 2, y: item.y + (item.h ?? 0) / 2 };
}

/// 종류마다의 기본 숫자. 놓자마자 움직이고 보이는 값이라야 한다 —
/// period 0짜리로 놓이면 화면에서 아무 일도 안 일어나 고장으로 보인다.
///
/// x·y는 <b>놓은 자리가 가운데에 오게</b> 맞춘다. 상자 크기를 바꾸는 종류는
/// 그 바뀐 크기로 맞춰야 한다 — 기본 크기로 밀어놓고 상자만 갈면 딴 데 놓인다.
function base(kind, x, y, art) {
    const spec = ART[art] ?? {};
    const corner = (w, h, rest) => ({ kind, x: Math.round(x - w / 2), y: Math.round(y - h / 2), w, h, ...rest, art });

    if (kind === 'cone') {
        return { kind, x, y, radius: 160, spread: 46, from: 55, to: 125, period: 3.4, art };
    }
    if (kind === 'spinner') {
        return { kind, x, y, length: 260, thickness: 22, period: 4, art };
    }
    if (kind === 'mover') return corner(140, 34, { dx: 240, period: 4.4 });
    if (kind === 'blink') return corner(spec.w ?? 110, spec.h ?? 80, { period: 2, on: 1 });
    return corner(spec.w ?? 110, spec.h ?? 80, {});
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
///
/// <b>화면에서 보이는 가운데를 지킨다.</b> x·y를 그대로 베끼면 안 된다 —
/// 부채꼴의 x·y는 가운데고 상자의 x·y는 왼쪽 위라, 숫자만 옮기면 종류를 바꾼
/// 순간 함정이 제 크기의 절반만큼 뛴다. 무엇이 바뀐 건지 알 수 없게 된다.
export function changeKind(item, kind) {
    const center = centerOf(item);
    const fresh = base(kind, center.x, center.y, item.art);
    const next = { kind, x: fresh.x, y: fresh.y, art: item.art };

    for (const field of KINDS[kind].fields) {
        if (field === 'x' || field === 'y') continue;
        next[field] = item[field] ?? fresh[field];
    }

    // 안 줘도 되는 값은 <b>이미 준 것만</b> 넘긴다. 없던 것을 0으로 채우면
    // 종류를 한 번 바꿨다고 rooms.js에 0이 줄줄이 붙는다.
    for (const field of KINDS[kind].extras) {
        if (item[field] !== undefined) next[field] = item[field];
    }

    // 상자 크기를 물려받았으면 그 크기로 가운데를 다시 맞춘다.
    if (next.w !== undefined) {
        next.x = Math.round(center.x - next.w / 2);
        next.y = Math.round(center.y - next.h / 2);
    }

    if (item.hidden) next.hidden = true;
    if (item.inBackground) next.inBackground = true;
    return next;
}

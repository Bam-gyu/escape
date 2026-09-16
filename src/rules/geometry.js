// 도형이 겹치는지만 본다. 화면도 시간도 게임도 모른다.

/// 점에서 사각형까지의 최단 거리의 제곱. 제곱근을 안 씌우는 건 비교만 하기 때문이다.
function distanceSquaredToRect(px, py, rect) {
    const dx = Math.max(rect.x - px, 0, px - (rect.x + rect.w));
    const dy = Math.max(rect.y - py, 0, py - (rect.y + rect.h));
    return dx * dx + dy * dy;
}

export function circleHitsRect(cx, cy, radius, rect) {
    return distanceSquaredToRect(cx, cy, rect) <= radius * radius;
}

/// -180보다 크고 180 이하인 각도 차(도).
/// 시야가 350도에서 10도로 넘어갈 때 차이가 340이 아니라 20이어야 한다.
export function angleDelta(from, to) {
    let d = (to - from) % 360;
    if (d > 180) d -= 360;
    if (d <= -180) d += 360;
    return d;
}

/// 원이 부채꼴과 겹치는가. 간수의 시야에 쓴다.
export function circleHitsSector(cx, cy, radius, sector) {
    const dx = cx - sector.x;
    const dy = cy - sector.y;
    const distance = Math.hypot(dx, dy);

    if (distance > sector.radius + radius) return false;

    // 원이 부채꼴의 꼭짓점을 덮고 있으면 각도를 따질 것도 없다.
    // 이걸 빼면 간수에게 바짝 붙었을 때 atan2가 흔들려 판정이 깜빡인다.
    if (distance <= radius) return true;

    const toCircle = Math.atan2(dy, dx) * 180 / Math.PI;

    // 원은 점이 아니라서, 중심이 부채꼴 밖이어도 가장자리가 걸칠 수 있다.
    // 그만큼의 각도 여유를 더해준다.
    const slack = Math.asin(Math.min(1, radius / distance)) * 180 / Math.PI;

    return Math.abs(angleDelta(sector.angle, toCircle)) <= sector.spread / 2 + slack;
}

export function clamp(value, low, high) {
    return value < low ? low : (value > high ? high : value);
}

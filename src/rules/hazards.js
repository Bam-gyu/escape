import { circleHitsRect, circleHitsSector, circleHitsOrientedRect } from './geometry.js';

/// 0에서 1로 갔다가 다시 0으로 돌아오는 값. 왕복하는 것은 전부 이걸 쓴다.
/// 사인파가 아니라 삼각파인 건 끝에서 느려지지 않게 하려는 것이다 —
/// 느려지면 감시하는 쪽이 양 끝을 오래 보게 되어 피할 틈이 한쪽으로 쏠린다.
export function pingPong(t, period) {
    if (period <= 0) return 0;
    const phase = ((t % period) + period) % period / period;
    return phase < 0.5 ? phase * 2 : 2 - phase * 2;
}

/// period초에 한 바퀴. 왕복하지 않고 계속 한 방향으로 돈다.
/// period가 음수면 반대로 돈다.
export function spin(t, period) {
    if (period === 0) return 0;
    return 360 * t / period;
}

/// 한 방향으로 가로질러 갔다가 사라지고, 잠시 뒤 처음 자리에 다시 나타난다.
///
/// <b>종류가 아니라 얹는 것이다.</b> `travel`을 준 함정은 무엇이든 — 벽이든
/// 감시자든 — 제자리에서 그만큼 흘러간다. 새 종류로 만들었다면 움직이는 벽,
/// 움직이는 센서, 움직이는 감시자를 따로 만들어야 했다.
///
/// `mover`와 다른 점은 <b>왕복하지 않는다</b>는 것이다. 도로를 지나가는 차는
/// 끝까지 갔다가 되돌아오지 않는다. 화면 밖으로 나가 사라졌다가, `gap`초 뒤
/// 처음 자리에서 다시 나온다. `loop`가 거짓이면 한 번 가고 끝이다.
///
///   travel: { dx, dy, duration, gap, offset, loop }
///
/// 돌려주는 `gone`은 "지금은 화면에 없다"는 뜻이다. 이때는 안 죽이고 안 그린다.
export function travelAt(travel, t) {
    if (!travel) return { ox: 0, oy: 0, gone: false };

    const duration = travel.duration ?? 0;
    const gap = travel.gap ?? 0;
    const cycle = duration + gap;
    const time = t + (travel.offset ?? 0);

    // 한 번만 가는 것. 다 가고 나면 영영 없다.
    if (!travel.loop) {
        if (time >= duration) return { ox: 0, oy: 0, gone: true };
        const k = duration > 0 ? Math.max(0, time) / duration : 0;
        return { ox: (travel.dx ?? 0) * k, oy: (travel.dy ?? 0) * k, gone: false };
    }

    // 한 바퀴가 0이면 시간이 안 흐르는 것과 같다. 나누기 전에 막는다.
    if (cycle <= 0) return { ox: 0, oy: 0, gone: false };

    const phase = ((time % cycle) + cycle) % cycle;
    if (phase >= duration) return { ox: 0, oy: 0, gone: true };

    const k = duration > 0 ? phase / duration : 0;
    return { ox: (travel.dx ?? 0) * k, oy: (travel.dy ?? 0) * k, gone: false };
}

/// 제자리의 도형에 가로지르기를 얹는다. travel이 없으면 그대로 돌려준다.
function withTravel(hazard, t, shape) {
    const { ox, oy, gone } = travelAt(hazard.travel, t);
    if (!hazard.travel) return shape;

    shape.x += ox;
    shape.y += oy;
    shape.gone = gone;
    if (gone) shape.lethal = false;
    return shape;
}

/// 지금 이 함정이 차지하고 있는 도형.
///
/// <b>시간만 넣으면 나머지는 정해진다.</b> 함정은 자기 상태를 들고 있지 않아서
/// 되감아도, 건너뛰어도, 두 번 물어도 같은 답이 나온다. 죽고 다시 시작할 때
/// 함정을 되돌리는 코드가 따로 필요 없는 이유다.
export function shapeAt(hazard, t) {
    return withTravel(hazard, t, shapeInPlace(hazard, t));
}

/// 가로지르기를 빼고, 제자리에서의 모습만. 종류별 갈래는 여기 하나뿐이다.
function shapeInPlace(hazard, t) {
    switch (hazard.kind) {
        case 'rect':
            return { kind: 'rect', x: hazard.x, y: hazard.y, w: hazard.w, h: hazard.h, lethal: true, of: hazard };

        case 'blink': {
            const phase = t + (hazard.offset ?? 0);
            const lethal = ((phase % hazard.period) + hazard.period) % hazard.period < hazard.on;
            return { kind: 'rect', x: hazard.x, y: hazard.y, w: hazard.w, h: hazard.h, lethal, of: hazard };
        }

        case 'mover': {
            const k = pingPong(t + (hazard.offset ?? 0), hazard.period);
            return {
                kind: 'rect',
                x: hazard.x + (hazard.dx ?? 0) * k,
                y: hazard.y + (hazard.dy ?? 0) * k,
                w: hazard.w, h: hazard.h, lethal: true, of: hazard,
            };
        }

        case 'spinner': {
            const angle = (hazard.from ?? 0) + spin(t + (hazard.offset ?? 0), hazard.period);
            return {
                kind: 'obb',
                x: hazard.x, y: hazard.y,
                w: hazard.length, h: hazard.thickness,
                angle,
                lethal: true, of: hazard,
            };
        }

        case 'cone': {
            // 고개와 발의 주기를 따로 둔다. 같은 값을 쓰면 "오른쪽으로 갈 때는
            // 늘 오른쪽을 본다"가 되어 안전한 쪽이 고정되고, 방이 한 번 보면 끝난다.
            const look = pingPong(t + (hazard.offset ?? 0), hazard.period);
            const walk = pingPong(t + (hazard.walkOffset ?? 0), hazard.walkPeriod ?? hazard.period);
            return {
                kind: 'sector',
                x: hazard.x + (hazard.dx ?? 0) * walk,
                y: hazard.y + (hazard.dy ?? 0) * walk,
                radius: hazard.radius, spread: hazard.spread,
                angle: hazard.from + (hazard.to - hazard.from) * look,
                lethal: true, of: hazard,
            };
        }

        default:
            throw new Error(`모르는 함정 종류: ${hazard.kind}`);
    }
}

export function shapeHitsCircle(shape, cx, cy, radius) {
    if (!shape.lethal) return false;
    switch (shape.kind) {
        case 'rect': return circleHitsRect(cx, cy, radius, shape);
        case 'obb': return circleHitsOrientedRect(cx, cy, radius, shape);
        case 'sector': return circleHitsSector(cx, cy, radius, shape);
        default: throw new Error(`모르는 도형: ${shape.kind}`);
    }
}

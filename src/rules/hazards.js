import { circleHitsRect, circleHitsSector } from './geometry.js';

/// 0에서 1로 갔다가 다시 0으로 돌아오는 값. 왕복하는 것은 전부 이걸 쓴다.
/// 사인파가 아니라 삼각파인 건 끝에서 느려지지 않게 하려는 것이다 —
/// 느려지면 간수가 양 끝을 오래 보게 되어 피할 틈이 한쪽으로 쏠린다.
export function pingPong(t, period) {
    if (period <= 0) return 0;
    const phase = ((t % period) + period) % period / period;
    return phase < 0.5 ? phase * 2 : 2 - phase * 2;
}

/// 지금 이 함정이 차지하고 있는 도형.
///
/// <b>시간만 넣으면 나머지는 정해진다.</b> 함정은 자기 상태를 들고 있지 않아서
/// 되감아도, 건너뛰어도, 두 번 물어도 같은 답이 나온다. 죽고 다시 시작할 때
/// 함정을 되돌리는 코드가 따로 필요 없는 이유다.
export function shapeAt(hazard, t) {
    switch (hazard.kind) {
        case 'rect':
            return { kind: 'rect', x: hazard.x, y: hazard.y, w: hazard.w, h: hazard.h, lethal: true, of: hazard };

        case 'blink': {
            const lethal = ((t % hazard.period) + hazard.period) % hazard.period < hazard.on;
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

        case 'cone': {
            const k = pingPong(t + (hazard.offset ?? 0), hazard.period);
            return {
                kind: 'sector',
                x: hazard.x, y: hazard.y,
                radius: hazard.radius, spread: hazard.spread,
                angle: hazard.from + (hazard.to - hazard.from) * k,
                lethal: true, of: hazard,
            };
        }

        default:
            throw new Error(`모르는 함정 종류: ${hazard.kind}`);
    }
}

export function shapeHitsCircle(shape, cx, cy, radius) {
    if (!shape.lethal) return false;
    return shape.kind === 'rect'
        ? circleHitsRect(cx, cy, radius, shape)
        : circleHitsSector(cx, cy, radius, shape);
}

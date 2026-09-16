import { shapeAt, shapeHitsCircle } from './hazards.js';
import { circleHitsRect, clamp } from './geometry.js';

export const ROOM_WIDTH = 960;
export const ROOM_HEIGHT = 720;

/// 죄수의 판정 반지름. 그림이 아무리 커도 게임이 보는 건 이 원뿐이다.
export const PLAYER_RADIUS = 7;

/// 이 방의 지금 모습 전부.
///
/// 순수하다 — 같은 값을 넣으면 언제나 같은 값이 나온다. 그래서 화면 없이
/// 검사할 수 있고, 검사한 것과 화면에 나오는 것이 같다는 것도 보장된다.
export function stepRoom(room, cursorX, cursorY, t) {
    const x = clamp(cursorX, PLAYER_RADIUS, ROOM_WIDTH - PLAYER_RADIUS);
    const y = clamp(cursorY, PLAYER_RADIUS, ROOM_HEIGHT - PLAYER_RADIUS);

    const shapes = room.hazards.map(hazard => shapeAt(hazard, t));
    const dead = shapes.some(shape => shapeHitsCircle(shape, x, y, PLAYER_RADIUS));

    // 죽는 것이 도착보다 먼저다. 출구 바로 옆에 함정이 있는 방에서
    // 순서가 반대면 죽으면서 통과하는 일이 생긴다.
    const cleared = !dead && circleHitsRect(x, y, PLAYER_RADIUS, room.exit);

    return { x, y, shapes, dead, cleared };
}

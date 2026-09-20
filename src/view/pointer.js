// 마우스가 움직인 것을 방 좌표로 바꾼다.
//
// 브라우저는 <b>커서를 옮길 수가 없다.</b> 그래서 방을 넘어갈 때 주인공을 시작
// 자리에 세우려면 커서와 주인공을 떼어놓아야 하고, 그 방법이 포인터 잠금이다.
// 잠그면 커서가 사라지고 "얼마나 움직였는지"만 온다 — 주인공의 자리는 게임이 든다.
//
// 순수하다. 캔버스도 이벤트도 모른다. 그래서 브라우저 없이 검사할 수 있다.

import { clamp } from '../rules/geometry.js';

/// 화면에서 움직인 픽셀을 방 좌표의 거리로 바꾼다.
///
/// 화면 크기로 나눠주는 것이 핵심이다. 창을 키우면 같은 손 움직임이 화면에서는
/// 더 멀리 가는데, 방 좌표로는 같아야 손맛이 안 바뀐다.
export function toRoomDelta(movement, box, room) {
    if (!(box.width > 0) || !(box.height > 0)) return { x: 0, y: 0 };
    return {
        x: movement.x * room.width / box.width,
        y: movement.y * room.height / box.height,
    };
}

/// 움직인 만큼 더한 새 자리. <b>방 밖으로는 안 나간다.</b>
///
/// 붙잡아 두지 않으면 마우스를 오른쪽으로 오래 밀었을 때 주인공은 벽에 서 있는데
/// 셈만 계속 커진다. 그러면 돌아오는 데도 민 만큼 밀어야 해서, 벽에 붙을 때마다
/// 조작이 먹통이 된 것처럼 느껴진다.
export function movedPointer(pointer, delta, room) {
    return {
        x: clamp(pointer.x + delta.x, 0, room.width),
        y: clamp(pointer.y + delta.y, 0, room.height),
    };
}

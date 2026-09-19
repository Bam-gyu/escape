import { ART, WATCHERS } from './art.js';
import { COLOR } from './palette.js';
import { ROOM_WIDTH, ROOM_HEIGHT, PLAYER_RADIUS } from '../rules/room.js';

const toRad = degrees => degrees * Math.PI / 180;

/// 그림이 있으면 그림을, 없으면 도형을 그린다.
/// 이 갈림이 여기 한 곳에만 있어서 그림이 생겨도 게임 쪽은 안 바뀐다.
function drawArtOrShape(ctx, art, images, box, fallback) {
    const image = art && images[art];
    if (!image) { fallback(); return; }

    const spec = ART[art];

    // 가로로만 반복. 조각의 높이를 상자 높이에 맞추고 옆으로 이어 붙인다.
    // 난간처럼 길이는 제각각이어도 두께는 일정한 것에 쓴다.
    if (spec.tile === 'x') {
        ctx.save();
        ctx.beginPath();
        ctx.rect(box.x, box.y, box.w, box.h);
        ctx.clip();
        const step = image.width * (box.h / image.height);
        for (let x = box.x; x < box.x + box.w; x += step) {
            ctx.drawImage(image, x, box.y, step, box.h);
        }
        ctx.restore();
        return;
    }

    // 가로세로로 반복. 벽은 30×720짜리 기둥부터 960×44짜리 띠까지 있어서
    // 한 장을 늘여 그리면 21배로 뭉개진다. 조각의 <b>원래 크기</b>를 유지한 채 채운다.
    if (spec.tile === 'xy') {
        const w = spec.tileWidth ?? image.width;
        const h = spec.tileHeight ?? image.height;
        ctx.save();
        ctx.beginPath();
        ctx.rect(box.x, box.y, box.w, box.h);
        ctx.clip();
        for (let y = box.y; y < box.y + box.h; y += h) {
            for (let x = box.x; x < box.x + box.w; x += w) {
                ctx.drawImage(image, x, y, w, h);
            }
        }
        ctx.restore();
        return;
    }

    // 상자에 맞춰 늘이지 않고 비율을 지킨 채 가운데에 넣는다.
    // 문처럼 세로로 긴 그림을 가로로 넓은 출구 상자에 넣을 때 쓴다 —
    // 늘여 붙이면 문이 옆으로 퍼져 문으로 안 보인다.
    if (spec.fit === 'contain') {
        const scale = Math.min(box.w / image.width, box.h / image.height);
        const w = image.width * scale;
        const h = image.height * scale;
        ctx.drawImage(image, box.x + (box.w - w) / 2, box.y + (box.h - h) / 2, w, h);
        return;
    }

    ctx.drawImage(image, box.x, box.y, box.w, box.h);
}

/// 방 배경. 그림이 있으면 그걸 깔고, 없으면 단색 바닥으로 버틴다.
/// 배경은 960×720 불투명 한 장이라 늘이거나 반복하지 않는다.
function drawFloor(ctx, room, images) {
    const image = room.background && images[room.background];
    if (image) { ctx.drawImage(image, 0, 0, ROOM_WIDTH, ROOM_HEIGHT); return; }

    ctx.fillStyle = COLOR.floor;
    ctx.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
}

function drawProps(ctx, room, images) {
    for (const prop of room.props ?? []) {
        drawArtOrShape(ctx, prop.name, images, prop, () => {
            ctx.fillStyle = COLOR.prop;
            ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
        });
    }
}

function drawExit(ctx, room, images) {
    // 방이 exit.art로 골라 쓸 수 있다. 골목의 옆문은 세로로 길어서
    // 가로로 넓은 문 그림을 늘여 붙이면 찌그러진다.
    drawArtOrShape(ctx, room.exit.art ?? 'exit', images, room.exit, () => {
        ctx.fillStyle = COLOR.exit;
        ctx.fillRect(room.exit.x, room.exit.y, room.exit.w, room.exit.h);
    });
}

function drawCone(ctx, shape, images) {
    ctx.fillStyle = COLOR.cone;
    ctx.strokeStyle = COLOR.coneEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(shape.x, shape.y);
    ctx.arc(shape.x, shape.y, shape.radius,
        toRad(shape.angle - shape.spread / 2), toRad(shape.angle + shape.spread / 2));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 누가 서 있는지는 방 데이터가 정한다. 몸통도 시야도 "지금 도형"의 좌표를
    // 쓰기 때문에, 순찰하는 cone은 여기를 안 고쳐도 알아서 따라 움직인다.
    //
    // <b>사람을 이름으로 받는다.</b> 예전에는 "매니저냐 경비냐" 둘로 갈랐는데,
    // 그러면 사람을 하나 더 그려 넣어도 코드를 고치기 전에는 화면에 못 나온다.
    // 지금은 art.js의 WATCHERS에 한 줄 더하면 그것으로 끝난다.
    const who = WATCHERS.includes(shape.of.art) ? shape.of.art : WATCHERS[0];
    const spec = ART[who];
    const body = { x: shape.x - spec.w / 2, y: shape.y - spec.h, w: spec.w, h: spec.h };

    drawArtOrShape(ctx, who, images, body, () => {
        ctx.fillStyle = COLOR[who];
        ctx.fillRect(body.x, body.y + 18, body.w, body.h - 18);
        ctx.beginPath();
        ctx.arc(shape.x, shape.y - spec.h + 16, 17, 0, Math.PI * 2);
        ctx.fillStyle = COLOR.idolHead;
        ctx.fill();
        ctx.fillStyle = COLOR[`${who}Cap`];
        ctx.fillRect(body.x + 4, body.y, body.w - 8, 12);
    });
}

/// 돌아가는 막대. 판정이 기울어진 사각형이므로 그림도 같은 각도로 돌려 그린다.
/// x·y가 <b>중심</b>인 것이 다른 함정과 다르다.
function drawSpinner(ctx, shape, images) {
    ctx.save();
    ctx.translate(shape.x, shape.y);
    ctx.rotate(toRad(shape.angle));

    const box = { x: -shape.w / 2, y: -shape.h / 2, w: shape.w, h: shape.h };
    drawArtOrShape(ctx, shape.of.art, images, box, () => {
        ctx.fillStyle = COLOR.gate;
        ctx.fillRect(box.x, box.y, box.w, box.h);
        // 차단바처럼 보이게 줄무늬를 넣는다. 도는 것이 한눈에 보인다.
        ctx.fillStyle = COLOR.wall;
        for (let x = box.x; x < box.x + box.w; x += 44) {
            ctx.fillRect(x, box.y, 22, box.h);
        }
    });

    ctx.restore();

    ctx.fillStyle = COLOR.wall;
    ctx.beginPath();
    ctx.arc(shape.x, shape.y, 9, 0, Math.PI * 2);
    ctx.fill();
}

/// 당하고 나서 드러난 숨은 함정. 다른 함정과 다르게 칠해서
/// "아까 그거였구나"가 한눈에 오게 한다.
function markRevealed(ctx, shape) {
    ctx.save();
    ctx.strokeStyle = COLOR.revealedEdge;
    ctx.fillStyle = COLOR.revealed;
    ctx.lineWidth = 3;
    ctx.setLineDash([9, 6]);

    if (shape.kind === 'obb') {
        ctx.translate(shape.x, shape.y);
        ctx.rotate(toRad(shape.angle));
        ctx.fillRect(-shape.w / 2, -shape.h / 2, shape.w, shape.h);
        ctx.strokeRect(-shape.w / 2, -shape.h / 2, shape.w, shape.h);
    } else {
        ctx.fillRect(shape.x, shape.y, shape.w, shape.h);
        ctx.strokeRect(shape.x, shape.y, shape.w, shape.h);
    }

    ctx.restore();
}

function drawHazard(ctx, shape, images, revealed) {
    // 안 보이는 함정. 판정은 살아 있고 그림만 안 그린다 —
    // 게임은 애초에 그림이 있는지도 모르므로 규칙 쪽은 아무 일도 없다.
    const isHidden = shape.of.hidden === true;
    if (isHidden && !revealed) return;

    // 배경 그림에 이미 그려져 있는 것. 판정만 있고 여기서는 안 그린다.
    // 건물 벽처럼 배경이 이미 보여주고 있는 것에 색 사각형을 덧칠하면 배경이 가려진다.
    // hidden과 다른 점은 <b>당해도 드러나지 않는다</b>는 것이다 — 처음부터 보이니까.
    if (shape.of.inBackground) return;

    if (shape.kind === 'sector') { drawCone(ctx, shape, images); return; }
    if (shape.kind === 'obb') { drawSpinner(ctx, shape, images); return; }

    const art = shape.of.art;
    const lit = shape.of.kind === 'blink' ? shape.lethal : true;

    drawArtOrShape(ctx, lit ? art : null, images, shape, () => {
        ctx.fillStyle = art === 'sensor' ? (lit ? COLOR.sensor : COLOR.sensorOff)
            : art === 'lamp' ? (lit ? COLOR.lamp : COLOR.lampOff)
                : art === 'cart' ? COLOR.cart
                    : art === 'rail' ? COLOR.rail
                        : COLOR.wall;
        ctx.fillRect(shape.x, shape.y, shape.w, shape.h);
    });

    if (isHidden) markRevealed(ctx, shape);
}

/// frameArt는 지금 그릴 걷기 프레임의 이름이다. 없으면 서 있는 그림으로 돌아간다 —
/// 걷기 4장 중 한 장만 빠져도 그 순간 주인공이 사라지면 안 되기 때문이다.
function drawPlayer(ctx, state, images, frameArt) {
    const spec = ART.idol;
    const body = { x: state.x - spec.w / 2, y: state.y - spec.h + 10, w: spec.w, h: spec.h };
    const art = (frameArt && images[frameArt]) ? frameArt : 'idol';

    drawArtOrShape(ctx, art, images, body, () => {
        ctx.fillStyle = COLOR.idol;
        ctx.fillRect(body.x + 6, body.y + 26, body.w - 12, body.h - 26);
        ctx.beginPath();
        ctx.arc(state.x, body.y + 20, 16, 0, Math.PI * 2);
        ctx.fillStyle = COLOR.idolHead;
        ctx.fill();
    });
}

/// H를 누르면 나오는 판정 표시. 방을 짤 때 쓴다.
/// <b>숨은 함정도 여기서는 다 보인다.</b> 안 그러면 방을 짜면서 어디에 놨는지 알 수 없다.
function drawHitboxes(ctx, state) {
    ctx.strokeStyle = COLOR.hitbox;
    ctx.lineWidth = 2;

    for (const shape of state.shapes) {
        if (!shape.lethal) continue;

        if (shape.kind === 'obb') {
            ctx.save();
            ctx.translate(shape.x, shape.y);
            ctx.rotate(toRad(shape.angle));
            ctx.strokeRect(-shape.w / 2, -shape.h / 2, shape.w, shape.h);
            ctx.restore();
            continue;
        }

        ctx.beginPath();
        if (shape.kind === 'rect') {
            ctx.rect(shape.x, shape.y, shape.w, shape.h);
        } else {
            ctx.moveTo(shape.x, shape.y);
            ctx.arc(shape.x, shape.y, shape.radius,
                toRad(shape.angle - shape.spread / 2), toRad(shape.angle + shape.spread / 2));
            ctx.closePath();
        }
        ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(state.x, state.y, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
}

/// 방 한 장면을 그린다.
///
/// 넷째 인자부터는 <b>화면 사정</b>이라 이름을 달아 묶는다. 자리로 받으면
/// drawRoom(ctx, room, state, images, true, set, null, false)처럼 되어
/// 마지막 false가 무엇인지 부르는 쪽에서 알 수 없게 된다.
///
///   revealed     이 방에서 나를 이미 한 번 들키게 한 함정들의 번호.
///                기억은 진행층이 든다 — 함정에 상태를 들리면 되감기가 안 된다
///   playerFrame  지금 그릴 걷기 프레임. 없으면 서 있는 그림
///   showPlayer   주인공을 그리는가. 방을 짤 때 <b>끄고 볼 수 있어야 한다</b> —
///                주인공이 함정 위에 겹쳐 서 있으면 그 함정을 못 본다
export function drawRoom(ctx, room, state, images, {
    showHitboxes = false,
    revealed = new Set(),
    playerFrame = null,
    showPlayer = true,
} = {}) {
    drawFloor(ctx, room, images);
    drawProps(ctx, room, images);
    drawExit(ctx, room, images);

    state.shapes.forEach((shape, index) => drawHazard(ctx, shape, images, revealed.has(index)));

    if (showPlayer) drawPlayer(ctx, state, images, playerFrame);
    if (showHitboxes) drawHitboxes(ctx, state);
}

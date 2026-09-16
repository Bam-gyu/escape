import { ART } from './art.js';
import { COLOR } from './palette.js';
import { ROOM_WIDTH, ROOM_HEIGHT, PLAYER_RADIUS } from '../rules/room.js';

const toRad = degrees => degrees * Math.PI / 180;

/// 그림이 있으면 그림을, 없으면 도형을 그린다.
/// 이 갈림이 여기 한 곳에만 있어서 그림이 생겨도 게임 쪽은 안 바뀐다.
function drawArtOrShape(ctx, art, images, box, fallback) {
    const image = art && images[art];
    if (!image) { fallback(); return; }

    const spec = ART[art];
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
    ctx.drawImage(image, box.x, box.y, box.w, box.h);
}

function drawFloor(ctx) {
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
    drawArtOrShape(ctx, 'exit', images, room.exit, () => {
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

    const spec = ART.guard;
    const body = { x: shape.x - spec.w / 2, y: shape.y - spec.h, w: spec.w, h: spec.h };
    drawArtOrShape(ctx, 'guard', images, body, () => {
        ctx.fillStyle = COLOR.guard;
        ctx.fillRect(body.x, body.y + 18, body.w, body.h - 18);
        ctx.beginPath();
        ctx.arc(shape.x, shape.y - spec.h + 16, 17, 0, Math.PI * 2);
        ctx.fillStyle = COLOR.playerHead;
        ctx.fill();
        ctx.fillStyle = COLOR.guardCap;
        ctx.fillRect(body.x + 4, body.y, body.w - 8, 12);
    });
}

function drawHazard(ctx, shape, images) {
    if (shape.kind === 'sector') { drawCone(ctx, shape, images); return; }

    const art = shape.of.art;
    const lit = shape.of.kind === 'blink' ? shape.lethal : true;

    drawArtOrShape(ctx, lit ? art : null, images, shape, () => {
        ctx.fillStyle = art === 'spark' ? (lit ? COLOR.spark : COLOR.sparkOff)
            : art === 'bar' ? COLOR.bar
                : COLOR.wall;
        ctx.fillRect(shape.x, shape.y, shape.w, shape.h);
    });
}

function drawPlayer(ctx, state, images) {
    const spec = ART.player;
    const body = { x: state.x - spec.w / 2, y: state.y - spec.h + 10, w: spec.w, h: spec.h };

    drawArtOrShape(ctx, 'player', images, body, () => {
        ctx.fillStyle = COLOR.player;
        ctx.fillRect(body.x + 6, body.y + 26, body.w - 12, body.h - 26);
        ctx.beginPath();
        ctx.arc(state.x, body.y + 20, 16, 0, Math.PI * 2);
        ctx.fillStyle = COLOR.playerHead;
        ctx.fill();
    });
}

/// H를 누르면 나오는 판정 표시. 방을 짤 때 쓴다.
function drawHitboxes(ctx, state) {
    ctx.strokeStyle = COLOR.hitbox;
    ctx.lineWidth = 2;

    for (const shape of state.shapes) {
        if (!shape.lethal) continue;
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

export function drawRoom(ctx, room, state, images, showHitboxes) {
    drawFloor(ctx);
    drawProps(ctx, room, images);
    drawExit(ctx, room, images);

    for (const shape of state.shapes) drawHazard(ctx, shape, images);

    drawPlayer(ctx, state, images);
    if (showHitboxes) drawHitboxes(ctx, state);
}

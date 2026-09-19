// png에서 <b>투명하지 않은 부분이 어디인가</b>만 읽는다. 검사에서만 쓴다.
//
// 그림 라이브러리를 들이지 않으려고 직접 푼다. 이 프로젝트는 의존성이 없고,
// 사람 그림의 발이 바닥에 닿았는지 보자고 그걸 깨뜨릴 이유가 없다.
// zlib은 node에 들어 있다.

import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

/// png 덩이들을 차례로 훑는다. 크기(IHDR)와 그림 데이터(IDAT)만 쓴다.
function chunks(buffer) {
    const found = { idat: [] };
    let at = 8; // 파일 앞머리 8바이트를 건너뛴다

    while (at < buffer.length) {
        const length = buffer.readUInt32BE(at);
        const type = buffer.toString('ascii', at + 4, at + 8);
        const body = buffer.subarray(at + 8, at + 8 + length);

        if (type === 'IHDR') {
            found.width = body.readUInt32BE(0);
            found.height = body.readUInt32BE(4);
            found.depth = body[8];
            found.colorType = body[9];
            found.interlace = body[12];
        }
        if (type === 'IDAT') found.idat.push(body);
        if (type === 'IEND') break;

        at += length + 12; // 길이 4 + 이름 4 + 몸통 + 검사합 4
    }
    return found;
}

/// png의 줄마다 붙은 필터를 되돌린다. 이걸 안 풀면 픽셀값이 아니라
/// "윗줄과의 차이"를 읽게 되어 엉뚱한 곳이 투명해 보인다.
function unfilter(raw, width, height, bytesPerPixel) {
    const stride = width * bytesPerPixel;
    const out = Buffer.alloc(stride * height);

    for (let y = 0; y < height; y++) {
        const filter = raw[y * (stride + 1)];
        const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));

        for (let i = 0; i < stride; i++) {
            const a = i >= bytesPerPixel ? out[y * stride + i - bytesPerPixel] : 0;
            const b = y > 0 ? out[(y - 1) * stride + i] : 0;
            const c = (y > 0 && i >= bytesPerPixel) ? out[(y - 1) * stride + i - bytesPerPixel] : 0;

            let value = line[i];
            if (filter === 1) value += a;
            else if (filter === 2) value += b;
            else if (filter === 3) value += (a + b) >> 1;
            else if (filter === 4) {
                // Paeth: 왼쪽·위·왼쪽위 중 예측에 가장 가까운 것
                const p = a + b - c;
                const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
                value += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
            }
            out[y * stride + i] = value & 0xff;
        }
    }
    return out;
}

/// 투명하지 않은 픽셀을 감싸는 상자. 그림이 통째로 투명하면 null.
///
/// 8비트 RGBA(colorType 6)만 다룬다. 사람 그림은 그렇게 내보내기로 되어 있고,
/// 아니면 조용히 넘어가지 않고 터뜨린다 — 검사가 아무 말 없이 통과해버리면
/// 발이 떠 있어도 아무도 모른다.
export function opaqueBox(path) {
    const png = chunks(readFileSync(path));

    if (png.colorType !== 6 || png.depth !== 8 || png.interlace !== 0) {
        throw new Error(`${path}: 8비트 RGBA(colorType 6, 비월주사 아님)로 내보내라 `
            + `— 지금은 depth ${png.depth}, colorType ${png.colorType}, interlace ${png.interlace}`);
    }

    const pixels = unfilter(inflateSync(Buffer.concat(png.idat)), png.width, png.height, 4);

    let left = png.width, right = -1, top = png.height, bottom = -1;
    for (let y = 0; y < png.height; y++) {
        for (let x = 0; x < png.width; x++) {
            if (pixels[(y * png.width + x) * 4 + 3] === 0) continue;
            if (x < left) left = x;
            if (x > right) right = x;
            if (y < top) top = y;
            if (y > bottom) bottom = y;
        }
    }

    if (right === -1) return null;
    return { left, top, right, bottom, width: png.width, height: png.height };
}

// 올릴 것만 골라 dist/에 담는다.
//
// 만드는 도구가 없는 프로젝트라 <b>고치거나 합치는 일은 안 한다.</b> 그냥 베낀다.
// 베끼는 목록을 손으로 적어두는 것이 핵심이다 — "빼고 싶은 것"을 적으면
// 새 폴더가 생길 때마다 조용히 딸려 올라간다.
//
//   npm run build     dist/를 새로 만든다
//
// dist/ 통째로 올리면 끝이다. 서버 쪽 설정도, 빌드 단계도 필요 없다.

import { cp, mkdir, rm, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'dist');

/// 올라가는 것. <b>여기 없는 것은 안 올라간다.</b>
///
/// tools/ test/ docs/ 는 뺀다 — 게임이 안 쓴다.
/// src/editor/는 넣는다. 37KB뿐이고, 빼면 localhost에서 dist를 열어 확인할 때
/// H가 터진다. 어차피 배포본에서는 localhost가 아니라 열리지도 않는다.
const SHIPPED = ['index.html', 'src', 'art', 'audio'];

async function sizeOf(path) {
    const info = await stat(path);
    if (!info.isDirectory()) return info.size;

    let total = 0;
    for (const name of await readdir(path)) total += await sizeOf(join(path, name));
    return total;
}

const mb = bytes => `${(bytes / 1024 / 1024).toFixed(1)}MB`;

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

let total = 0;
for (const name of SHIPPED) {
    await cp(join(ROOT, name), join(OUT, name), { recursive: true });
    const size = await sizeOf(join(OUT, name));
    total += size;
    console.log(`  ${name.padEnd(12)} ${mb(size).padStart(8)}`);
}

console.log(`  ${'─'.repeat(21)}`);
console.log(`  ${'합계'.padEnd(11)} ${mb(total).padStart(8)}`);
console.log(`\ndist/ 를 통째로 올리면 된다. 서버 설정도 빌드 단계도 필요 없다.`);

// 처음 화면에 필요한 것이 얼마나 되는지 따로 말해준다.
// 이게 곧 "게임이 뜨기까지 기다리는 시간"이다.
const first = await sizeOf(join(OUT, 'audio', 'title-bgm.mp3'))
    + await sizeOf(join(OUT, 'art', 'open-light-on.png'))
    + await sizeOf(join(OUT, 'art', 'open-light-off.png'));
console.log(`타이틀 화면까지 필요한 것만 ${mb(first)}. 나머지는 하면서 받는다.`);

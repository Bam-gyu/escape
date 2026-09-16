// 그림 목록. <b>여기가 그림을 갈아끼우는 자리다.</b>
//
// art/ 폴더에 아래 이름의 png를 넣으면 그때부터 그 그림이 나온다.
// 파일이 없으면 색 도형으로 대신 그린다 — 그림을 기다리며 멈추지 않는다.
//
//   tile: 'x'   가로로 반복해서 채운다 (철창처럼 같은 조각이 이어지는 것)
//   anchor: 'feet'  그림의 발밑이 기준점에 오게 놓는다 (사람)

export const ART = {
    player: { src: 'art/player.png', w: 44, h: 62, anchor: 'feet' },
    guard: { src: 'art/guard.png', w: 48, h: 68, anchor: 'feet' },
    wall: { src: 'art/wall.png', tile: 'xy' },
    fence: { src: 'art/fence.png', tile: 'x' },
    bar: { src: 'art/bar.png', tile: 'x' },
    spark: { src: 'art/spark.png' },
    exit: { src: 'art/exit.png' },
    muscle: { src: 'art/muscle.png' },
    drain: { src: 'art/drain.png' },
    toilet: { src: 'art/toilet.png' },
    bed: { src: 'art/bed.png' },
    desk: { src: 'art/desk.png' },
};

/// 있는 그림만 불러온다. 없는 것은 null로 남고, 그리는 쪽이 도형으로 대신한다.
export function loadArt() {
    const loaded = {};
    for (const name of Object.keys(ART)) {
        const image = new Image();
        image.onload = () => { loaded[name] = image; };
        image.onerror = () => { };
        image.src = ART[name].src;
    }
    return loaded;
}

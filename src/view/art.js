// 그림 목록. <b>여기가 그림을 갈아끼우는 자리다.</b>
//
// art/ 폴더에 아래 이름의 png를 넣으면 그때부터 그 그림이 나온다.
// 파일이 없으면 색 도형으로 대신 그린다 — 그림을 기다리며 멈추지 않는다.
// 없는 png만큼 콘솔에 404가 뜬다. 고장이 아니다.
//
//   tile: 'x'   가로로 반복해서 채운다. 조각 높이를 상자 높이에 맞춘다 (난간)
//   tile: 'xy'  가로세로로 반복해서 채운다. tileWidth·tileHeight 크기를 지킨다 (벽)
//   anchor: 'feet'  그림의 발밑이 기준점에 오게 놓는다 (사람)
//   spin: true  판정 각도에 맞춰 돌려 그린다 (차단바)
//   fit: 'contain'  상자에 늘이지 않고 비율을 지킨 채 가운데 넣는다 (문)
//
// 자세한 준비법은 docs/art-guide.md 에 있다.

export const ART = {
    // 사람
    idol: { src: 'art/idol.png', w: 44, h: 62, anchor: 'feet' },
    idolWalk1: { src: 'art/idol-walk/idol-walk-01.png', w: 44, h: 62, anchor: 'feet' },
    idolWalk2: { src: 'art/idol-walk/idol-walk-02.png', w: 44, h: 62, anchor: 'feet' },
    idolWalk3: { src: 'art/idol-walk/idol-walk-03.png', w: 44, h: 62, anchor: 'feet' },
    idolWalk4: { src: 'art/idol-walk/idol-walk-04.png', w: 44, h: 62, anchor: 'feet' },
    manager: { src: 'art/manager.png', w: 48, h: 68, anchor: 'feet' },
    guard: { src: 'art/guard.png', w: 48, h: 68, anchor: 'feet' },

    // 함정
    wall: { src: 'art/wall.png', tile: 'xy', tileWidth: 120, tileHeight: 120 },
    rail: { src: 'art/rail.png', tile: 'x' },
    cart: { src: 'art/cart.png' },
    sensor: { src: 'art/sensor.png' },
    lamp: { src: 'art/lamp.png', tile: 'x' },
    gate: { src: 'art/gate.png', spin: true },
    crack: { src: 'art/crack.png' },
    exit: { src: 'art/exit.png' },
    exitSide: { src: 'art/exitSide.png', fit: 'contain' },

    // 음식 미끼 — 맛있어 보이지만 닿으면 붙잡힌다. 마지막 방에만 있다
    tteokbokki: { src: 'art/tteokbokki.png' },
    chicken: { src: 'art/chicken.png' },
    ramen: { src: 'art/ramen.png' },

    // 오프닝 연출 — 960×720 한 장씩. 불을 끄고 방에서 몰래 나간다
    openLightOn: { src: 'art/open-light-on.png' },
    openLightOff: { src: 'art/open-light-off.png' },

    // 엔딩 — 간식을 먹고 잠들었다
    endNap: { src: 'art/end-nap.png' },

    // 방 배경 — 960×720 한 장. 방 데이터의 background에 이름을 적는다
    bgRoom: { src: 'art/bg-room.png' },
    bgLiving: { src: 'art/bg-living.png' },
    bgDorm: { src: 'art/bg-dorm.png' },
    bgGym: { src: 'art/bg-gym.png' },
    bgStreet: { src: 'art/bg-street.png' },
    bgStore: { src: 'art/bg-store.png' },

    // 소품 — 판정이 없다. 게임은 이 목록을 아예 안 본다
    sofa: { src: 'art/sofa.png' },
    vending: { src: 'art/vending.png' },
    plant: { src: 'art/plant.png' },
    locker: { src: 'art/locker.png' },
    shoes: { src: 'art/shoes.png' },
    car: { src: 'art/car.png' },
    trash: { src: 'art/trash.png' },
    sign: { src: 'art/sign.png' },
};

/// 걷기 한 바퀴. <b>움직일 때만 돌린다</b> — 멈췄는데 발을 구르면
/// 제자리걸음처럼 보이고, 커서를 따라가는 게임에서 그건 거짓말이다.
export const IDOL_WALK = ['idolWalk1', 'idolWalk2', 'idolWalk3', 'idolWalk4'];

/// 한 프레임이 머무는 시간(초). 네 장이면 한 바퀴에 0.56초다.
export const WALK_FRAME_SECONDS = 0.14;

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

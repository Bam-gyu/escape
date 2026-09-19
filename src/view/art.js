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
    // 감시하는 사람 넷. <b>시야(cone)를 달고 다니는 것이 이들이다.</b>
    // 넷인 것은 방마다 다른 얼굴이 나오게 하려는 것이다 — 여섯 방에서 같은 사람만
    // 나오면 "또 저 사람"이 되어 방이 다 같아 보인다.
    //
    // 파일이 없으면 색 도형으로 나온다. 넷이 서로 다른 색이라 그 상태로도 구별된다.
    //
    // 36×68인 것은 원본이 72×136이기 때문이다. 딱 절반이다.
    // <b>그림 비율을 지켜야 한다</b> — 상자에 맞춰 늘이는 방식이라 48을 주면
    // 33%만큼 옆으로 퍼진 사람이 나온다. 작게 나오는 그림이라 티가 안 나서 더 나쁘다.
    watch1: { src: 'art/watch-1.png', w: 36, h: 68, anchor: 'feet' },
    watch2: { src: 'art/watch-2.png', w: 36, h: 68, anchor: 'feet' },
    watch3: { src: 'art/watch-3.png', w: 36, h: 68, anchor: 'feet' },
    watch4: { src: 'art/watch-4.png', w: 36, h: 68, anchor: 'feet' },

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

    // 음식 미끼 — 맛있어 보이지만 닿으면 붙잡힌다. 편의점에만 있다.
    //
    // w·h는 <b>편집기가 끌어다 놓을 때 쓰는 크기</b>다. 방에 이미 놓인 것의
    // 크기는 rooms.js가 들고 있어서 여기를 고쳐도 안 바뀐다.
    // 그림 비율 그대로 적는다 — 안 그러면 놓자마자 찌그러진 음식이 나온다.
    tteokbokki: { src: 'art/tteokbokki.png', w: 120, h: 96 },
    chicken: { src: 'art/chicken.png', w: 126, h: 98 },
    ramen: { src: 'art/ramen.png', w: 84, h: 96 },
    icecream: { src: 'art/icecream.png', w: 120, h: 96 },

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

/// 시야를 들 수 있는 사람들. <b>`cone`이 그릴 줄 아는 것이 이 목록이다.</b>
/// 여기 없는 이름을 방 데이터에 적으면 첫 사람으로 대신 그린다.
export const WATCHERS = ['watch1', 'watch2', 'watch3', 'watch4'];

/// 화면에 보여줄 이름. 편집기의 서랍에 이걸로 적힌다 —
/// `watch2`보다 `감시2`가 무엇인지 바로 안다.
export const ART_LABEL = {
    watch1: '감시1', watch2: '감시2', watch3: '감시3', watch4: '감시4',
    cart: '카트', gate: '차단바', sensor: '센서', lamp: '복도등',
    rail: '난간', wall: '벽', crack: '갈라진 곳',
    tteokbokki: '떡볶이', chicken: '치킨', ramen: '라면', icecream: '아이스크림',
    sofa: '소파', vending: '자판기', plant: '화분', locker: '사물함',
    shoes: '신발', car: '차', trash: '쓰레기통', sign: '간판',
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

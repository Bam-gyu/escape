// 방 하나 = 아래 덩이 하나. 코드는 안 건드린다.
//
//   name        화면에 뜨는 이름
//   background  배경 그림 이름 (src/view/art.js). 없으면 단색 바닥
//   spawn       아이돌 둘이 시작하는 자리
//   exit        여기 닿으면 다음 구역 {x, y, w, h}. art로 문 그림을 고를 수 있다
//   hazards     닿으면 들키는 것들
//   props       판정이 없는 장식. 게임은 이 목록을 아예 안 본다
//
// 함정 다섯 가지:
//   rect     {x, y, w, h}                          가만히 있는 것 (벽, 난간, 음식 미끼)
//   blink    위 + {period, on}                     period마다 on초 동안만 죽는다 (센서, 복도등)
//   mover    위 + {dx, dy, period, offset}         제자리에서 dx·dy만큼 왕복한다 (청소 카트)
//   spinner  {x, y, length, thickness, period, offset, from}
//            x·y를 축으로 도는 막대. period초에 한 바퀴, 음수면 반대로 (차단바)
//   cone     {x, y, radius, spread, from, to, period, offset}
//            매니저·경비의 시야. 각도는 0이 오른쪽, 90이 아래쪽이다.
//            + {dx, dy, walkPeriod, walkOffset} 을 주면 시야를 든 채 왕복한다
//
// travel: { dx, dy, duration, gap, offset, loop }
//   <b>종류를 안 가린다.</b> 어떤 함정에든 얹으면 그만큼 한 방향으로 흘러간다.
//   다 가면 사라지고(안 죽인다, 안 그린다) gap초 뒤 처음 자리에서 다시 나온다.
//   loop를 빼면 한 번 가고 끝이다. mover와 달리 왕복하지 않는다 —
//   도로를 지나가는 차는 끝에서 되돌아오지 않는다.
//   화면 밖에서 들어오게 하려면 x를 음수로 두고 dx를 960보다 크게 준다.
//
// offset은 초 단위로 시작 시점을 밀어 함정끼리 박자를 어긋나게 할 때 쓴다.
// cone의 walkPeriod는 걷는 주기다. 안 주면 보는 주기와 같아지는데, 같으면
// "오른쪽으로 갈 때는 늘 오른쪽을 본다"가 되어 안전한 쪽이 고정된다. 따로 주는 게 낫다.
//
// hidden: true        그림을 안 그린다. 판정은 그대로. 한 번 당하면 그 방에서는 드러난다.
//                     <b>마지막 방에만 둔다</b> — 검사가 본다
// inBackground: true  배경 그림에 이미 그려져 있다. 판정만 있고 안 그린다.
//                     건물 벽처럼 배경이 보여주는 것에 쓴다. 당해도 드러나지 않는다
//
// ── 여정 ──
// 헬스장에서 빠져나와 편의점에서 간식을 사고, 들키지 않고 방으로 돌아간다.
//   헬스장 → 헬스장 외부 → 편의점 → 숙소 외부 → 숙소 거실 → 주인공 방
//
// 방마다 장치를 하나씩만 새로 소개한다.
// 음식 미끼는 편의점에만, 안 보이는 함정은 마지막 방에만 있다.

export const ROOMS = [
    {
        note: [
            '첫 방. 시야 하나만 배운다. 다른 함정은 벽뿐이다.',
            '출구가 처음부터 오른쪽에 있어서 "위로 가면 된다"는 습관이 안 생긴다.',
        ],
        name: '헬스장',
        background: 'bgGym',
        spawn: { x: 480, y: 650 },
        exit: { x: 354, y: 64, w: 250, h: 105, art: 'exitSide' },
        hazards: [
            { kind: 'rect', x: -1, y: -35, w: 960, h: 159, inBackground: true },
            { kind: 'cone', x: 553, y: 228, radius: 200, spread: 55, from: 55, to: 125, period: 2, dx: 30, walkPeriod: 1.6, art: 'watch3' },
            { kind: 'rect', x: 718, y: 97, w: 110, h: 80, art: 'vending' },
            { kind: 'rect', x: 13, y: 400, w: 110, h: 80, art: 'rail' },
            { kind: 'rect', x: 233, y: 400, w: 110, h: 80, art: 'rail' },
            { kind: 'rect', x: 123, y: 400, w: 110, h: 80, art: 'rail' },
            { kind: 'rect', x: 343, y: 400, w: 110, h: 80, art: 'rail' },
            { kind: 'rect', x: 840, y: 400, w: 110, h: 80, art: 'rail' },
            { kind: 'rect', x: 730, y: 400, w: 110, h: 80, art: 'rail' },
            { kind: 'rect', x: 620, y: 400, w: 110, h: 80, art: 'rail' },
            { kind: 'rect', x: 836, y: 173, w: 60, h: 48, art: 'icecream' },
            { kind: 'rect', x: 175, y: 94, w: 110, h: 80, art: 'shoes' },
        ],
        props: [
            { name: 'plant', x: 16, y: 144, w: 85, h: 85 },
        ],
    },
    {
        note: [
            '오가는 청소 카트를 배운다.',
            '',
            '도로를 가로지르는 차도 여기서 처음 나온다. 왕복하는 카트와 달리',
            '한 방향으로 지나가 사라졌다가 잠시 뒤 다시 온다 — 건널목의 박자다.',
        ],
        name: '헬스장 외부',
        background: 'bgStreet',
        spawn: { x: 479, y: 194 },
        exit: { x: 960, y: 130, w: 92, h: 500, art: 'exitSide' },
        hazards: [
            { kind: 'rect', x: 5, y: -36, w: 950, h: 192, inBackground: true },
            { kind: 'rect', x: -161, y: 457, w: 150, h: 80, travel: { dx: 1300, dy: 0, duration: 2.5, gap: 1, loop: true }, art: 'car' },
            { kind: 'cone', x: 623, y: 191, radius: 160, spread: 46, from: 55, to: 125, period: 3.4, dx: 100, dy: 50, art: 'watch1' },
            { kind: 'rect', x: -3, y: 701, w: 1000, h: 20, art: 'wall', inBackground: true },
            { kind: 'rect', x: -108, y: -24, w: 110, h: 800, art: 'wall', inBackground: true },
            { kind: 'rect', x: 958, y: 275, w: 110, h: 80, travel: { dx: -1050, dy: 0, duration: 2, gap: 1, loop: true }, art: 'car', flip: true },
            { kind: 'cone', x: 16, y: 406, radius: 160, spread: 46, from: 55, to: 125, period: 3.4, travel: { dx: 1200, dy: 0, duration: 1.5, gap: 0, offset: 4, loop: false }, art: 'watch3' },
        ],
        props: [
            { name: 'trash', x: 10, y: 142, w: 90, h: 80 },
        ],
    },
    {
        note: [
            '목적지. 음식 미끼가 여기에만 있다.',
            '',
            '맛있어 보이지만 닿으면 붙잡힌다. 간식을 사러 온 사람이 간식에 혹해',
            '붙잡힌다는 것이 이 게임 설정과 맞는 농담이다. 새 함정 종류를 만들지',
            '않았다 — 그냥 rect에 음식 그림을 얹은 것이다.',
        ],
        name: '편의점',
        background: 'bgStore',
        spawn: { x: 480, y: 650 },
        exit: { x: 406, y: 158, w: 150, h: 52, inBackground: true },
        hazards: [
            { kind: 'rect', x: -32, y: -28, w: 434, h: 232, inBackground: true },
            { kind: 'rect', x: 559, y: -28, w: 434, h: 232, inBackground: true },
            { kind: 'cone', x: 667, y: 237, radius: 170, spread: 55, from: 105, to: 165, period: 2, dx: 25, dy: 15, offset: 0.7, art: 'watch3' },
            { kind: 'cone', x: 348, y: 243, radius: 160, spread: 55, from: 55, to: 125, period: 2.5, dx: 30, dy: 10, art: 'watch1' },
            { kind: 'rect', x: 921, y: -31, w: 110, h: 1000, art: 'wall', inBackground: true },
            { kind: 'rect', x: -72, y: -53, w: 110, h: 1000, art: 'wall', inBackground: true },
            { kind: 'rect', x: -19, y: 282, w: 60, h: 48, travel: { dx: 1200, dy: 0, duration: 1.5, gap: 0, loop: true }, art: 'icecream' },
            { kind: 'rect', x: 562, y: 149, w: 84, h: 96, art: 'ramen' },
            { kind: 'rect', x: 100, y: 176, w: 126, h: 98, art: 'chicken' },
            { kind: 'spinner', x: 481, y: 473, length: 200, thickness: 20, period: 2.5, art: 'gate' },
        ],
    },
    {
        note: ['돌아가는 차단바를 배운다. 숙소 주차장 입구의 그것이다.'],
        name: '숙소 외부',
        background: 'bgDorm',
        spawn: { x: 480, y: 650 },
        exit: { x: 402, y: 105, w: 150, h: 50, art: 'exitSide', inBackground: true },
        hazards: [
            { kind: 'rect', x: -37, y: -65, w: 432, h: 212, inBackground: true },
            { kind: 'rect', x: 558, y: -59, w: 432, h: 212, inBackground: true },
            { kind: 'cone', x: 4, y: 360, radius: 160, spread: 46, from: 55, to: 125, period: 3.4, travel: { dx: 1200, dy: 0, duration: 1.5, gap: 0, loop: false }, art: 'watch3' },
            { kind: 'cone', x: 377, y: 213, radius: 160, spread: 80, from: 55, to: 125, period: 2, dx: 200, art: 'watch1' },
            { kind: 'rect', x: 940, y: -6, w: 110, h: 1000, art: 'wall', inBackground: true },
            { kind: 'rect', x: -91, y: -18, w: 110, h: 1000, art: 'wall', inBackground: true },
            { kind: 'rect', x: 626, y: 108, w: 110, h: 80, art: 'vending' },
        ],
    },
    {
        note: [
            '센서와 순찰을 함께 배운다. 문은 왼쪽 위다.',
            '걷는 주기와 보는 주기를 일부러 어긋나게 둬서 안전한 쪽이 고정되지 않는다.',
        ],
        name: '숙소 거실',
        background: 'bgLiving',
        spawn: { x: 87, y: 170 },
        exit: { x: 711, y: 701, w: 250, h: 60, art: 'exitSide', inBackground: true },
        hazards: [
            { kind: 'rect', x: 5, y: -40, w: 950, h: 166, inBackground: true },
            { kind: 'rect', x: 746, y: 45, w: 105, h: 84, art: 'tteokbokki' },
            { kind: 'rect', x: 825, y: 180, w: 126, h: 98, art: 'chicken' },
            { kind: 'rect', x: 5, y: 703, w: 700, h: 80, art: 'wall', inBackground: true },
            { kind: 'cone', x: 786, y: 513, radius: 170, spread: 60, from: 55, to: 125, period: 1, art: 'watch2' },
            { kind: 'rect', x: 718, y: 36, w: 84, h: 96, art: 'ramen' },
            { kind: 'cone', x: 341, y: 256, radius: 200, spread: 60, from: 55, to: 125, period: 2.5, art: 'watch4' },
        ],
    },
    {
        note: [
            '마지막. 다 왔는데 여기서 들킨다. 전부 나오고, 안 보이는 함정도 여기에만 있다.',
            '',
            '숨은 것 둘은 시작 자리에서 멀리 둔다. 들어서자마자 당하면',
            '뭘 잘못했는지 알 수 없는 죽음이 된다. 목록 끝의 hidden 둘이 그것이다.',
        ],
        name: '주인공 방',
        background: 'bgRoom',
        spawn: { x: 98, y: 657 },
        exit: { x: 678, y: 185, w: 250, h: 52, art: 'exitSide', inBackground: true },
        hazards: [
            { kind: 'rect', x: 0, y: 0, w: 960, h: 150, inBackground: true },
            { kind: 'cone', x: 480, y: 205, radius: 190, spread: 46, from: 55, to: 125, period: 3, dx: 220, walkPeriod: 5.6, art: 'watch4' },
            { kind: 'cone', x: 555, y: 431, radius: 200, spread: 60, from: 55, to: 125, period: 1.5, dx: 200, walkPeriod: 2, art: 'watch1' },
            { kind: 'rect', x: 800, y: 110, w: 120, h: 96, art: 'icecream' },
            { kind: 'rect', x: 739, y: 121, w: 105, h: 84, art: 'tteokbokki' },
            { kind: 'rect', x: 857, y: 287, w: 110, h: 80, art: 'rail' },
            { kind: 'rect', x: 747, y: 286, w: 110, h: 80, art: 'rail' },
        ],
        props: [
            { name: 'vending', x: 75, y: 79, w: 110, h: 90 },
        ],
    },
];

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
        exit: { x: 890, y: 535, w: 60, h: 105, art: 'exitSide' },
        hazards: [
            { kind: 'rect', x: 0, y: 0, w: 960, h: 159, inBackground: true },
            { kind: 'cone', x: 430, y: 235, radius: 200, spread: 46, from: 55, to: 125, period: 3.6, art: 'watch1' },
        ],
        props: [
            { name: 'plant', x: 70, y: 200, w: 85, h: 85 },
        ],
    },
    {
        note: ['오가는 청소 카트를 배운다.'],
        name: '헬스장 외부',
        background: 'bgStreet',
        spawn: { x: 480, y: 650 },
        exit: { x: 434, y: 105, w: 92, h: 55, art: 'exitSide' },
        hazards: [
            { kind: 'rect', x: 0, y: 0, w: 434, h: 192, inBackground: true },
            { kind: 'rect', x: 526, y: 0, w: 434, h: 192, inBackground: true },
            { kind: 'mover', x: 250, y: 560, w: 140, h: 34, period: 4.4, dx: 300, art: 'cart' },
            { kind: 'cone', x: 745, y: 300, radius: 165, spread: 48, from: 105, to: 165, period: 3.4, art: 'watch2' },
        ],
        props: [
            { name: 'trash', x: 70, y: 560, w: 90, h: 80 },
            { name: 'sign', x: 800, y: 560, w: 110, h: 55 },
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
        exit: { x: 434, y: 115, w: 92, h: 52 },
        hazards: [
            { kind: 'rect', x: 0, y: 0, w: 434, h: 232, inBackground: true },
            { kind: 'rect', x: 526, y: 0, w: 434, h: 232, inBackground: true },
            { kind: 'rect', x: 225, y: 470, w: 120, h: 96, art: 'tteokbokki' },
            { kind: 'rect', x: 620, y: 465, w: 120, h: 96, art: 'chicken' },
            { kind: 'rect', x: 290, y: 320, w: 84, h: 104, art: 'ramen' },
            { kind: 'cone', x: 245, y: 300, radius: 155, spread: 48, from: 15, to: 75, period: 3.2, art: 'watch2' },
            { kind: 'cone', x: 715, y: 305, radius: 155, spread: 48, from: 105, to: 165, period: 2.8, offset: 0.7, art: 'watch3' },
        ],
        props: [
            { name: 'trash', x: 830, y: 600, w: 90, h: 80 },
            { name: 'sign', x: 60, y: 600, w: 110, h: 55 },
        ],
    },
    {
        note: ['돌아가는 차단바를 배운다. 숙소 주차장 입구의 그것이다.'],
        name: '숙소 외부',
        background: 'bgDorm',
        spawn: { x: 480, y: 650 },
        exit: { x: 432, y: 110, w: 96, h: 50, art: 'exitSide' },
        hazards: [
            { kind: 'rect', x: 0, y: 0, w: 432, h: 212, inBackground: true },
            { kind: 'rect', x: 528, y: 0, w: 432, h: 212, inBackground: true },
            { kind: 'spinner', x: 480, y: 400, length: 300, thickness: 22, period: 5, art: 'gate' },
            { kind: 'mover', x: 150, y: 545, w: 140, h: 34, period: 5.4, dx: 430, offset: 0.8, art: 'cart' },
            { kind: 'cone', x: 215, y: 265, radius: 150, spread: 48, from: 35, to: 95, period: 3.4, art: 'watch2' },
        ],
        props: [
            { name: 'plant', x: 780, y: 470, w: 85, h: 85 },
            { name: 'trash', x: 60, y: 430, w: 90, h: 80 },
        ],
    },
    {
        note: [
            '센서와 순찰을 함께 배운다. 문은 왼쪽 위다.',
            '걷는 주기와 보는 주기를 일부러 어긋나게 둬서 안전한 쪽이 고정되지 않는다.',
        ],
        name: '숙소 거실',
        background: 'bgLiving',
        spawn: { x: 480, y: 650 },
        exit: { x: 34, y: 100, w: 84, h: 60, art: 'exitSide' },
        hazards: [
            { kind: 'rect', x: 0, y: 0, w: 34, h: 166, inBackground: true },
            { kind: 'rect', x: 118, y: 0, w: 842, h: 166, inBackground: true },
            { kind: 'blink', x: 470, y: 300, w: 48, h: 60, period: 2, on: 1, art: 'sensor' },
            { kind: 'mover', x: 260, y: 480, w: 140, h: 34, period: 5.2, dx: 280, art: 'cart' },
            { kind: 'cone', x: 700, y: 215, radius: 170, spread: 48, from: 115, to: 175, period: 3.2, dx: -420, walkPeriod: 6.2, art: 'watch3' },
        ],
        props: [
            { name: 'sofa', x: 610, y: 470, w: 170, h: 190 },
            { name: 'plant', x: 180, y: 400, w: 85, h: 85 },
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
        spawn: { x: 480, y: 650 },
        exit: { x: 790, y: 185, w: 110, h: 52, art: 'exitSide' },
        hazards: [
            { kind: 'rect', x: 0, y: 0, w: 960, h: 150, inBackground: true },
            { kind: 'cone', x: 480, y: 205, radius: 190, spread: 46, from: 55, to: 125, period: 3, dx: 220, walkPeriod: 5.6, art: 'watch4' },
            { kind: 'spinner', x: 400, y: 400, length: 280, thickness: 22, period: 3.2, art: 'gate' },
            { kind: 'blink', x: 620, y: 330, w: 48, h: 60, period: 1.8, on: 0.9, offset: 0.6, art: 'sensor' },
            { kind: 'mover', x: 120, y: 545, w: 140, h: 34, period: 3.6, dx: 560, art: 'cart' },
            { kind: 'rect', x: 700, y: 470, w: 90, h: 24, art: 'crack', hidden: true },
            { kind: 'blink', x: 250, y: 300, w: 120, h: 26, period: 2.8, on: 1.1, offset: 1.4, art: 'crack', hidden: true },
        ],
        props: [
            { name: 'locker', x: 60, y: 200, w: 160, h: 115 },
            { name: 'plant', x: 120, y: 530, w: 90, h: 90 },
        ],
    },
];

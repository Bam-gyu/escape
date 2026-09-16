// 방 하나 = 아래 덩이 하나. 코드는 안 건드린다.
//
//   name     화면에 뜨는 이름
//   spawn    죄수가 시작하는 자리
//   exit     여기 닿으면 다음 방 {x, y, w, h}
//   hazards  닿으면 죽는 것들
//   props    판정이 없는 장식. 게임은 이 목록을 아예 안 본다
//
// 함정 네 가지:
//   rect   {x, y, w, h}                          가만히 있는 것 (벽, 철창)
//   blink  위 + {period, on}                     period마다 on초 동안만 죽는다
//   mover  위 + {dx, dy, period, offset}         제자리에서 dx·dy만큼 왕복한다
//   cone   {x, y, radius, spread, from, to, period, offset}
//          간수의 시야. 각도는 0이 오른쪽, 90이 아래쪽이다.
//
// offset은 초 단위로 시작 시점을 밀어 함정끼리 박자를 어긋나게 할 때 쓴다.

export const ROOMS = [
    {
        name: '운동장',
        spawn: { x: 700, y: 570 },
        exit: { x: 380, y: 8, w: 84, h: 58 },
        hazards: [
            { kind: 'rect', x: 0, y: 0, w: 380, h: 70, art: 'wall' },
            { kind: 'rect', x: 464, y: 0, w: 496, h: 70, art: 'wall' },
            { kind: 'rect', x: 0, y: 250, w: 420, h: 50, art: 'fence' },
            { kind: 'rect', x: 540, y: 250, w: 420, h: 50, art: 'fence' },
            { kind: 'blink', x: 545, y: 222, w: 26, h: 32, period: 1.6, on: 0.7, art: 'spark' },
            { kind: 'cone', x: 560, y: 150, radius: 235, spread: 44, from: 95, to: 175, period: 3.4, art: 'guard' },
        ],
        props: [
            { name: 'muscle', x: 90, y: 360, w: 230, h: 260 },
            { name: 'drain', x: 390, y: 380, w: 110, h: 70 },
            { name: 'toilet', x: 820, y: 500, w: 90, h: 90 },
        ],
    },
    {
        name: '복도',
        spawn: { x: 480, y: 690 },
        exit: { x: 440, y: 0, w: 80, h: 46 },
        hazards: [
            { kind: 'rect', x: 0, y: 0, w: 300, h: 720, art: 'wall' },
            { kind: 'rect', x: 660, y: 0, w: 300, h: 720, art: 'wall' },
            { kind: 'mover', x: 300, y: 180, w: 120, h: 30, dx: 240, period: 2.6, art: 'bar' },
            { kind: 'mover', x: 540, y: 340, w: 120, h: 30, dx: -240, period: 2.2, offset: 0.5, art: 'bar' },
            { kind: 'mover', x: 300, y: 500, w: 120, h: 30, dx: 240, period: 3.0, offset: 1.1, art: 'bar' },
        ],
        props: [
            { name: 'bed', x: 310, y: 60, w: 120, h: 86 },
            { name: 'desk', x: 530, y: 606, w: 120, h: 86 },
        ],
    },
    {
        name: '감시탑',
        spawn: { x: 480, y: 690 },
        exit: { x: 460, y: 6, w: 80, h: 50 },
        hazards: [
            { kind: 'rect', x: 0, y: 0, w: 460, h: 60, art: 'wall' },
            { kind: 'rect', x: 540, y: 0, w: 420, h: 60, art: 'wall' },
            { kind: 'rect', x: 0, y: 420, w: 380, h: 40, art: 'fence' },
            { kind: 'rect', x: 580, y: 420, w: 380, h: 40, art: 'fence' },
            { kind: 'blink', x: 450, y: 330, w: 60, h: 60, period: 2.0, on: 1.0, art: 'spark' },
            { kind: 'cone', x: 150, y: 120, radius: 320, spread: 50, from: 20, to: 90, period: 3.0, art: 'guard' },
            { kind: 'cone', x: 810, y: 120, radius: 320, spread: 50, from: 160, to: 90, period: 3.4, offset: 0.8, art: 'guard' },
        ],
        props: [
            { name: 'drain', x: 240, y: 560, w: 110, h: 70 },
            { name: 'toilet', x: 700, y: 560, w: 90, h: 90 },
        ],
    },
];

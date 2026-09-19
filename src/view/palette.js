// 그림이 없을 때 대신 쓰는 색.
// 새벽 두 시다. 전체를 푸른 밤 쪽으로 눌러 두고, 사람과 출구만 밝게 남긴다.
export const COLOR = {
    floor: '#2f3646',
    floorEdge: '#262c39',
    wall: '#1b1f29',
    rail: '#3c4455',
    cart: '#5a6273',
    sensor: '#ff5a5a',
    sensorOff: '#3a3f4d',
    lamp: '#ffd97a',
    lampOff: '#3a3f4d',
    gate: '#e8b23a',
    cone: 'rgba(255, 96, 84, 0.34)',
    coneEdge: 'rgba(255, 96, 84, 0.72)',
    // 감시하는 사람 넷. 그림이 없을 때 쓰는 색이다.
    // <b>넷이 서로 달라야 한다</b> — 같은 색이면 그림이 들어오기 전까지
    // 어느 방에 누가 서 있는지 구별이 안 된다.
    watch1: '#2a3250', watch1Cap: '#8d97b5',
    watch2: '#3a2f4a', watch2Cap: '#c98fd6',
    watch3: '#25403c', watch3Cap: '#7fd6c0',
    watch4: '#43321f', watch4Cap: '#e0b072',
    idol: '#ff9ec4',
    idolHead: '#ffe9d6',
    exit: '#63e0a0',
    prop: 'rgba(210, 220, 240, 0.14)',
    hitbox: 'rgba(255, 60, 60, 0.9)',

    // 당하고 나서 드러난 숨은 함정. 다른 함정과 다르게 보여야
    // "아까 그거였구나"가 한눈에 온다.
    revealed: 'rgba(255, 90, 90, 0.45)',
    revealedEdge: 'rgba(255, 150, 150, 0.95)',
};

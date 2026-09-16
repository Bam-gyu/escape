// 소리도 그림과 같다. 파일을 갈아끼우면 바뀌고, 없으면 조용할 뿐 안 멈춘다.
// 지금 들어 있는 것은 Re 프로젝트에서 가져온 것이다.

const SOUNDS = {
    click: 'audio/click.mp3',
    death: 'audio/death.mp3',
    clear: 'audio/clear.mp3',
    win: 'audio/win.mp3',
};

const BGM = 'audio/bgm.mp3';

export function createAudio(muted) {
    const effects = {};
    for (const [name, src] of Object.entries(SOUNDS)) {
        const sound = new Audio(src);
        sound.preload = 'auto';
        effects[name] = sound;
    }

    const music = new Audio(BGM);
    music.loop = true;
    music.volume = 0.35;

    let silent = muted;

    return {
        get muted() { return silent; },

        play(name) {
            if (silent) return;
            const sound = effects[name];
            if (!sound) return;
            // 같은 소리가 연달아 날 때 처음부터 다시 나게 한다.
            // 안 그러면 빨리 두 번 죽었을 때 두 번째가 조용하다.
            sound.currentTime = 0;
            sound.play().catch(() => { });
        },

        startMusic() {
            if (silent) return;
            music.play().catch(() => { });
        },

        setMuted(next) {
            silent = next;
            if (silent) { music.pause(); return; }
            music.play().catch(() => { });
        },
    };
}

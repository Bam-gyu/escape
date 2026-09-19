// 소리도 그림과 같다. 파일을 갈아끼우면 바뀌고, 없으면 조용할 뿐 안 멈춘다.

export const SOUNDS = {
    click: 'audio/click.mp3',
    hover: 'audio/title-select.mp3',
    death: 'audio/death.mp3',
    clear: 'audio/clear.mp3',
    win: 'audio/win.mp3',
};

/// 배경음 두 벌. <b>게임 밖과 게임 안이다.</b>
/// 타이틀·연출·엔딩에서는 title이, 방에 들어가면 stage가 돈다.
export const MUSIC = {
    title: 'audio/title-bgm.mp3',
    stage: 'audio/stage-bgm.mp3',
};

/// 어느 화면에서 어느 곡이 도는가. <b>여기서만 정한다.</b>
///
/// 화면을 바꾸는 자리마다 곡을 같이 갈면 한 군데를 반드시 잊는다. 실제로 그랬다 —
/// 엔딩에서 스테이지곡이 계속 났고, 타이틀에서 H로 편집기에 들어가면 타이틀곡이
/// 그대로 났다. 지금은 그리기 고리가 매 프레임 이걸 물어보므로 어긋날 자리가 없다.
const MUSIC_FOR_SCREEN = {
    title: 'title',
    opening: 'title',
    intro: 'title',
    ending: 'title',
};

/// 게임 밖이면 title, 방 안이면 stage. 모르는 화면은 방 안으로 친다 —
/// 새 화면을 더했을 때 조용해지는 것보다 뭐라도 나는 편이 낫다.
export const musicFor = screen => MUSIC_FOR_SCREEN[screen] ?? 'stage';

/// 소리마다의 크기. 적어두지 않은 것은 그대로 1이다.
/// hover는 버튼에 커서가 스칠 때마다 나므로 작아야 한다 — 같은 크기로 두면
/// 타이틀에서 마우스를 움직이는 것만으로 시끄러워진다.
const VOLUME = { hover: 0.5 };
const MUSIC_VOLUME = 0.35;

export function createAudio(muted) {
    const effects = {};
    for (const [name, src] of Object.entries(SOUNDS)) {
        const sound = new Audio(src);
        sound.preload = 'auto';
        sound.volume = VOLUME[name] ?? 1;
        effects[name] = sound;
    }

    const tracks = {};
    for (const [name, src] of Object.entries(MUSIC)) {
        const track = new Audio(src);
        track.loop = true;
        track.volume = MUSIC_VOLUME;
        tracks[name] = track;
    }

    let silent = muted;
    let current = null;

    function start() {
        if (silent || !current) return;
        tracks[current].play().catch(() => { });
    }

    // 브라우저는 <b>사람이 한 번 건드리기 전까지 소리를 막는다.</b>
    // 그래서 처음 열었을 때 타이틀 음악이 조용히 실패한다. 막힌 것을 알 길이
    // 없으므로(play()가 조용히 거절된다) 첫 손길에 한 번 더 걸어본다.
    // 이미 나고 있으면 play()를 다시 불러도 아무 일도 안 일어난다.
    const unlock = () => start();
    addEventListener('pointerdown', unlock, { once: true });
    addEventListener('keydown', unlock, { once: true });

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

        /// 배경음을 갈아 켠다. 이미 그게 돌고 있으면 아무 일도 안 한다 —
        /// 안 그러면 방을 넘어갈 때마다 같은 곡이 처음으로 되감긴다.
        playMusic(name) {
            if (!tracks[name] || current === name) return;

            for (const [other, track] of Object.entries(tracks)) {
                if (other === name) continue;
                track.pause();
                track.currentTime = 0;
            }

            current = name;
            start();
        },

        setMuted(next) {
            silent = next;
            if (silent) {
                for (const track of Object.values(tracks)) track.pause();
                return;
            }
            start();
        },
    };
}

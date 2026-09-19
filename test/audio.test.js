import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import { SOUNDS, MUSIC, musicFor, createAudio } from '../src/view/audio.js';

const at = name => new URL(`../${name}`, import.meta.url);
const MAIN = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

/// 소리는 없어도 게임이 안 멈춘다 — 그래서 <b>이름을 틀려도 아무도 모른다.</b>
/// 파일이 있는지는 여기서만 잡힌다.
test('쓰기로 한 소리 파일이 다 있다', () => {
    for (const [name, src] of Object.entries({ ...SOUNDS, ...MUSIC })) {
        assert.ok(existsSync(at(src)), `${name}: ${src}가 없다`);
    }
});

test('배경음은 타이틀과 스테이지 둘이다', () => {
    assert.deepEqual(Object.keys(MUSIC).sort(), ['stage', 'title']);
});

test('파일 이름이 전부 소문자다', () => {
    // macOS는 대소문자를 안 가리지만 배포하는 서버는 가린다.
    // Click.mp3로 두면 내 컴퓨터에서만 나고 올리면 조용해진다.
    for (const src of [...Object.values(SOUNDS), ...Object.values(MUSIC)]) {
        assert.equal(src, src.toLowerCase(), `${src}에 대문자가 있다`);
    }
});

// ── 부르는 쪽과 맞는가 ────────────────────────────────────────
// 목록을 따로 적어두고 견주면 헛돈다. main.js가 실제로 부르는 이름을 읽는다.

test('main.js가 부르는 효과음이 다 있다', () => {
    const called = [...MAIN.matchAll(/audio\.play\('([^']+)'\)/g)].map(m => m[1]);
    assert.ok(called.length >= 4, `부르는 데를 못 찾았다 (${called.length}개)`);

    for (const name of new Set(called)) {
        assert.ok(SOUNDS[name], `main.js가 없는 소리 '${name}'을 부른다`);
    }
});

test('main.js가 쓰는 화면마다 곡이 정해져 있다', () => {
    // game.screen에 들어가는 값들을 main.js에서 그대로 긁어온다.
    const screens = new Set([...MAIN.matchAll(/screen = '([^']+)'/g)].map(m => m[1]));
    assert.ok(screens.size >= 6, `화면을 못 찾았다 (${screens.size}개)`);

    for (const screen of screens) {
        assert.ok(MUSIC[musicFor(screen)], `'${screen}' 화면에 곡이 없다`);
    }
});

test('게임 밖에서는 타이틀곡, 방 안에서는 스테이지곡이다', () => {
    for (const screen of ['title', 'opening', 'intro', 'ending']) {
        assert.equal(musicFor(screen), 'title', `${screen}은 게임 밖이다`);
    }
    for (const screen of ['ready', 'play', 'dead', 'clear']) {
        assert.equal(musicFor(screen), 'stage', `${screen}은 방 안이다`);
    }
});

// ── 곡을 갈아 켜는 동작 ───────────────────────────────────────

/// 브라우저 없이 createAudio를 돌리려고 Audio와 리스너를 흉내 낸다.
/// 어떤 곡이 언제 났는지 세는 것이 전부다.
function withFakeAudio(run, { blockUntilGesture = false } = {}) {
    const made = [];
    const listeners = [];
    const savedAudio = globalThis.Audio;
    const savedAdd = globalThis.addEventListener;

    // 브라우저가 막고 있는 동안은 play()가 거절된다. 진짜와 같게 흉내 낸다.
    let blocked = blockUntilGesture;

    globalThis.Audio = class {
        constructor(src) {
            this.src = src; this.playing = false; this.currentTime = 0; this.starts = 0;
            made.push(this);
        }
        play() {
            if (blocked) return Promise.reject(new Error('NotAllowedError'));
            this.playing = true; this.starts++;
            return Promise.resolve();
        }
        pause() { this.playing = false; }
    };
    // <b>once를 흉내 내야 한다.</b> 안 그러면 "한 번만 걸고 포기한다"는 결함을
    // 이 가짜가 대신 덮어줘서, 검사가 지키는 척만 하게 된다. 실제로 그랬다.
    globalThis.addEventListener = (type, fn, options) => {
        listeners.push({ type, fn, once: options?.once === true });
    };

    try {
        const audio = createAudio(false);
        const track = name => made.find(a => a.src === MUSIC[name]);

        /// 사람이 화면을 건드렸다. 그 순간부터 브라우저가 소리를 허락한다.
        const gesture = type => {
            blocked = false;
            for (const l of listeners.filter(l => l.type === type)) {
                if (l.once) listeners.splice(listeners.indexOf(l), 1);
                l.fn({});
            }
        };
        return run(audio, track, made, gesture);
    } finally {
        globalThis.Audio = savedAudio;
        globalThis.addEventListener = savedAdd;
    }
}

test('곡을 갈면 앞의 것은 멎고 새것이 난다', () => {
    withFakeAudio((audio, track) => {
        audio.playMusic('title');
        assert.equal(track('title').playing, true);
        assert.equal(track('stage').playing, false);

        audio.playMusic('stage');
        assert.equal(track('title').playing, false);
        assert.equal(track('stage').playing, true);
    });
});

test('같은 곡을 다시 걸어도 처음으로 되감기지 않는다', () => {
    // 매 프레임 부르는 자리라, 여기가 새면 곡이 영원히 첫 소절만 난다.
    withFakeAudio((audio, track) => {
        audio.playMusic('stage');
        track('stage').currentTime = 42;

        for (let i = 0; i < 100; i++) audio.playMusic('stage');

        assert.equal(track('stage').currentTime, 42);
        assert.equal(track('stage').starts, 1);
    });
});

test('음소거했다 켜면 마지막에 고른 곡이 이어진다', () => {
    withFakeAudio((audio, track) => {
        audio.playMusic('stage');
        audio.setMuted(true);
        assert.equal(track('stage').playing, false);

        audio.setMuted(false);
        assert.equal(track('stage').playing, true);
    });
});

test('음소거 중에 곡을 갈아도 켰을 때 그 곡이 난다', () => {
    withFakeAudio((audio, track) => {
        audio.playMusic('stage');
        audio.setMuted(true);
        audio.playMusic('title');

        assert.equal(track('title').playing, false, '음소거 중에는 안 나야 한다');

        audio.setMuted(false);
        assert.equal(track('title').playing, true);
        assert.equal(track('stage').playing, false);
    });
});

test('음소거 중에는 효과음도 안 난다', () => {
    withFakeAudio((audio, _track, made) => {
        audio.setMuted(true);
        audio.play('click');
        assert.equal(made.find(a => a.src === SOUNDS.click).starts, 0);
    });
});


// ── 브라우저가 막았을 때 ──────────────────────────────────────
// 처음 열면 브라우저가 소리를 막는다. play()가 조용히 거절되므로
// 막힌 줄도 모르고 지나간다. 사람이 건드릴 때 다시 걸어야 한다.

test('막혔다가 사람이 누르면 그때 배경음이 난다', () => {
    withFakeAudio((audio, track, _made, gesture) => {
        audio.playMusic('title');
        assert.equal(track('title').playing, false, '아직은 막혀 있어야 한다');

        gesture('pointerdown');
        assert.equal(track('title').playing, true, '누른 뒤에는 나야 한다');
    }, { blockUntilGesture: true });
});

test('키를 눌러도 다시 걸어본다', () => {
    withFakeAudio((audio, track, _made, gesture) => {
        audio.playMusic('stage');
        gesture('keydown');
        assert.equal(track('stage').playing, true);
    }, { blockUntilGesture: true });
});

test('음소거 중에는 사람이 눌러도 안 난다', () => {
    withFakeAudio((audio, track, _made, gesture) => {
        audio.setMuted(true);
        audio.playMusic('title');
        gesture('pointerdown');
        assert.equal(track('title').playing, false);
    }, { blockUntilGesture: true });
});

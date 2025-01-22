import { EventEmitter } from './eventemitter.js';

export class ProgressEvent extends Event {
    constructor(public progress: number, init?: EventInit) {
        super('progress', init);
    }
}

export class LogEvent extends Event {
    constructor(public message: number, init?: EventInit) {
        super('log', init);
    }
}

export class CompleteEvent extends Event {
    constructor(public audio: { left: Float32Array, right: Float32Array }[], init?: EventInit) {
        super('complete', init);

    }
}

// TODO: expand on this when I get a feel for the other models
export const Models = {
    FourStems: '4-stems',
    SixStems: '6-stems',
    Karaoke: 'karaoke',
}

export class Demucs extends EventEmitter {
    protected static SAMPLE_RATE = 44100;
    protected static OVERLAP_S = 0.75;
    protected static OVERLAP_SAMPLES = Math.floor(Demucs.SAMPLE_RATE * Demucs.OVERLAP_S);
    protected static NUM_CHANNELS = 2;

    static PREFIX = '.';
    protected worker: Worker;

    constructor(selectedModel: string) {
        super();
        this.worker = new Worker(`${Demucs.PREFIX}/worker.js`);
        this.worker.onmessage = (e) => {
            switch (e.data.msg) {
                case 'WASM_READY':
                    break;

                case 'PROGRESS_UPDATE':
                    this.dispatchEvent(new ProgressEvent(e.data.data));
                    break;

                case 'PROCESSING_DONE':
                    const audio: { left: Float32Array, right: Float32Array, byteLength: number }[] = [];
                    for (let i = 0; i < e.data.waveforms.length; i+=2) {
                        const left = new Float32Array(e.data.waveforms[i]);
                        const right = new Float32Array(e.data.waveforms[i+1]);
                        audio.push({left, right, byteLength: left.length});
                    }
                    this.dispatchEvent(new CompleteEvent(audio));
                    break;

                case 'WASM_ERROR':
                    console.error("Error executing WASM");
                    break;

                case 'WASM_LOG':
                    this.dispatchEvent(new LogEvent(e.data.data));
                    break;
            }
        }
        this.init(selectedModel).then(() => {
           this.dispatchEvent(new Event('ready'));
        });
    }

    async process(file: File | Float32Array[]): Promise<void> {
        if (file instanceof File) {
            return new Promise((resolve, _reject) => {
                const reader = new FileReader();
                reader.onload = (_e) => {
                    const arrayBuffer = reader.result as ArrayBuffer;
                    new AudioContext().decodeAudioData(arrayBuffer, (audioBuffer) => {
                        const leftChannel = audioBuffer.getChannelData(0);
                        const rightChannel = audioBuffer.getChannelData(1);
                        this.processAudioSegments(leftChannel, rightChannel);
                        resolve();
                    });
                }
                reader.readAsArrayBuffer(file);
            });
        } else {
            this.processAudioSegments(file[0], file[1]);
        }
    }

    protected async init(selectedModel: string) {
        const dlModelBuffers = await this.fetchAndCacheFiles(selectedModel);
        this.worker.postMessage({
            msg: "LOAD_WASM",
            model: selectedModel,
            modelBuffers: dlModelBuffers });
    }

    protected fetchAndCacheFiles(model: string) {
        const dls = [];
        switch (model) {
            case "demucs-free-4s":
            case Models.FourStems:
                dls.push("htdemucs.ort.gzipped");
                break;

            case "demucs-free-6s":
            case Models.SixStems:
                dls.push("htdemucs_6s.ort.gzipped");
                break;

            case "demucs-karaoke":
            case Models.Karaoke:
                dls.push("htdemucs_2s_cust.ort.gzipped");
                break;

            case "demucs-pro-ft":
                dls.push("htdemucs_ft_drums.ort.gzipped", "htdemucs_ft_bass.ort.gzipped", "htdemucs_ft_other.ort.gzipped", "htdemucs_ft_vocals.ort.gzipped");
                break;

            case "demucs-pro-cust":
                dls.push("htdemucs_2s_cust.ort.gzipped", "htdemucs.ort.gzipped", "htdemucs_6s.ort.gzipped");
                break;

            case "demucs-pro-deluxe":
                dls.push("htdemucs_ft_drums.ort.gzipped", "htdemucs_ft_bass.ort.gzipped", "htdemucs_ft_other.ort.gzipped", "htdemucs_2s_cust.ort.gzipped");
                break;
        }

        const fetches: Promise<ArrayBuffer>[] = [];
        dls.map((dl) => {
            fetches.push(fetch(Demucs.PREFIX + '/models/' + dl).then((res) => {
                if (res.ok) {
                    return res.arrayBuffer();
                }
                throw new Error("Failed to fetch " + dl);
            }));
        });
        return Promise.all(fetches);
    }

    // TODO: Let's not segment for now and see how it goes
    // according to https://github.com/facebookresearch/demucs, segmenting
    // is done for GPU memory purposes, but I don't think this solution even uses the
    // lets find out....
    protected processAudioSegments(left: Float32Array, right: Float32Array) {
        this.worker.postMessage({ msg: "PROCESS_AUDIO", leftChannel: left, rightChannel: right, originalLength: left.length });
    }

    /*protected processAudioSegments(left: Float32Array, right: Float32Array) {
        this.segmentWaveform(left, right, Demucs.NUM_CHANNELS).forEach((e, _t) => {
           this.worker.postMessage({ msg: "PROCESS_AUDIO", leftChannel: e[0], rightChannel: e[1], originalLength: left.length });
        });
    }*/

    protected segmentWaveform(left: Float32Array, right: Float32Array, channelCount: number) {
        const s = left.length, d = Math.ceil(s / channelCount), l = [];
        for (let e = 0; e < channelCount; e++) {
            let i;
            const r = e * d, a = Math.min(s, r + d);
            const c = new Float32Array(a - r + 2 * Demucs.OVERLAP_SAMPLES);
            const m = new Float32Array(a - r + 2 * Demucs.OVERLAP_SAMPLES);
            0 === e ? (c.fill(left[0], 0, Demucs.OVERLAP_SAMPLES), m.fill(right[0], 0, Demucs.OVERLAP_SAMPLES)) : (c.set(left.slice(r - Demucs.OVERLAP_SAMPLES, r), 0), m.set(right.slice(r - Demucs.OVERLAP_SAMPLES, r), 0)),
                e === channelCount - 1
                    ? ((i = s - a), c.set(left.slice(a, a + Math.min(Demucs.OVERLAP_SAMPLES, i)), a - r + Demucs.OVERLAP_SAMPLES), m.set(right.slice(a, a + Math.min(Demucs.OVERLAP_SAMPLES, i)), a - r + Demucs.OVERLAP_SAMPLES))
                    : (c.set(left.slice(a, a + Demucs.OVERLAP_SAMPLES), a - r + Demucs.OVERLAP_SAMPLES), m.set(right.slice(a, a + Demucs.OVERLAP_SAMPLES), a - r + Demucs.OVERLAP_SAMPLES)),
                c.set(left.slice(r, a), Demucs.OVERLAP_SAMPLES),
                m.set(right.slice(r, a), Demucs.OVERLAP_SAMPLES),
                l.push([c, m]);
        }
        return l;
    }
}
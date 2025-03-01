let modelName, modelBuffers;
function loadWASMModule() {
    try {
        return importScripts("demucs_onnx_simd.js"), libdemucs();
    } catch (e) {
        return console.error("Error loading WASM module script:", e), null;
    }
}
function getNumModelsFromModelName() {
    let e = 0;

    switch (modelName) {
        case 'bass':
        case 'drums':
        case 'vocals':
            return 1;
    }

    return (
        "demucs-free-4s" === modelName || "demucs-free-6s" === modelName || "demucs-karaoke" === modelName
            ? (e = 1)
            : "demucs-pro-ft" === modelName || "demucs-pro-deluxe" === modelName
                ? (e = 4)
                : "demucs-pro-cust" === modelName && (e = 3),
            e
    );
}
function getNumTargetsFromModelName() {
    let e = [4];
    return "demucs-free-6s" === modelName ? (e = [6]) : "demucs-karaoke" === modelName ? (e = [2]) : "demucs-pro-ft" === modelName ? (e = [4, 4, 4, 4]) : "demucs-pro-deluxe" === modelName && (e = [4, 4, 4, 2]), e;
}
onmessage = async function (m) {
    if ("LOAD_WASM" === m.data.msg) (modelName = m.data.model), (modelBuffers = m.data.modelBuffers);
    else if ("PROCESS_AUDIO" === m.data.msg || "PROCESS_AUDIO_BATCH" === m.data.msg) {
        console.log("Started demix job at " + new Date().toString());
        var n = m.data.leftChannel,
            l = m.data.rightChannel,
            r = getNumModelsFromModelName();
        let t = r,
            o = !1;
        ("demucs-pro-deluxe" !== modelName && "demucs-pro-cust" !== modelName && "demucs-karaoke" !== modelName) || (console.log("Using augmented inference for model:", modelName), (o = !0), (t *= 2));
        var d = [],
            s = modelBuffers.map((e) => new Uint8Array(e));
        if ("demucs-pro-cust" != modelName) {
            var i = getNumTargetsFromModelName();
            for (let a = 0; a < r; a++) {
                let e = await loadWASMModule();
                if (!e) return void console.error("Error loading WASM module");
                var u = e._malloc(s[a].byteLength);
                e.HEAPU8.set(s[a], u), e._modelInit(u, s[a].byteLength), e._free(u);
                let r;
                var u = "PROCESS_AUDIO_BATCH" === m.data.msg,
                    f = o ? 2 * a : a;
                (r = processAudio(n, l, e, i[a], u, t, f)),
                o &&
                ((invertedLeftChannel = n.map((e) => -e)),
                    (invertedRightChannel = l.map((e) => -e)),
                    (invertedTargetWaveforms = processAudio(invertedLeftChannel, invertedRightChannel, e, i[a], u, t, f + 1)),
                    (invertInvertTargetWaveforms = invertedTargetWaveforms.map((e) => e.map((e) => -e))),
                    (r = r.map((e, a) => e.map((e, r) => (e + invertInvertTargetWaveforms[a][r]) / 2)))),
                    d.push(r),
                    (e = null);
            }
        } else {
            let e = await loadWASMModule();
            if (!e) return void console.error("Error loading WASM module");
            var c = e._malloc(s[0].byteLength);
            e.HEAPU8.set(s[0], c), e._modelInit(c, s[0].byteLength), e._free(c);
            let r;
            var c = "PROCESS_AUDIO_BATCH" === m.data.msg,
                g =
                    ((r = processAudio(n, l, e, 2, c, t, 0)),
                        (invertedLeftChannel1 = n.map((e) => -e)),
                        (invertedRightChannel1 = l.map((e) => -e)),
                        (invertedTargetWaveforms1 = processAudio(invertedLeftChannel1, invertedRightChannel1, e, 2, c, t, 1)),
                        (invertInvertTargetWaveforms1 = invertedTargetWaveforms1.map((e) => e.map((e) => -e))),
                        (r = r.map((e, a) => e.map((e, r) => (e + invertInvertTargetWaveforms1[a][r]) / 2)))[2]),
                v = r[3];
            if (!(e = await loadWASMModule())) return void console.error("Error loading WASM module");
            var p = e._malloc(s[1].byteLength);
            e.HEAPU8.set(s[1], p), e._modelInit(p, s[1].byteLength), e._free(p);
            let a;
            if (
                ((a = processAudio(g, v, e, 4, c, t, 2)),
                    (invertedLeftChannel2 = g.map((e) => -e)),
                    (invertedRightChannel2 = v.map((e) => -e)),
                    (invertedTargetWaveforms2 = processAudio(invertedLeftChannel2, invertedRightChannel2, e, 4, c, t, 3)),
                    (invertInvertTargetWaveforms2 = invertedTargetWaveforms2.map((e) => e.map((e) => -e))),
                    (a = a.map((e, a) => e.map((e, r) => (e + invertInvertTargetWaveforms2[a][r]) / 2))),
                    !(e = await loadWASMModule()))
            )
                return void console.error("Error loading WASM module");
            p = e._malloc(s[2].byteLength);
            e.HEAPU8.set(s[2], p), e._modelInit(p, s[2].byteLength), e._free(p);
            let o;
            (o = processAudio(g, v, e, 6, c, t, 4)),
                (invertedTargetWaveforms3 = processAudio(invertedLeftChannel2, invertedRightChannel2, e, 6, c, t, 5)),
                (invertInvertTargetWaveforms3 = invertedTargetWaveforms3.map((e) => e.map((e) => -e))),
                (o = o.map((e, a) => e.map((e, r) => (e + invertInvertTargetWaveforms3[a][r]) / 2)));
            p = [a[0].map((e, r) => (e + o[0][r]) / 2), a[1].map((e, r) => (e + o[1][r]) / 2), a[2].map((e, r) => (e + o[2][r]) / 2), a[3].map((e, r) => (e + o[3][r]) / 2), o[4], o[5], r[0], r[1], o[8], o[9], o[10], o[11], a[4], a[5]];
            d.push(p);
        }
        let e;
        "demucs-karaoke" === modelName || "demucs-free-4s" === modelName || "demucs-free-6s" === modelName || "demucs-pro-cust" === modelName || "bass" === modelName || "drums" === modelName || "vocals" === modelName
            ? (e = d[0])
            : "demucs-pro-ft" === modelName
                ? (e = [d[0][0], d[0][1], d[1][2], d[1][3], d[2][4], d[2][5], d[3][6], d[3][7]])
                : "demucs-pro-deluxe" === modelName && (e = [d[0][0], d[0][1], d[1][2], d[1][3], d[2][4], d[2][5], d[3][0], d[3][1]]);
        g = e.map((e) => e.buffer);
        console.log("Finished demix job at " + new Date().toString()),
            postMessage({ msg: "PROCESS_AUDIO" === m.data.msg ? "PROCESSING_DONE" : "PROCESSING_DONE_BATCH", waveforms: e, originalLength: m.data.originalLength, filename: "PROCESS_AUDIO" === m.data.msg ? "" : m.data.filename }, g);
    }
};
let MAX_TARGETS = 6;
function allocateWasmArray(e, r) {
    var a = r.length * r.BYTES_PER_ELEMENT,
        a = e._malloc(a);
    if (0 === a) throw new Error("Memory allocation failed");
    return new Float32Array(e.HEAPF32.buffer, a, r.length).set(r), a;
}
function freeWasmMemory(r, e) {
    e.forEach((e) => {
        null !== e && 0 !== e && r._free(e);
    });
}
function processAudio(r, a, o, t, e, m, n) {
    try {
        var l = [allocateWasmArray(o, r), allocateWasmArray(o, a)],
            d = [];
        for (let e = 0; e < MAX_TARGETS; e++)
            if (e < t) {
                var s = o._malloc(r.length * r.BYTES_PER_ELEMENT),
                    i = o._malloc(a.length * a.BYTES_PER_ELEMENT);
                if (0 === s || 0 === i) throw new Error("Memory allocation failed for target " + e);
                d.push(s, i);
            } else d.push(0, 0);
        var u = [l[0], l[1], r.length],
            f = (u.push(...d), u.push(e, m, n), o._modelDemixSegment(...u), []);
        for (let e = 0; e < t; e++) {
            var c,
                g,
                v = d[2 * e],
                p = d[2 * e + 1];
            0 !== v && 0 !== p && ((c = new Float32Array(o.HEAPF32.buffer, v, r.length)), (g = new Float32Array(o.HEAPF32.buffer, p, a.length)), f.push(new Float32Array(c)), f.push(new Float32Array(g)));
        }
        return freeWasmMemory(o, [...l, ...d]), console.log("Processed waveforms for model index " + n), f;
    } catch (e) {
        console.error("Error in processAudio:", e), console.error("Error processing audio"), postMessage({ msg: "WASM_ERROR" }), close();
    }
}

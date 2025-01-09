# demucs-wasm
wrapper around demucs wasm

### What is Demucs?
From the [official repository](https://github.com/adefossez/demucs):
Demucs is a state-of-the-art music source separation model, currently capable of separating drums, bass, and vocals from the rest of the accompaniment. Demucs is based on a U-Net convolutional architecture inspired by Wave-U-Net. The v4 version features Hybrid Transformer Demucs, a hybrid spectrogram/waveform separation model using Transformers.

### WASM!
The above has been compiled to WebAssembly for running locally in the browser. Honestly, I have no idea
how to do this myself, but my understanding is that the PyTorch model has been converted to ONNX which can then
be made available for use in the browser. There's also a significant amount of C++ code to make this all work.
See https://github.com/sevagh/demucs.cpp for more details.

Even with the aforementioned repo, I still reverse engineered MIT licensed code from https://github.com/sevagh/freemusicdemixer.com to get this
complicated thing working.

All in all, I'm not doing much here other than giving it a nice TypeScript wrapper that gets published to NPM and removing the use-cases of 
paid/free logic for choosing which models get used, but instead just making it all available via the API of this wrapper.



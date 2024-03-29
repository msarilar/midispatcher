import * as React from "react";
import * as Tone from "tone";

import { S } from "./MachineStyling";
import { ON_MIDI_MESSAGE } from "../Utils";
import { MachineMessage } from "./Machines";

export const MidiSignalVizualizer: React.FunctionComponent<{ width: number, height: number, midiMessageEmitter: EventTarget}> = props => {

    const midiVizualizerCanvasRef = React.useRef<HTMLCanvasElement>(null);

    const [state, setState] = React.useState({ midiVizualizerOn: true });

    React.useEffect(() => {

        const midiVizualizer = midiVizualizerCanvasRef.current?.getContext("2d") ?? undefined;

        if (midiVizualizer == undefined) {

            return;
        }

        const centerX = props.width / 2;
        const centerY = props.height / 2;

        midiVizualizer.clearRect(0, 0, props.width, props.height);

        let angle = 0;
        let offsetX = centerX;
        let offsetY = centerY
        let lastX: number | undefined = undefined;
        let lastY: number | undefined = undefined;

        let shift = 0;

        const numToColor = (n: number | undefined) => {

            shift = (shift + 1) % 255;
            if (n == undefined) {

                return shift;
            }

            else {

                return (n + shift) % 255;
            }
        };
            
        const onMidiMessage = (e: Event) => {

            const detail = (e as CustomEvent<MachineMessage>).detail;

            if (detail.type !== "noteoff") {

                midiVizualizer.beginPath();
                midiVizualizer.lineWidth = (angle) + 1;
                const radians = angle * (Math.PI / 180.0);

                const sum = (detail.message.rawData[0] ?? 0) + (detail.message.rawData[1] ?? 0) + (detail.message.rawData[2] ?? 0);
                const factor = sum / (255 * 3);

                const x = offsetX + Math.cos(radians) * props.width * factor;
                const y = offsetY + Math.sin(radians) * props.height * factor;

                midiVizualizer.strokeStyle = "rgb(" + numToColor(detail.message.rawData[angle + 2 % 3]) + " " + numToColor(detail.message.rawData[angle + 1 % 3]) + " " + numToColor(detail.message.rawData[angle % 3]) + ")";
                midiVizualizer.lineTo(lastX ?? x, lastY ?? y);
                midiVizualizer.strokeStyle = "rgb(" + numToColor(detail.message.rawData[angle % 3]) + " " + numToColor(detail.message.rawData[(angle + 1) % 3]) + " " + numToColor(detail.message.rawData[(angle + 2) % 3]) + ")";
                midiVizualizer.lineTo(x, y);
                midiVizualizer.lineTo(x + Math.random() * 10 - 5, y + Math.random() * 10 - 5);

                lastX = centerX + (x * (angle % 2 === 1 ? 1 : -1)) + Math.random() * angle;
                lastY = centerY + (y * (angle % 2 === 0 ? 1 : -1)) + Math.random() * angle;

                offsetX += Math.random() * 10 - 5;
                offsetY += Math.random() * 10 - 5;

                if(offsetX > props.width) {
                    
                    offsetX = 0;
                }
                else if(offsetX < 0) {

                    offsetX = props.width;
                }

                if(offsetY > props.height) {
                    
                    offsetY = 0;
                }
                else if(offsetY < 0) {

                    offsetY = props.height;
                }

                midiVizualizer.stroke();
            }

            angle = (angle + 1) % 360;
        }

        props.midiMessageEmitter.addEventListener(ON_MIDI_MESSAGE, onMidiMessage);
        return () => {

            props.midiMessageEmitter.removeEventListener(ON_MIDI_MESSAGE, onMidiMessage);
        }
    }, [props.midiMessageEmitter]);

    return (
        <S.SettingsBarHorizontal>
            <canvas ref={midiVizualizerCanvasRef} width={props.width} height={props.height} onClick={_ => setState({ ...state, midiVizualizerOn: !state.midiVizualizerOn })} />
        </S.SettingsBarHorizontal>
    );
}

interface AudioNodeVizualizerState {

    oscilloscopeOn: boolean;
    spectrogramOn: boolean;
    oscilloscope: CanvasRenderingContext2D | undefined;
    spectrogram: CanvasRenderingContext2D | undefined;
}

export const AudioNodeVizualizer: React.FunctionComponent<{ width: number, height: number, analyser: AnalyserNode }> = props => {

    const oscilloscopeCanvasRef = React.useRef<HTMLCanvasElement>(null);
    const spectrogramCanvasRef = React.useRef<HTMLCanvasElement>(null);

    const [state, setState] = React.useState<AudioNodeVizualizerState>({ oscilloscopeOn: true, spectrogramOn: true, oscilloscope: undefined, spectrogram: undefined });

    const foreground = "rgb(0 0 0)";
    let running = true;

    props.analyser.fftSize = 1024;
    
    const bufferSpectrogramLength = props.analyser.frequencyBinCount;
    const dataSpectrogramArray = new Uint8Array(bufferSpectrogramLength);
    const sliceSpectrogramWidth = props.width / bufferSpectrogramLength;

    const bufferOscilloscopeLength = props.analyser.fftSize;
    const dataOscilloscopeArray = new Uint8Array(bufferOscilloscopeLength);
    const sliceOscilloscopeWidth = props.width / bufferOscilloscopeLength;
    const definition = props.width / 50;

    const fps = 24;
    const fpsInterval = 1000 / fps;

    // could be used to determine where to start reading the array from getByteTimeDomainData (using elapsed), but fft doesnt seem accurate enough?
    const waveArrayDuration = 1000 * props.analyser.fftSize / Tone.getContext().sampleRate;
    const waveArrayStepDuration = waveArrayDuration / props.analyser.fftSize;

    const drawVisuals = function (state: AudioNodeVizualizerState) {

        if (!running) {

            return;
        }

        if (state.oscilloscopeOn && state.oscilloscope != undefined) {

            drawOscilloscope(state.oscilloscope);
        }

        if (state.spectrogramOn && state.spectrogram != undefined) {

            drawSpectrogram(state.spectrogram);
        }

        setTimeout(() => requestAnimationFrame(function() { drawVisuals(state); }), fpsInterval);
    }

    const findTargetIndex = (startingTarget: number, array: Uint8Array) => {

        let index = -1;
        if (array[0] !== startingTarget || array[array.length - 1] >= startingTarget) {

            for (let i = 1; i < array.length; i++) {
                if (array[i] === startingTarget && array[i -1] < startingTarget) {

                    index = i;
                    break;
                }
            }
        }

        return index;
    }

    const drawOscilloscope = function (oscilloscope: CanvasRenderingContext2D) {

        props.analyser.getByteTimeDomainData(dataOscilloscopeArray);

        let shift = findTargetIndex(128, dataOscilloscopeArray);

        if (shift === -1) {

            shift = findTargetIndex(255, dataOscilloscopeArray);
        }

        oscilloscope.clearRect(0, 0, props.width, props.height);
        oscilloscope.lineWidth = 2;
        oscilloscope.strokeStyle = foreground;
        oscilloscope.beginPath();
        let totalWidth = 0;

        for (let i = 0; i < dataOscilloscopeArray.length; i++) {

            const index = shift + i;
            const scaledDownValue = dataOscilloscopeArray[index % dataOscilloscopeArray.length] / 255.0;

            const height = scaledDownValue * props.height;

            oscilloscope.lineTo(totalWidth, height);

            totalWidth += sliceOscilloscopeWidth;
        }

        oscilloscope.lineTo(props.width, props.height / 2);
        oscilloscope.stroke();
    };

    const drawSpectrogram = function (spectrogram: CanvasRenderingContext2D) {

        props.analyser.getByteFrequencyData(dataSpectrogramArray);

        spectrogram.clearRect(0, 0, props.width, props.height);
        spectrogram.fillStyle = foreground;
        let totalWidth = 0;

        for (let i = 0; i < dataSpectrogramArray.length; i = i + definition) {

            let barHeight = findMaxUint8Array(dataSpectrogramArray.subarray(i, i + definition));
            barHeight /= 255;
            barHeight *= props.height;

            spectrogram.fillRect(
                totalWidth,
                props.height - barHeight,
                sliceSpectrogramWidth * definition,
                barHeight
            );

            totalWidth += sliceSpectrogramWidth * definition;
        }
    };

    React.useEffect(() => {

        const oscilloscope = oscilloscopeCanvasRef.current?.getContext("2d") ?? undefined;
        const spectrogram = spectrogramCanvasRef.current?.getContext("2d") ?? undefined;

        const newState = { ...state, oscilloscope: oscilloscope, spectrogram: spectrogram };
        setState(newState);

        drawVisuals(newState);
        return () => {

            running = false;
        };
    }, [state.oscilloscopeOn, state.spectrogramOn]);

    return (
        <S.SettingsBarHorizontal>
            <canvas ref={spectrogramCanvasRef} width={props.width} height={props.height} onClick={_ => setState({ ...state, spectrogramOn: !state.spectrogramOn })} />
            <canvas ref={oscilloscopeCanvasRef} width={props.width} height={props.height} onClick={_ => setState({ ...state, oscilloscopeOn: !state.oscilloscopeOn })} />
        </S.SettingsBarHorizontal>
    );
}

function findMaxUint8Array(arr: Uint8Array): number {

    if (arr.length === 0) {

        throw new Error("Array is empty");
    }

    let max = arr[0];

    for (let i = 1; i < arr.length; i++) {

        if (arr[i] > max) {

            max = arr[i];
        }
    }

    return max;
}
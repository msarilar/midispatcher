import * as React from "react";

import { S } from './MachineStyling';

interface VisualizersState {

    oscilloscopeOn: boolean;
    spectrogramOn: boolean;
    oscilloscope: CanvasRenderingContext2D | undefined;
    spectrogram: CanvasRenderingContext2D | undefined;
}

export const Visualizers: React.FunctionComponent<{ width: number, height: number, analyser: AnalyserNode }> = props => {

    const oscilloscopeCanvasRef = React.useRef<HTMLCanvasElement>(null);
    const spectrogramCanvasRef = React.useRef<HTMLCanvasElement>(null);

    const [state, setState] = React.useState<VisualizersState>({ oscilloscopeOn: true, spectrogramOn: true, oscilloscope: undefined, spectrogram: undefined });

    const foreground = "rgb(0 0 0)";
    let running = true;

    props.analyser.fftSize = 1024;
    const bufferLength = props.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const sliceWidth = props.width / bufferLength;
    const definition = props.width / 50;

    const fps = 48;
    const fpsInterval = 1000 / fps;
    let then = performance.now();

    const drawVisuals = function (state: VisualizersState) {

        if (!running) {

            return;
        }

        const _ = requestAnimationFrame(function() { drawVisuals(state); });

        let now = performance.now();
        let elapsed = now - then;
        if (elapsed <= fpsInterval) {

            return;
        }

        then = now - (elapsed % fpsInterval);

        if (state.oscilloscopeOn && state.oscilloscope != undefined) {

            drawOscilloscope(state.oscilloscope);
        }

        if (state.spectrogramOn && state.spectrogram != undefined) {

            drawSpectrogram(state.spectrogram);
        }
    }

    const drawOscilloscope = function (oscilloscope: CanvasRenderingContext2D) {

        props.analyser.getByteTimeDomainData(dataArray);

        oscilloscope.clearRect(0, 0, props.width, props.height);
        oscilloscope.lineWidth = 2;
        oscilloscope.strokeStyle = foreground;
        oscilloscope.beginPath();
        let totalWidth = 0;

        for (let i = 0; i < bufferLength; i++) {

            const v = dataArray[i] / 128.0;

            const y = v * (props.height / 2);

            if (i === 0) {

                oscilloscope.moveTo(totalWidth, y);
            } else {

                oscilloscope.lineTo(totalWidth, y);
            }

            totalWidth += sliceWidth;
        }

        oscilloscope.lineTo(props.width, props.height / 2);
        oscilloscope.stroke();
    };

    const drawSpectrogram = function (spectrogram: CanvasRenderingContext2D) {

        props.analyser.getByteFrequencyData(dataArray);

        spectrogram.clearRect(0, 0, props.width, props.height);
        spectrogram.fillStyle = foreground;
        let totalWidth = 0;

        for (let i = 0; i < bufferLength; i = i + definition) {

            let barHeight = findMaxUint8Array(dataArray.subarray(i, i + definition));
            barHeight /= 255;
            barHeight *= props.height;

            spectrogram.fillRect(
                totalWidth,
                props.height - barHeight,
                sliceWidth * definition,
                barHeight
            );

            totalWidth += sliceWidth * definition;
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

        throw new Error('Array is empty');
    }

    let max = arr[0];

    for (let i = 1; i < arr.length; i++) {

        if (arr[i] > max) {

            max = arr[i];
        }
    }

    return max;
}
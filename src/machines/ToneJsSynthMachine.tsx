import styled from '@emotion/styled';
import { DiagramEngine } from "@projectstorm/react-diagrams";
import * as React from 'react';
import * as Tone from "tone";

import { normalizeVelocity, noteMidiToString } from "../Utils";
import { MidiLinkModel } from "../layout/Link";
import { MachineNodeModel } from "../layout/Node";
import { AbstractMachine, BuildVisualizers, CustomNodeWidgetProps, MachineFactory, MachineMessage, MachineTarget, MachineType, registeredMachine } from "./Machines";

interface ToneJsSynthConfig {

    readonly preset: string,
    readonly voice: any
}

@registeredMachine
export class ToneJsSynthMachine extends AbstractMachine implements MachineTarget {

    private synth: Tone.PolySynth;
    private static factory: MachineFactory;
    private config: ToneJsSynthConfig;
    public readonly destination: Tone.ToneAudioNode;

    getState() {

        return this.config;
    }

    setState(config: ToneJsSynthConfig) {

        const newSynth = new Tone.PolySynth(Tone.AMSynth, config.voice);

        this.config = config;
        this.synth.dispose();
        this.synth = newSynth.connect(this.destination);
    }

    constructor(config?: ToneJsSynthConfig) {

        super();
        this.config = config ?? voiceSamples[0];

        this.synth = new Tone.PolySynth(Tone.AMSynth, this.config.voice);
        this.destination = new Tone.Analyser();
        this.synth.connect(this.destination);
        this.destination.toDestination();
        this.getNode().addMachineInPort("In", 1);
    }

    static buildFactory(): MachineFactory {

        if (this.factory) {

            return this.factory;
        }

        this.factory = {

            createMachine(config?: ToneJsSynthConfig) { return new ToneJsSynthMachine(config); },
            createWidget(engine: DiagramEngine, node: MachineNodeModel): JSX.Element { return <ToneJsSynthNodeWidget engine={engine} size={50} machine={node.machine as ToneJsSynthMachine} />; },
            getName() { return "ToneJsSynthMachine"; },
            getType() { return MachineType.Output; },
            getTooltip() { return "Reads MIDI notes and emits sound"; },
            getMachineCode() { return "tonejssynth" }
        }

        return this.factory;
    }

    dispose() {
        
        this.synth.releaseAll();
        this.synth.disconnect();
        this.synth.dispose();
    }

    getFactory() { return ToneJsSynthMachine.factory; }

    receive(messageEvent: MachineMessage, _: number, link: MidiLinkModel): void {

        if (this.synth.disposed) {

            return;
        }

        switch(messageEvent.type) {

            case "stop":
                this.synth.releaseAll();
                link.setSending(true);
                break;

            case "noteon":
                link.setSending(true);
                if(messageEvent.message.rawData[2] === 0) {

                    this.synth.triggerRelease(noteMidiToString(messageEvent.message.rawData[1]));
                }
                else {

                    this.synth.triggerAttack(noteMidiToString(messageEvent.message.rawData[1]), Tone.context.currentTime, normalizeVelocity(messageEvent.message.rawData[2]));
                }

                break;

            case "noteoff":
                link.setSending(true);
                this.synth.triggerRelease(noteMidiToString(messageEvent.message.rawData[1]));
                break;
        }
    }

    getInChannelCount(): number {

        return 1;
    }
}

const ToneJsSynthNodeWidget: React.FunctionComponent<CustomNodeWidgetProps<ToneJsSynthMachine>> = props => {

    const [state, setState] = React.useState({

        inError: false,
        voiceConfig: props.machine.getState(),
        editVoice: JSON.stringify(props.machine.getState().voice, null, 2)});

    const [ open, setOpen ] = React.useState(false);

    const toggleVoiceInput = () => {

        setOpen(!open);
    };

    const resetVoiceInput = () => {

        updateVoice(JSON.stringify(state.voiceConfig.voice, null, 2), state.voiceConfig.preset);
    };

    function updateVoice(newVoice: string, preset: string) {

        let inError = true;

        try {

            const voice = JSON.parse(newVoice);
            const newConfig: ToneJsSynthConfig = { preset: preset, voice: voice }
            props.machine.setState(newConfig);
            inError = false;
        }
        catch {

        }

        const newState = {

            voiceConfig: props.machine.getState(),
            editVoice: newVoice,
            inError
        };

        setState(newState);
    }

    function setPreset(preset: string) {

        if (preset === "Custom") {

            return;
        }

        updateVoice(JSON.stringify(voiceSamples.filter(s => s.preset === preset)[0].voice, null, 2), preset);
    }

    const useAutosizeTextArea = (textAreaRef: HTMLTextAreaElement | null, value: string) => {

        React.useEffect(() => {

            if (textAreaRef) {

                textAreaRef.style.height = "0px";
                const scrollHeight = textAreaRef.scrollHeight;

                textAreaRef.style.height = scrollHeight + "px";

                textAreaRef.style.width = "0px";
                const scrollWidth = textAreaRef.scrollWidth + 5;

                textAreaRef.style.width = scrollWidth + "px";
            }
        }, [textAreaRef, value]);
    };

    const textAreaRef = React.useRef<HTMLTextAreaElement>(null);

    useAutosizeTextArea(textAreaRef.current, state.editVoice);

    const arrow = open ? '▲' : '▼';

    const [spectrogramRef, oscilloscopeRef] = BuildVisualizers(props.machine.destination as any as AudioNode);

    return (
        <S.SettingsBar>
            <div ref={spectrogramRef} />
            <div ref={oscilloscopeRef} />
            <S.ExpandButton open={open} onClick={toggleVoiceInput}>
                {arrow} Edit {state.voiceConfig.preset} {arrow}
            </S.ExpandButton>
            <S.InternalWrapper open={open}>
                <S.Dropdown>
                    <span>Preset: </span>
                    <select name="waveform"
                        value={state.voiceConfig.preset}
                        onChange={e => { setPreset(e.target.value) }}>
                        {voiceSamples.map(sample => <option key={sample.preset} value={sample.preset}>{sample.preset}</option>)}
                    </select>
                </S.Dropdown>
                <S.VoiceInput inError={state.inError}
                    value={state.editVoice}
                    onChange={i => updateVoice(i.target.value, "Custom")}
                    spellCheck={false}
                    ref={textAreaRef}
                    onKeyDown={i => { i.stopPropagation(); }} />
            </S.InternalWrapper>
            <button onClick={resetVoiceInput}
                disabled={!state.inError}>
                Reset
            </button>
        </S.SettingsBar>
    );
}

namespace S {

    export const ExpandButton = styled.button<{ open: boolean }>`
        background: ${(p) => p.open ? "rgb(7, 133, 116)" : "rgb(7, 81, 7)"};
        float: center;
        border: solid;
        border-width: 1px;
        border-color: rgb(60, 60, 60);
        color: white;
        outline: none;
        cursor: pointer;
        border-radius: 5px;
        transition: all 0.3s ease-in-out;
    `;

    export const Dropdown = styled.div`
        vertical-align: middle;
        width: 100%;
        span {

            vertical-align: middle;
        }
        input {

            vertical-align: middle;
        }
    `;

    export const VoiceInput = styled.textarea<{ inError: boolean }>`
        display: inline-block;
        border: solid 1px black;
        width: 100%;
        white-space: pre;
        max-width: auto;
        font-size: 11px;
        padding: 5px;
        overflow-wrap: normal;
        overscroll-behavior: contain;
        overflow-y: hidden;
        overflow-x: hidden;
        background-color: ${(props) => (props.inError ? '#ffe6e6' : 'white')};
    `;

    export const SettingsBar = styled.div`
        padding: 3px;
        position: relative;
        vertical-align: middle;
        width: auto;
        display: flex;
        justifyContent: "center";
        flex-direction: column;
    `;

    export const InternalWrapper = styled.div<{ open: boolean }>`
        width: 100%;
        height: ${(props) => (props.open ? 'auto' : '0')};
        overflow: hidden;
    `;
}

const voiceSamples: ToneJsSynthConfig[] = [
    {

        preset: "Default",
        voice: {

            "volume": 15,
            "detune": 0,
            "portamento": 0,
            "harmonicity": 2.5,
            "oscillator": {

                "partialCount": 0,
                "partials": [],
                "phase": 0,
                "type": "fatsawtooth",
                "count": 3,
                "spread": 20
            },
            "envelope": {

                "attack": 0.1,
                "attackCurve": "linear",
                "decay": 0.2,
                "decayCurve": "exponential",
                "release": 0.3,
                "releaseCurve": "exponential",
                "sustain": 0.2
            },
            "modulation": {

                "partialCount": 0,
                "partials": [],
                "phase": 0,
                "type": "square"
            },
            "modulationEnvelope": {

                "attack": 0.5,
                "attackCurve": "linear",
                "decay": 0.01,
                "decayCurve": "exponential",
                "release": 0.5,
                "releaseCurve": "exponential",
                "sustain": 1
            }
        }
    },
    {

        preset: "Harmonics",
        voice: {

            "harmonicity": 3.999,
            "oscillator": {

                "type": "square"
            },
            "envelope": {

                "attack": 0.03,
                "decay": 0.3,
                "sustain": 0.7,
                "release": 0.8
            },
            "modulation": {

                "volume": 12,
                "type": "square6"
            },
            "modulationEnvelope": {

                "attack": 2,
                "decay": 3,
                "sustain": 0.8,
                "release": 0.1
            }
        }
    },
    {

        preset: "Tiny",
        voice: {

            "harmonicity": 2,
            "oscillator": {

                "type": "amsine2",
                "modulationType": "sine",
                "harmonicity": 1.01
            },
            "envelope": {

                "attack": 0.006,
                "decay": 4,
                "sustain": 0.04,
                "release": 1.2
            },
            "modulation": {

                "volume": 13,
                "type": "amsine2",
                "modulationType": "sine",
                "harmonicity": 12
            },
            "modulationEnvelope": {

                "attack": 0.006,
                "decay": 0.2,
                "sustain": 0.2,
                "release": 0.4
            }
        }
    },
    {

        preset: "Bah",
        voice: {

            "volume": 10,
            "oscillator": {

                "type": "sawtooth"
            },
            "filter": {

                "Q": 2,
                "type": "bandpass",
                "rolloff": -24
            },
            "envelope": {

                "attack": 0.01,
                "decay": 0.1,
                "sustain": 0.2,
                "release": 0.6
            },
            "filterEnvelope": {

                "attack": 0.02,
                "decay": 0.4,
                "sustain": 1,
                "release": 0.7,
                "releaseCurve": "linear",
                "baseFrequency": 20,
                "octaves": 5
            }
        }
    },
    {

        preset: "BassGuitar",
        voice: {

            "oscillator": {

                "type": "fmsquare5",
                "modulationType": "triangle",
                "modulationIndex": 2,
                "harmonicity": 0.501
            },
            "filter": {

                "Q": 1,
                "type": "lowpass",
                "rolloff": -24
            },
            "envelope": {

                "attack": 0.01,
                "decay": 0.1,
                "sustain": 0.4,
                "release": 2
            },
            "filterEnvelope": {

                "attack": 0.01,
                "decay": 0.1,
                "sustain": 0.8,
                "release": 1.5,
                "baseFrequency": 50,
                "octaves": 4.4
            }
        }
    },
    {

        preset: "Bassy",
        voice: {

            "portamento": 0.08,
            "oscillator": {

                "partials": [2, 1, 3, 2, 0.4]
            },
            "filter": {

                "Q": 4,
                "type": "lowpass",
                "rolloff": -48
            },
            "envelope": {

                "attack": 0.04,
                "decay": 0.06,
                "sustain": 0.4,
                "release": 1
            },
            "filterEnvelope": {

                "attack": 0.01,
                "decay": 0.1,
                "sustain": 0.6,
                "release": 1.5,
                "baseFrequency": 50,
                "octaves": 3.4
            }
        }
    },
    {

        preset: "BrassCircuit",
        voice: {

            "portamento": 0.01,
            "oscillator": {

                "type": "sawtooth"
            },
            "filter": {

                "Q": 2,
                "type": "lowpass",
                "rolloff": -24
            },
            "envelope": {

                "attack": 0.1,
                "decay": 0.1,
                "sustain": 0.6,
                "release": 0.5
            },
            "filterEnvelope": {

                "attack": 0.05,
                "decay": 0.8,
                "sustain": 0.4,
                "release": 1.5,
                "baseFrequency": 2000,
                "octaves": 1.5
            }
        }
    },
    {

        preset: "CoolGuy",
        voice: {

            "oscillator": {

                "type": "pwm",
                "modulationFrequency": 1
            },
            "filter": {

                "Q": 6,
                "rolloff": -24
            },
            "envelope": {

                "attack": 0.025,
                "decay": 0.3,
                "sustain": 0.9,
                "release": 2
            },
            "filterEnvelope": {

                "attack": 0.245,
                "decay": 0.131,
                "sustain": 0.5,
                "release": 2,
                "baseFrequency": 20,
                "octaves": 7.2,
                "exponent": 2
            }
        }
    },
    {

        preset: "Pianoetta",
        voice: {

            "oscillator": {

                "type": "square"
            },
            "filter": {

                "Q": 2,
                "type": "lowpass",
                "rolloff": -12
            },
            "envelope": {

                "attack": 0.005,
                "decay": 3,
                "sustain": 0,
                "release": 0.45
            },
            "filterEnvelope": {

                "attack": 0.001,
                "decay": 0.32,
                "sustain": 0.9,
                "release": 3,
                "baseFrequency": 700,
                "octaves": 2.3
            }
        }
    },
    {

        preset: "Pizz",
        voice: {

            "oscillator": {

                "type": "sawtooth"
            },
            "filter": {

                "Q": 3,
                "type": "highpass",
                "rolloff": -12
            },
            "envelope": {

                "attack": 0.01,
                "decay": 0.3,
                "sustain": 0,
                "release": 0.9
            },
            "filterEnvelope": {

                "attack": 0.01,
                "decay": 0.1,
                "sustain": 0,
                "release": 0.1,
                "baseFrequency": 800,
                "octaves": -1.2
            }
        }
    },
    {

        preset: "AlienChorus",
        voice: {

            "oscillator": {

                "type": "fatsine4",
                "spread": 60,
                "count": 10
            },
            "envelope": {

                "attack": 0.4,
                "decay": 0.01,
                "sustain": 1,
                "attackCurve": "sine",
                "releaseCurve": "sine",
                "release": 0.4
            }
        }
    },
    {

        preset: "DelicateWindPart",
        voice: {

            "portamento": 0.0,
            "oscillator": {

                "type": "square4"
            },
            "envelope": {

                "attack": 2,
                "decay": 1,
                "sustain": 0.2,
                "release": 2
            }
        }
    },
    {

        preset: "DropPulse",
        voice: {

            "oscillator": {

                "type": "pulse",
                "width": 0.8
            },
            "envelope": {

                "attack": 0.01,
                "decay": 0.05,
                "sustain": 0.2,
                "releaseCurve": "bounce",
                "release": 0.4
            }
        }
    },
    {

        preset: "Lectric",
        voice: {

            "portamento": 0.2,
            "oscillator": {

                "type": "sawtooth"
            },
            "envelope": {

                "attack": 0.03,
                "decay": 0.1,
                "sustain": 0.2,
                "release": 0.02
            }
        }
    },
    {

        preset: "Marimba",
        voice: {

            "oscillator": {

                "partials": [
                    1,
                    0,
                    2,
                    0,
                    3
                ]
            },
            "envelope": {

                "attack": 0.001,
                "decay": 1.2,
                "sustain": 0,
                "release": 1.2
            }
        }
    },
    {

        preset: "Steelpan",
        voice: {

            "oscillator": {

                "type": "fatcustom",
                "partials": [0.2, 1, 0, 0.5, 0.1],
                "spread": 40,
                "count": 3
            },
            "envelope": {

                "attack": 0.001,
                "decay": 1.6,
                "sustain": 0,
                "release": 1.6
            }
        }
    },
    {

        preset: "SuperSaw",
        voice: {

            "oscillator": {

                "type": "fatsawtooth",
                "count": 3,
                "spread": 30
            },
            "envelope": {

                "attack": 0.01,
                "decay": 0.1,
                "sustain": 0.5,
                "release": 0.4,
                "attackCurve": "exponential"
            }
        }
    },
    {

        preset: "TreeTrunk",
        voice: {

            "oscillator": {

                "type": "sine"
            },
            "envelope": {

                "attack": 0.001,
                "decay": 0.1,
                "sustain": 0.1,
                "release": 1.2
            }
        }
    }
];
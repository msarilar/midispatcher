import * as React from 'react';
import * as Tone from "tone";
import styled from "@emotion/styled";
import { DiagramEngine } from "@projectstorm/react-diagrams";
import { SamplerOptions } from "tone";

import { AbstractMachine, BuildVisualizers, CustomNodeWidgetProps, MachineFactory, MachineMessage, MachineTarget, MachineType, registeredMachine, registeredMachineWithParameter } from "./Machines";
import { noteMidiToString } from "../Utils";
import { MidiLinkModel } from "../layout/Link";
import { MachineNodeModel } from "../layout/Node";

function getSamples(library: Instrument): Partial<SamplerOptions> | undefined {

    switch(library) {

        case "Drum":
            return {

                urls: {

                    "B1": "kick.mp3",
                    "C2": "kick.mp3",
                    "D2": "snare.mp3",
                    "F#2": "hihat.mp3",
                    "G#2": "hihat.mp3",
                    "A#2": "hihat.mp3"
                },
                release: 10,
                baseUrl: "https://tonejs.github.io/audio/drum-samples/CR78/"
            };
        case "Kalimba":
            return {

                urls: {

                    "G3": "Kalimba_1.mp3"
                },
                release: 10,
                baseUrl: "https://tonejs.github.io/audio/berklee/"
            };
        case "Guitar":
            return {

                urls: {

                    "A2": "guitar_Astring.mp3"
                },
                release: 10,
                baseUrl: "https://tonejs.github.io/audio/berklee/"
            };
        default:
            return getSamplesByName(library);
    }
}

const baseUrl = "https://nbrosowsky.github.io/tonejs-instruments/samples/";
function getSamplesByName(name: Instrument): Partial<SamplerOptions> {

    const baseNote = getBaseNote(name);
    return {

        urls: {

            [baseNote]: baseNote + ".mp3"
        },
        release: 5,
        baseUrl: baseUrl + name + "/"
    };
}

const allInstruments = [
    "Drum",
    "Kalimba",
    "Guitar",
    "bass-electric",
    "bassoon",
    "cello",
    "clarinet",
    "contrabass",
    "flute",
    "french-horn",
    "guitar-acoustic",
    "guitar-electric",
    "guitar-nylon",
    "harmonium",
    "harp",
    "organ",
    "piano",
    "saxophone",
    "trombone",
    "trumpet",
    "tuba",
    "violin",
    "xylophone"] as const;

type Instrument = (typeof allInstruments)[number];

function getBaseNote(name: Instrument): string {

    switch(name) {

        case "bassoon":
        case "cello":
        case "flute":
        case "french-horn":
        case "guitar-acoustic":
        case "guitar-electric":
        case "harmonium":
        case "organ":
        case "piano":
        case "saxophone":
        case "trombone":
        case "trumpet":
        case "violin":
            return "C4";
        case "guitar-nylon":
        case "harp":
            return "A4";
        case "bass-electric":
        case "contrabass":
            return "E3";
        case "tuba":
        case "clarinet":
            return "D3";
        case "xylophone":
            return "C5";

        default: return "A3";
    }
}

type FactoryDictionary = {

    [key in Instrument]?: MachineFactory;
};

@registeredMachine
@registeredMachineWithParameter<Instrument>("Drum")
export class ToneJsSampleMachine extends AbstractMachine implements MachineTarget {

    private sampler: Tone.Sampler;
    private sample: Instrument;
    public readonly destination: Tone.ToneAudioNode;
    private static factory: MachineFactory;
    private static factories: FactoryDictionary = {};

    constructor(sample: Instrument) {

        super();

        this.sample = sample;
        this.sampler = new Tone.Sampler(getSamples(sample));
        this.destination = new Tone.Analyser();
        this.sampler.connect(this.destination);
        this.destination.toDestination();

        this.getNode().addMachineInPort("In", 1);
    }

    setState(instrument: Instrument) {

        const opt = getSamples(instrument);
        const newSample = new Tone.Sampler(opt);
        this.sampler.dispose();
        this.sampler = newSample.connect(this.destination);
        this.sample = instrument;
    }

    getState() {

        return this.sample;
    }

    dispose() {

        this.sampler.releaseAll();
        this.sampler.disconnect();
        this.sampler.dispose();
    }

    static buildFactory(defaultInstrument?: Instrument): MachineFactory {

        if (defaultInstrument == undefined && this.factory) {

            return this.factory;
        }

        if (defaultInstrument != undefined && this.factories[defaultInstrument] != undefined) {

            return this.factories[defaultInstrument]!;
        }

        const newFactory = {

            createMachine(library?: Instrument) { return new ToneJsSampleMachine(library ?? defaultInstrument ?? "Guitar"); },
            createWidget(engine: DiagramEngine, node: MachineNodeModel): JSX.Element { return <ToneJsSampleNodeWidget engine={engine} size={50} machine={node.machine as ToneJsSampleMachine} />; },
            getName() { return "ToneJsSampleMachine" + (defaultInstrument == undefined ? "" : " (" + defaultInstrument + ")"); },
            getType() { return MachineType.Output; },
            getTooltip() { return "Reads MIDI notes and emits sound"; },
            getMachineCode() { return "sample" }
        };

        if (defaultInstrument == undefined) {

            this.factory = newFactory;
        }
        else {

            this.factories[defaultInstrument] = newFactory;
        }

        return newFactory;
    }

    getFactory() {

        return ToneJsSampleMachine.factory;
    }

    receive(messageEvent: MachineMessage, _: number, link: MidiLinkModel): void {

        if (!this.sampler.loaded) {

            return;
        }

        if (this.sampler.disposed) {

            return;
        }

        Tone.context.lookAhead = 0;
        switch(messageEvent.type) {

            case "stop":
                this.sampler.releaseAll();
                link.setSending(true);
                break;

            case "noteon":
                link.setSending(true);
                if(messageEvent.message.rawData[2] === 0) {

                    this.sampler.triggerRelease(noteMidiToString(messageEvent.message.rawData[1]));
                }
                else {

                    this.sampler.triggerAttack(noteMidiToString(messageEvent.message.rawData[1]), Tone.context.currentTime);
                }

                break;

            case "noteoff":
                link.setSending(true);
                this.sampler.triggerRelease(noteMidiToString(messageEvent.message.rawData[1]));
                break;
        }
    }

    getInChannelCount(): number {

        return 1;
    }
}

const ToneJsSampleNodeWidget: React.FunctionComponent<CustomNodeWidgetProps<ToneJsSampleMachine>> = props => {

    const [spectrogramRef, oscilloscopeRef] = BuildVisualizers(props.machine.destination as any as AudioNode);
    const [sample, setSample] = React.useState(props.machine.getState());

    function changeSample(s: string) {

        const newSample = s as Instrument;
        setSample(newSample);
        props.machine.setState(newSample);
    }

    return (
        <S.SettingsBar>
            <div ref={spectrogramRef}/>
            <div ref={oscilloscopeRef}/>
            <S.Dropdown>
                <span>Preset: </span>
                <select name="sampleSelection"
                        value={sample}
                        onChange={e => { changeSample(e.target.value) }}>
                    { allInstruments.map(instrument => <option key={instrument} value={instrument}>{instrument}</option>) }
                </select>
            </S.Dropdown>
        </S.SettingsBar>
    );
}

namespace S {

    export const SettingsBar = styled.div`
        padding: 3px;
        position: relative;
        vertical-align: middle;
        width: 100%;
        display: flex;
        justifyContent: "center";
        flex-direction: column;
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
}
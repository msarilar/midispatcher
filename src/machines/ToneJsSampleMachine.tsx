import * as React from 'react';
import * as Tone from "tone";
import { DiagramEngine } from "@projectstorm/react-diagrams";
import { SamplerOptions } from "tone";

import { S } from './MachineStyling';
import { AbstractMachine, CustomNodeWidgetProps, MachineFactory, MachineMessage, MachineTarget, MachineType, MessageResult, registeredMachine, registeredMachineWithParameter } from "./Machines";
import { normalizeVelocity, noteMidiToString } from "../Utils";
import { MidiLinkModel } from "../layout/Link";
import { MachineNodeModel } from "../layout/Node";
import { Visualizers } from './Visualizers';

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

interface ToneJsSampleMachineConfig {

    readonly sample: Instrument;
    readonly volume: number;
}

@registeredMachine
@registeredMachineWithParameter<Instrument>("Drum")
export class ToneJsSampleMachine extends AbstractMachine implements MachineTarget {

    private sampler: Tone.Sampler;
    private config: ToneJsSampleMachineConfig;
    public readonly analyzer: AnalyserNode;
    public readonly volume: Tone.Volume;
    private readonly gainForAnalyser: GainNode;
    private static factory: MachineFactory;
    private static factories: FactoryDictionary = {};

    constructor(config: ToneJsSampleMachineConfig) {

        super();

        this.config = config;
        this.sampler = new Tone.Sampler(getSamples(config.sample));

        this.volume = new Tone.Volume();
        this.sampler.connect(this.volume);

        this.volume.volume.value = this.config.volume;
        this.volume.mute = this.config.volume === -30;
        
        this.analyzer = Tone.context.createAnalyser();
        this.gainForAnalyser = Tone.context.createGain();
        this.gainForAnalyser.connect(this.analyzer);
        this.gainForAnalyser.gain.value = 1;
        this.sampler.connect(this.gainForAnalyser);
        this.volume.toDestination();

        this.getNode().addMachineInPort("In", 1);
    }

    setState(config: ToneJsSampleMachineConfig) {

        if (config.sample !== this.config.sample) {

            const newSample = new Tone.Sampler(getSamples(config.sample));
            this.sampler.dispose();
            this.sampler = newSample.connect(this.volume);
            this.sampler.connect(this.gainForAnalyser);
        }

        this.volume.volume.value = config.volume;
        this.volume.mute = config.volume === -30;

        this.config = config;
    }

    getState() {

        return this.config;
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

            createMachine(config?: ToneJsSampleMachineConfig) { return new ToneJsSampleMachine( config ?? { sample: defaultInstrument ?? "Guitar", volume: -15 }); },
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

    receive(messageEvent: MachineMessage, _: number) {

        if (!this.sampler.loaded) {

            return MessageResult.Ignored;
        }

        if (this.sampler.disposed) {

            return MessageResult.Ignored;
        }

        Tone.context.lookAhead = 0;
        switch(messageEvent.type) {

            case "stop":
                this.sampler.releaseAll();
                return MessageResult.Processed;

            case "allnotesoff":
            case "allsoundoff":
                this.sampler.releaseAll();
                return MessageResult.Processed;

            case "noteon":
                if (messageEvent.message.rawData[2] === 0) {

                    this.sampler.triggerRelease(noteMidiToString(messageEvent.message.rawData[1]));
                }
                else {

                    this.sampler.triggerAttack(noteMidiToString(messageEvent.message.rawData[1]), Tone.context.currentTime, normalizeVelocity(messageEvent.message.rawData[2]));
                }

                return MessageResult.Processed;

            case "noteoff":
                this.sampler.triggerRelease(noteMidiToString(messageEvent.message.rawData[1]));
                return MessageResult.Processed;
        }

        return MessageResult.Ignored;
    }

    getInChannelCount(): number {

        return 1;
    }
}

const ToneJsSampleNodeWidget: React.FunctionComponent<CustomNodeWidgetProps<ToneJsSampleMachine>> = props => {

    const [config, setSample] = React.useState(props.machine.getState());

    function update(s: ToneJsSampleMachineConfig) {

        props.machine.setState(s);
        setSample(props.machine.getState());
    }

    return (
        <S.SettingsBar>
            <S.Slider>
                <span>Volume: </span>
                <input
                    type="range"
                    min="-30.0"
                    max="5"
                    step="0.5"
                    value={config.volume}
                    onChange={e => { update({ ...config, volume: Number(e.target.value) }) }}
                    list="volumes"
                    name="volume" />
            </S.Slider>
            <Visualizers width={200} height={50} analyser={props.machine.analyzer as any as AnalyserNode} />
            <S.Dropdown>
                <span>Preset: </span>
                <select name="sampleSelection"
                        value={config.sample}
                        onChange={e => { update({ ...config, sample: e.target.value as Instrument}) }}>
                    { allInstruments.map(instrument => <option key={instrument} value={instrument}>{instrument}</option>) }
                </select>
            </S.Dropdown>
        </S.SettingsBar>
    );
}

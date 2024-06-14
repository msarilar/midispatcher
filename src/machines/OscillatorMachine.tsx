import { DiagramEngine } from "@projectstorm/react-diagrams-core";
import * as React from "react";
import * as Tone from "tone";

import { S } from "./MachineStyling";
import { MachineNodeModel } from "./../layout/Node";
import { AbstractMachine, CustomNodeWidgetProps, MachineFactory, MachineMessage, MachineModulable, MachineModulator, MachineTarget, MachineType, MessageResult, registeredMachine } from "./Machines";
import { AudioNodeVizualizer } from "./Visualizers";

type OscillatorMode = "carrier" | "operator";

interface OscillatorConfig {

    readonly mode: OscillatorMode;
    readonly volume: number;
    readonly waveform: OscillatorType;
    readonly detune: number;
    readonly filter: BiquadFilterType;
    readonly filterFrequency: number;
    readonly filterQ: number;
    readonly filterGain: number;
}

@registeredMachine
export class OscillatorMachine extends AbstractMachine implements MachineTarget, MachineModulable, MachineModulator {

    private static factory: MachineFactory;
    private readonly oscillators: { [frequency: number]: OscillatorNode } = {}
    private readonly mainGainNode: GainNode;
    public readonly filter: BiquadFilterNode;
    public readonly analyzer: AnalyserNode;
    private state: OscillatorConfig;
    private turnedOff: boolean = false;
    private operator: OscillatorNode | undefined;

    getFactory() { return OscillatorMachine.factory; }

    private applyFilterOptions(config: OscillatorConfig) {

        this.filter.type = config.filter;
        this.filter.frequency.value = config.filterFrequency;
        this.filter.Q.value = config.filterQ;
        this.filter.gain.value = config.filterGain;
    }

    constructor(config?: OscillatorConfig) {

        super();

        this.state = config ??
        {
            mode: "carrier",
            volume: 0.1,
            waveform: "square",
            detune: 0,
            filter: "lowpass",
            filterFrequency: 5000,
            filterQ: 1, // 0.0001 to 1000
            filterGain: 0 // -40 to 40
        };

        this.mainGainNode = Tone.getContext().createGain();
        this.analyzer = Tone.getContext().createAnalyser();
        this.filter = Tone.getContext().createBiquadFilter();


        this.analyzer.connect(this.mainGainNode);

        this.applyFilterOptions(this.state);
        this.filter.connect(this.analyzer);

        this.setState(this.state);

        this.getNode().addMachineInPort("MIDI In", 1);

        this.getNode().addModulationInput(this);
        this.getNode().addModulationOutput(this);
    }

    static buildFactory(): MachineFactory {

        if (this.factory) {

            return this.factory;
        }

        this.factory = {

            createMachine(config?: OscillatorConfig) { return new OscillatorMachine(config); },
            createWidget(engine: DiagramEngine, node: MachineNodeModel): JSX.Element { return <OscillatorNodeWidget engine={engine} size={50} machine={node.machine as OscillatorMachine} />; },
            getName() { return "Oscillator"; },
            getType() { return MachineType.Output; },
            getTooltip() { return "Reads MIDI notes and emits sound with basic filtering ability"; },
            getMachineCode() { return "oscillator" }
        }

        return this.factory;
    }

    getState() {

        return this.state;
    }

    setState(options: OscillatorConfig) {

        this.mainGainNode.gain.value = options.volume / 4;
        this.applyFilterOptions(options);

        if (this.state.detune !== options.detune) {

            this.stopAllOscillators();
        }

        if (this.state.mode !== options.mode) {

            this.stopAllOscillators();
            switch (options.mode) {
    
                case "carrier":
                    this.operator?.stop();
                    this.mainGainNode.connect(Tone.getContext().rawContext.destination);
                    break;
                case "operator":
                    this.mainGainNode.disconnect();
                    this.operator = Tone.getContext().createOscillator();
                    this.operator.connect(this.filter);
                    this.operator.type = this.state.waveform;
                    this.operator.start();
                    break;
            }
        }

        this.state = options;
    }

    stopAllOscillators(turnOff?: boolean) {

        Object.values(this.oscillators).forEach(oscillator => {

            oscillator.stop();
            oscillator.disconnect();
        });

        if (turnOff === true) {

            this.turnedOff = true;
        }
    }

    receive(messageEvent: MachineMessage, _: number) {

        if (this.turnedOff) {

            return MessageResult.Ignored;
        }

        const midiNote = messageEvent.message.rawData[1] + this.state.detune;

        if (messageEvent.message.type === "stop" ||
            messageEvent.message.type === "allnotesoff" ||
            messageEvent.message.type === "allsoundoff") {

            this.stopAllOscillators();
        }
        else if (messageEvent.message.type === "noteoff" ||
            (messageEvent.message.type === "noteon" && messageEvent.message.rawData[2] === 0)) {

            this.oscillators[midiNote]?.stop();
            this.oscillators[midiNote]?.disconnect();
        }
        else if (messageEvent.message.type === "noteon") {

            const osc = Tone.getContext().createOscillator();
            osc.connect(this.filter);
            osc.connect(this.mainGainNode);
            osc.frequency.value = getFrequency(midiNote);
            osc.type = this.state.waveform;

            this.oscillators[midiNote]?.stop();
            this.oscillators[midiNote]?.disconnect();
            this.oscillators[midiNote] = osc;
            this.oscillators[midiNote].start();
        }

        return MessageResult.Processed;
    }

    dispose() {

        this.stopAllOscillators();
    }

    getInChannelCount() {

        return 1;
    }
}

const OscillatorNodeWidget: React.FunctionComponent<CustomNodeWidgetProps<OscillatorMachine>> = props => {

    const [state, setState] = React.useState(props.machine.getState());

    function update(newState: OscillatorConfig) {

        props.machine.setState(newState);
        setState(newState);
    }

    return (
        <S.SettingsBar>
            <S.Dropdown>
                <span>Mode: </span>
                <select name="mode"
                    value={state.mode}
                    onChange={e => { update({ ...state, mode: e.target.value as OscillatorMode }) }}                    >
                    <option value="carrier">carrier</option>
                    <option value="operator">operator</option>
                </select>
            </S.Dropdown>
            <S.Slider>
                <span>Volume: </span>
                <input
                    type="range"
                    min="0.0"
                    max="0.5"
                    step="0.01"
                    value={state.volume}
                    onChange={e => { update({ ...state, volume: Number(e.target.value) }) }}
                    list="volumes"
                    name="volume" />
                <datalist id="volumes">
                    <option value="0.0" label="Mute"></option>
                    <option value="1.0" label="100%"></option>
                </datalist>
            </S.Slider>
            <AudioNodeVizualizer width={200} height={50} analyser={props.machine.analyzer} />
            <S.Dropdown>
                <span>Waveform: </span>
                <select name="waveform"
                    value={state.waveform}
                    onChange={e => { update({ ...state, waveform: e.target.value as OscillatorType }) }}                    >
                    <option value="sine">Sine</option>
                    <option value="square">Square</option>
                    <option value="sawtooth">Sawtooth</option>
                    <option value="triangle">Triangle</option>
                </select>
            </S.Dropdown>
            <S.Slider>
                <span>Detune ({state.detune})</span>
                <input
                    type="range"
                    min="-12.0"
                    max="12.0"
                    step="1"
                    value={state.detune}
                    onChange={e => { update({ ...state, detune: Number(e.target.value) }) }}
                    list="detunes"
                    name="detune" />
                <datalist id="detunes">
                    <option value="-12.0" label="-1 octave"></option>
                    <option value="0" label="Normal"></option>
                    <option value="12.0" label="+1 octave"></option>
                </datalist>
            </S.Slider>
            <S.Dropdown>
                <span>Filter: </span>
                <select name="waveform"
                    value={state.filter}
                    onChange={e => { update({ ...state, filter: e.target.value as BiquadFilterType }) }}                    >
                    <option value="lowpass">Lowpass</option>
                    <option value="highpass">Highpass</option>
                    <option value="bandpass">Bandpass</option>
                    <option value="peaking">Peaking</option>
                    <option value="notch">Notch</option>
                </select>
            </S.Dropdown>
            <S.Slider>
                <span>Filter Freq: </span>
                <input
                    type="range"
                    min="500"
                    max="5000"
                    step="1"
                    value={state.filterFrequency}
                    onChange={e => { update({ ...state, filterFrequency: Number(e.target.value) }) }}
                    list="filterFrequencies"
                    name="filterFrequency" />
                <datalist id="filterFrequencies">
                    <option value="5000" label="Default"></option>
                </datalist>
            </S.Slider>
            <S.Slider>
                <span>Filter Q: </span>
                <input
                    type="range"
                    min="1"
                    max="50"
                    step="1"
                    value={state.filterQ}
                    onChange={e => { update({ ...state, filterQ: Number(e.target.value) }) }}
                    list="filterQs"
                    name="filterQ" />
                <datalist id="filterQs">
                    <option value="1" label="Default"></option>
                </datalist>
            </S.Slider>
            <S.Slider>
                <span>Filter Gain: </span>
                <input
                    type="range"
                    min="-40"
                    max="40"
                    disabled={state.filter !== "lowshelf" && state.filter !== "highshelf" && state.filter !== "peaking"}
                    step="1"
                    value={state.filterGain}
                    onChange={e => { update({ ...state, filterGain: Number(e.target.value) }) }}
                    list="filterGains"
                    name="filterGain" />
                <datalist id="filterGains">
                    <option value="0" label="Default"></option>
                </datalist>
            </S.Slider>
        </S.SettingsBar>
    );
}

const frequencies: { [index: number]: number } = {}
function getFrequency(index: number) {

    if (!frequencies[index]) {

        frequencies[index] = 440 * Math.pow(2, (index - 69) / 12);
    }

    return frequencies[index];
}
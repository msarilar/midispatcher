import { Knob } from 'primereact/knob';
import React from "react";
import { DiagramEngine } from "@projectstorm/react-diagrams";

import { noteMidiToString, noteStringToNoteMidi, notesOff } from "../Utils";
import { AbstractMachine, CustomNodeWidgetProps, MachineFactory, MachineMessage, MachineSourceTarget, MachineType, MessageResult, registeredMachine } from "./Machines";
import { MachineNodeModel } from "../layout/Node";
import { S } from "./MachineStyling";

interface EuclidianSequence {

    offset: number;
    beats: number;
}

enum CombineOperator {

    OR = "OR",
    AND = "AND",
    XOR = "XOR",
    SUB = "SUB"
}

interface EuclidianSequencerConfig {

    steps: number;
    note: string;

    mainSequence: EuclidianSequence;
    secondarySequence: EuclidianSequence;

    combineOperator: CombineOperator;
}

const ON_SEQUENCE_INDEX_CHANGED = "onSequenceIndexChanged";

@registeredMachine
export class EuclidianSequencerMachine extends AbstractMachine implements MachineSourceTarget {

    private static factory: MachineFactory;

    private config: EuclidianSequencerConfig;

    private playing: boolean = false;
    private currentClock: number = 0;
    private currentIndex: number = 0;

    private mainBeats: boolean[] = [];
    private secondaryBeats: boolean[] = [];
    
    private noteOn: MachineMessage = { message: { rawData: noteStringToNoteMidi("C4"), isChannelMessage: true, type: "noteoff", channel: 0 }, type: "noteoff" };;
    private noteOff: MachineMessage = { message: { rawData: noteStringToNoteMidi("C4"), isChannelMessage: true, type: "noteoff", channel: 0 }, type: "noteoff" };
    private noteOnSent: boolean = false;

    private onSequenceIndexChanged: Event = new Event(ON_SEQUENCE_INDEX_CHANGED);
    
    getState() { return this.config; }

    getFactory() { return EuclidianSequencerMachine.factory; }

    static buildFactory(): MachineFactory {

        if (this.factory) {

            return this.factory;
        }

        this.factory = {

            createMachine(euclidianSequencerConfig?: EuclidianSequencerConfig): AbstractMachine {return new EuclidianSequencerMachine(euclidianSequencerConfig); },
            getType() { return MachineType.Emitter; },
            createWidget(engine: DiagramEngine, node: MachineNodeModel): JSX.Element { return <EuclidianSequencerNodeWidget engine={engine} size={50} machine={node.machine as EuclidianSequencerMachine} />; },
            getName(): string { return "EuclidianSequencer"; },
            getTooltip() { return ""; },
            getMachineCode() { return "euclidiansequencer" }
        }

        return this.factory;
    }

    sanitizeAndApplyConfig(config: EuclidianSequencerConfig) {

        if (this.currentIndex >= config.steps) {

            this.currentIndex = 0;
        }

        if (config.mainSequence.beats > config.steps) {

            config.mainSequence.beats = config.steps;
        }

        if (config.secondarySequence.beats > config.steps) {

            config.secondarySequence.beats = config.steps;
        }

        if (config.note !== this.config.note && this.noteOnSent) {

            this.emit(this.noteOff, 0);
        }

        this.config = config;

        this.noteOn = { message: { rawData: noteStringToNoteMidi(this.config.note), isChannelMessage: true, type: "noteon", channel: 0 }, type: "noteon" };
        this.noteOff = { message: { rawData: noteStringToNoteMidi(this.config.note), isChannelMessage: true, type: "noteoff", channel: 0 }, type: "noteoff" };
        
        this.mainBeats = EuclidianSequencerMachine.distributeBeats(config.mainSequence.beats, config.steps, config.mainSequence.offset);
        this.secondaryBeats = EuclidianSequencerMachine.distributeBeats(config.secondarySequence.beats, config.steps, config.secondarySequence.offset);
    }

    constructor(config?: EuclidianSequencerConfig) {

        super();

        if (config == undefined) {

            config = {            

                steps: 16,
                note: "C4",

                mainSequence: { offset: 0, beats: 4 },
                secondarySequence: { offset: 0, beats: 0 },
                combineOperator: CombineOperator.OR
            };
        }
        
        this.config = config;
        this.sanitizeAndApplyConfig(config);

        this.getNode().addMachineOutPort("Out", 0);
        this.getNode().addMachineInPort("Clock", 0);
    }

    private shouldPlayNow() {

        return this.shouldPlay(this.mainBeats[this.currentIndex], this.secondaryBeats[this.currentIndex]);
    }

    private shouldPlay(main: boolean, secondary: boolean) {

        switch (this.config.combineOperator) {

            case CombineOperator.AND:
                return main && secondary;

            case CombineOperator.OR:
                return main || secondary;

            case CombineOperator.SUB:
                return main && !secondary;

            case CombineOperator.XOR:
                return main !== secondary;
        }
    }
    
    sequenceIndexKind(index: number): [playing: boolean, mainSequenceBeat: boolean, secondarySequenceBeat: boolean, shouldPlay: boolean] {

        return [this.playing && this.currentIndex === index, this.mainBeats[index], this.secondaryBeats[index], this.shouldPlay(this.mainBeats[index], this.secondaryBeats[index])];
    }

    receive(messageEvent: MachineMessage, _: number): MessageResult {

        switch (messageEvent.message.type) {
            
            case "clock":
                if (!this.playing) {
                    
                    return MessageResult.Ignored;
                }

                this.currentClock += 1;

                if (this.currentClock % 6 === 0) {

                    this.currentIndex = (this.currentIndex + 1) % this.config.steps;
                    this.dispatchEvent(this.onSequenceIndexChanged);
                    this.currentClock = 0;

                    if (this.shouldPlayNow()) {

                        this.emit(this.noteOn, 0);
                        this.noteOnSent = true;
                    }
                    else if (this.noteOnSent) {
    
                        this.emit(this.noteOff, 0);
                        this.noteOnSent = false;
                    }
                }

                return MessageResult.Processed;

            case "continue":
                this.playing = true;
                
                this.dispatchEvent(this.onSequenceIndexChanged);
                if (this.shouldPlayNow()) {

                    this.emit(this.noteOn, 0);
                    this.noteOnSent = true;
                }

                return MessageResult.Processed;

            case "start":
                this.playing = true;
                this.currentClock = 0;
                this.currentIndex = 0;
                
                this.dispatchEvent(this.onSequenceIndexChanged);
                if (this.shouldPlayNow()) {

                    this.emit(this.noteOn, 0);
                    this.noteOnSent = true;
                }

                return MessageResult.Processed;

            case "stop":
                this.playing = false;
                this.dispatchEvent(this.onSequenceIndexChanged);
                if (this.noteOnSent) {

                    this.emit(this.noteOff, 0);
                    this.noteOnSent = false;
                }

                return MessageResult.Processed;
        }

        return MessageResult.Ignored;
    }

    private static distributeBeats(beats: number, steps: number, offset: number): boolean[] {

        let pattern: boolean[] = new Array<boolean>(steps).fill(false);

        if (beats <= 0 || steps <= 0 || beats > steps) {

            return pattern;
        }

        if (offset < 0) {

            offset = steps + offset;
        }

        pattern[offset] = true;
        let previous = 0;

        for (let i = 1; i < steps; i++) {

            const index = (i + offset) % steps;
            const current = Math.floor((beats * i) / steps);

            if (current - previous === 1) {

                pattern[index] = true;
            }

            previous = current;

        }

        return pattern;
    }
}

const EuclidianSequencerNodeWidget: React.FunctionComponent<CustomNodeWidgetProps<EuclidianSequencerMachine>> = props => {
    
    const squareSize = 10;
    function computeSequencerDimensions(config: EuclidianSequencerConfig): [width: number, height: number] {

        const rows = Math.ceil(config.steps / 8);
        const columns = Math.min(config.steps, 8);

        return [columns * squareSize * 2, rows * squareSize * 2];
    }

    const [config, setConfig] = React.useState(props.machine.getState());
    const [[sequencerWidth, sequencerHeight], setSequencerDimensions] = React.useState(computeSequencerDimensions(config));

    function update(newConfig: EuclidianSequencerConfig) {

        props.machine.sanitizeAndApplyConfig(newConfig);
        setConfig(props.machine.getState());
        const [newSequencerWidth, newSequencerHeight] = computeSequencerDimensions(props.machine.getState());
        setSequencerDimensions([newSequencerWidth, newSequencerHeight]);

        const sequencer = sequencerCanvasRef.current?.getContext("2d") ?? undefined;
        requestAnimationFrame(function() { drawSequencer(sequencer, newSequencerWidth, newSequencerHeight); });
    }

    const sequencerCanvasRef = React.useRef<HTMLCanvasElement>(null);

    const drawSequencer = function (sequencer: CanvasRenderingContext2D | undefined, sequencerWidth: number, sequencerHeight: number) {

        if (sequencer == undefined) {

            return;
        }

        const config = props.machine.getState();

        sequencer.fillStyle = "rgb(0,0,0)";
        sequencer.fillRect(0, 0, sequencerWidth, sequencerHeight);
        for (let y = 0; y < Math.ceil(config.steps / 8); y++) {

            for (let x = 0; x < Math.min(config.steps - y * 8, 8); x++) {

                const [playing, main, secondary, shouldPlay] = props.machine.sequenceIndexKind(y * 8 + x);
                const baseNumber = playing ? 200 : 100;
                sequencer.fillStyle = "rgb(" + (secondary ? 255 : baseNumber) + "," + baseNumber + "," + (main ? 255 : baseNumber) + ")";
                sequencer.fillRect(x * (squareSize * 2) + (squareSize / 2), y * (squareSize * 2) + (squareSize / 2), squareSize, squareSize);
                
                if (shouldPlay) {

                    sequencer.strokeStyle = playing ? "rgb(0,0,0)" : "rgb(255,255,255)";
                    sequencer.strokeRect(x * (squareSize * 2) + (squareSize / 2), y * (squareSize * 2) + (squareSize / 2), squareSize, squareSize);
                }
            }
        }
    }

    React.useEffect(() => {

        const sequencer = sequencerCanvasRef.current?.getContext("2d") ?? undefined;
        drawSequencer(sequencer, sequencerWidth, sequencerHeight);
        
        const onSequenceIndexChanged = () => {

            requestAnimationFrame(function() { drawSequencer(sequencer, sequencerWidth, sequencerHeight); })
        }

        props.machine.addEventListener(ON_SEQUENCE_INDEX_CHANGED, onSequenceIndexChanged);
        return (() => { props.machine.removeEventListener(ON_SEQUENCE_INDEX_CHANGED, onSequenceIndexChanged) } );
    }, [props.machine]);

    return (
        <S.SettingsBar>
            <span>Steps: {config.steps}</span>
            <S.Slider>
                <input
                    type="range"
                    min="4"
                    max="64"
                    step="1"
                    value={config.steps}
                    onChange={e => { update({ ...config, steps: Number(e.target.value) }) }}
                    list="steps"
                    name="steps" />
            </S.Slider>
            <span>Beats A: {config.mainSequence.beats}</span>
            <S.SettingsBarVertical>
                <S.Slider>
                    <input
                        type="range"
                        min="0"
                        max={config.steps}
                        step="1"
                        value={config.mainSequence.beats}
                        onChange={e => { update({ ...config, mainSequence: { ...config.mainSequence, beats: Number(e.target.value) }}) }}
                        list="beats1"
                        name="beats1" />
                </S.Slider>
                <Knob
                    value={config.mainSequence.offset}
                    min={-1 * config.steps / 2}
                    max={config.steps / 2}
                    size={35}
                    valueColor={"SlateGray"}
                    rangeColor={"MediumTurquoise"}
                    textColor={"White"}
                    strokeWidth={23}
                    onChange={e => { update({ ...config, mainSequence: { ...config.mainSequence, offset: Number(e.value) }}) }} />
            </S.SettingsBarVertical>
            <span>Beats B: {config.secondarySequence.beats}</span>
            <S.SettingsBarVertical>
                <S.Slider>
                    <input
                        type="range"
                        min="0"
                        max={config.steps}
                        step="1"
                        value={config.secondarySequence.beats}
                        onChange={e => { update({ ...config, secondarySequence: { ...config.secondarySequence, beats: Number(e.target.value) }}) }}
                        list="beats1"
                        name="beats1" />
                </S.Slider>
                <Knob
                    value={config.secondarySequence.offset}
                    min={-1 * config.steps / 2}
                    max={config.steps / 2}
                    size={35}
                    valueColor={"SlateGray"}
                    rangeColor={"MediumTurquoise"}
                    textColor={"White"}
                    strokeWidth={23}
                    onChange={e => { update({ ...config, secondarySequence: { ...config.secondarySequence, offset: Number(e.value) }}) }} />
            </S.SettingsBarVertical>
            <S.SettingsBarVertical>
                <S.Dropdown>
                    <select name="combineOperatorSelection"
                            value={config.combineOperator}
                            onChange={e => { update({ ...config, combineOperator: e.target.value as CombineOperator}) }}>
                        { Object.keys(CombineOperator).map(combineOperator => <option key={combineOperator} value={combineOperator}>{combineOperator}</option>) }
                    </select>
                </S.Dropdown>
                <S.Dropdown>
                    <select name="noteSelection"
                            value={config.note}
                            onChange={e => { update({ ...config, note: e.target.value}) }}>
                        { notesOff.map(arr => <option key={arr[1]} value={noteMidiToString(arr[1])}>{noteMidiToString(arr[1])}</option>) }
                    </select>
                </S.Dropdown>
            </S.SettingsBarVertical>
            <canvas ref={sequencerCanvasRef} width={sequencerWidth} height={sequencerHeight} />
        </S.SettingsBar>
    );
}
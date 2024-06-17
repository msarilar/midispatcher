import { DiagramEngine } from "@projectstorm/react-diagrams-core";
import * as React from "react";

import { S } from "./MachineStyling";
import { MachineNodeModel } from "./../layout/Node";
import { AbstractMachine, CustomNodeWidgetProps, MachineFactory, MachineMessage, MachineSourceTarget, MachineType, MessageResult, registeredMachine } from "./Machines";
import { noteMidiToString, noteStringToNoteMidi, notesOff, scalesOffsets, standardMidiMessages } from "../Utils";

interface ScaleConfig {

    scaleName: string;
    rootNote: string;
}

const ON_ROOT_NOTE_CHANGED = "onRootNoteChanged";

@registeredMachine
export class ScaleMachine extends AbstractMachine implements MachineSourceTarget {

    static factory: MachineFactory;
    private config: ScaleConfig;
    private onRootNoteChanged: Event = new Event(ON_ROOT_NOTE_CHANGED);

    getFactory() { return ScaleMachine.factory; }

    constructor(config?: ScaleConfig) {

        super();

        this.config = config ?? {
            scaleName: "Chromatic",
            rootNote: "C3"
        };
        this.getNode().addMachineOutPort("Out", 0);
        this.getNode().addMachineInPort("In", 0);
        this.getNode().addMachineInPort("Root Note Control", 1);
    }

    getState() {

        return this.config;
    }

    static buildFactory(): MachineFactory {

        if (this.factory) {

            return this.factory;
        }

        this.factory = {

            createMachine(thruConfig?: ScaleConfig) { return new ScaleMachine(thruConfig); },
            createWidget(engine: DiagramEngine, node: MachineNodeModel): JSX.Element { return <ScaleNodeWidget engine={engine} machine={node.machine as ScaleMachine} />; },
            getName() { return "Scale"; },
            getType() { return MachineType.Processor; },
            getTooltip() { return "Reads notes and force them onto selected scale with the chosen base note"; },
            getMachineCode() { return "scale" }
        };

        return this.factory;
    }

    setState(options: ScaleConfig) {

        if (options.rootNote !== this.config.rootNote || options.scaleName !== this.config.scaleName) {

            this.emit(standardMidiMessages["allnotesoff"], 0);
        }

        this.config = options;
    }

    receive(messageEvent: MachineMessage, channel: number): MessageResult {

        if (channel === 1 && messageEvent.message.type === "noteon") {

            this.setState({ ...this.config, rootNote: noteMidiToString(messageEvent.message.rawData[1])});
            this.dispatchEvent(this.onRootNoteChanged);
        }
        else if (messageEvent.message.type === "noteon" || messageEvent.message.type === "noteoff") {

            messageEvent = { ...messageEvent, message: { ...messageEvent.message, rawData: new Uint8Array(messageEvent.message.rawData) } };

            const scale = scalesOffsets[this.config.scaleName];
            const diff = messageEvent.message.rawData[1] - noteStringToNoteMidi(this.config.rootNote)[1];

            const toAdd = Math.floor(diff / scale.length) * 12 + scale[(diff % scale.length + scale.length) % scale.length];
            messageEvent.message.rawData[1] = (noteStringToNoteMidi(this.config.rootNote)[1] + toAdd) % 255;
        }

        this.emit(messageEvent, channel);
        return MessageResult.Processed;
    }
}

const ScaleNodeWidget: React.FunctionComponent<CustomNodeWidgetProps<ScaleMachine>> = props => {

    const [state, setState] = React.useState(props.machine.getState());
    const [notes, setNotes] = React.useState(scalesOffsets[state.scaleName].map(value => noteMidiToString(noteStringToNoteMidi(state.rootNote)[1] + value)));

    const update = (newState: ScaleConfig) => {

        props.machine.setState(newState);
        const state = props.machine.getState();
        const notes = scalesOffsets[state.scaleName].map(value => noteMidiToString(noteStringToNoteMidi(state.rootNote)[1] + value));
        setNotes(notes);
        setState(state);
    }

    React.useEffect(() => {
        const onRootNoteChanged = () => {

            update({ ...state, scaleName: props.machine.getState().scaleName, rootNote: props.machine.getState().rootNote });
        }

        props.machine.addEventListener(ON_ROOT_NOTE_CHANGED, onRootNoteChanged);
        return (() => { props.machine.removeEventListener(ON_ROOT_NOTE_CHANGED, onRootNoteChanged) } );
    }, [props.machine]);

    return (
        <S.SettingsBar>
            <S.Dropdown>
                <span>scale type: </span>
                <select name="scaleName"
                    value={state.scaleName}
                    onChange={e => { update({ ...state, scaleName: e.target.value }) }}>
                    { Object.keys(scalesOffsets).map(scale => <option key={scale} value={scale}>{scale}</option>) }
                </select>
            </S.Dropdown>
            <S.Dropdown>
                <span>root note: </span>
                <select name="rootnote"
                    value={state.rootNote}
                    onChange={e => { update({ ...state, rootNote: e.target.value }) }}>
                        { notesOff.map(arr => <option key={arr[1]} value={noteMidiToString(arr[1])}>{noteMidiToString(arr[1])}</option>) }
                </select>
            </S.Dropdown>
            {notes.map(note => <p>{note}</p>)}
        </S.SettingsBar>
    );
}
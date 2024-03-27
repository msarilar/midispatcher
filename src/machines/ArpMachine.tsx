import { DiagramEngine } from "@projectstorm/react-diagrams-core";
import * as React from "react";
import { AddBox, Clear, VolumeOff, VolumeUp } from "@mui/icons-material";
import { Checkbox, IconButton, Slider } from "@mui/material";

import { allNotes, noteMidiToStringSeparated, noteStringToNoteMidi, standardMidiMessages } from "../Utils";
import { MachineNodeModel } from "./../layout/Node";
import { S } from "./MachineStyling";
import { AbstractMachine, CustomNodeWidgetProps, MachineFactory, MachineMessage, MachineSourceTarget, MachineType, MessageResult, registeredMachine } from "./Machines";

type ArpStyle = "up" | "down" | "updown" | "updown2" | "random";

type ArpMode = "predefined" | "keyboard";

interface NoteConfig {

    noteValue: string;
    octave: number;
    muted: boolean;
}

interface ArpConfig {

    predefinedNotes: NoteConfig[];
    keyboardNotes: NoteConfig[];
    notesToPlay: NoteConfig[];
    octaves: number;
    arpStyle: ArpStyle;
    arpMode: ArpMode;
}


@registeredMachine
export class ArpMachine extends AbstractMachine implements MachineSourceTarget {

    private static factory: MachineFactory;
    private config: ArpConfig;
    getFactory() { return ArpMachine.factory; }

    private arpIndex = 0;
    private clockIndex = 0;

    static buildFactory(): MachineFactory {

        if (this.factory) {

            return this.factory;
        }

        this.factory = {

            createMachine(arpConfig?: ArpConfig): AbstractMachine {

                return new ArpMachine(arpConfig);
            },
            getName(): string { return "ArpMachine"; },
            createWidget(engine: DiagramEngine, node: MachineNodeModel) { return <ArpNodeWidget engine={engine} size={50} machine={node.machine as ArpMachine} />; },
            getType() { return MachineType.Emitter; },
            getTooltip() { return "Reads CLOCK message and sends out arpeggiated notes ; add notes to the arpeggiato with the + button"; },
            getMachineCode() { return "arp" }
        }

        return this.factory;
    }

    constructor(config?: ArpConfig) {

        super();

        if (config == undefined) {

            this.config = { arpMode: "predefined", keyboardNotes: [], predefinedNotes: [{ muted: false, noteValue: "C", octave: 3 }, { muted: false, noteValue: "E", octave: 3 }, { muted: false, noteValue: "G", octave: 3 }], octaves: 1, arpStyle: "up", notesToPlay: [] };
            this.setState(this.config);
        }
        else {

            this.config = config;
        }

        this.getNode().addMachineInPort("Clock", 0);
        this.getNode().addMachineOutPort("Out", 0);
    }

    private applyArpStyle(arpStyle: ArpStyle, notes: NoteConfig[]) {

        switch (arpStyle) {

            case "down":
                return notes.reverse();
            case "updown":
                const reversed = notes.slice();
                reversed.shift();
                reversed.reverse();
                reversed.shift();
                return notes.concat(reversed);
            case "updown2":
                return notes.concat(notes.slice().reverse());
            default:
            case "random":
            case "up":
                return notes;
        }
    }

    setState(config: ArpConfig, newKeyboardNotes?: NoteConfig[]) {

        const notes = config.arpMode == "predefined" ? config.predefinedNotes.slice() : (newKeyboardNotes ?? this.config.keyboardNotes).slice();

        for (let i = 1; i < config.octaves; i++) {

            notes.slice().forEach(note => notes.push({ noteValue: note.noteValue, muted: note.muted, octave: note.octave + i }));
        }

        const notesToPlay = this.applyArpStyle(config.arpStyle, notes);
        if (this.arpIndex >= notesToPlay.length) {

            this.arpIndex = Math.max(0, notesToPlay.length - 1);
        }

        if (config.arpMode == "predefined") {

            if (this.config.predefinedNotes.length !== config.predefinedNotes.length) {
                
                this.clockIndex = 0;
                this.arpIndex = 0;
                if (this.previousNote != undefined) {

                    this.emit({ message: { rawData: this.previousNote, isChannelMessage: true, type: "noteoff", channel: 0 }, type: "noteoff" }, 0);
                }

                this.emit(standardMidiMessages["allnotesoff"], 0);
            }
        }
        else {

            this.arpIndex = Math.min(this.arpIndex, notesToPlay.length);
        }

        if(notesToPlay.length === 0) {
            
            if (this.previousNote != undefined) {

                this.emit({ message: { rawData: this.previousNote, isChannelMessage: true, type: "noteoff", channel: 0 }, type: "noteoff" }, 0);
            }

            this.emit(standardMidiMessages["allnotesoff"], 0);
        }

        this.config = { ...config, keyboardNotes: newKeyboardNotes ?? this.config.keyboardNotes, notesToPlay: notesToPlay };
    }

    getState() {

        return this.config;
    }

    removeKeyboardNote([noteValue, octave]: [string, number]) {

        this.setState(this.config, this.config.keyboardNotes.filter(f => f.noteValue != noteValue || f.octave != octave));
    }

    addKeyboardNote([noteValue, octave]: [string, number]) {

        this.setState(this.config, this.config.keyboardNotes.concat({ noteValue: noteValue, octave: octave, muted: false }));
    }

    private previousNote: Uint8Array | undefined;

    receive(messageEvent: MachineMessage, _: number): MessageResult {

        switch (messageEvent.type) {

            case "start":
                this.emit(messageEvent, 0);
                this.arpIndex = 0;
                return MessageResult.Processed;
            case "stop":
                this.clockIndex = 0;
                if (this.previousNote != undefined) {

                    this.emit({ message: { rawData: this.previousNote, isChannelMessage: true, type: "noteoff", channel: 0 }, type: "noteoff" }, 0);
                }

                this.emit(messageEvent, 0);
                return MessageResult.Processed;
            case "clock":
                const notes = this.config.arpMode == "predefined" ? this.config.predefinedNotes : this.config.keyboardNotes;
                const max = Math.floor(24 / notes.length);
                if (notes.length !== 0 && this.emit != undefined) {

                    this.clockIndex = (this.clockIndex + 1) % max;
                    if (this.clockIndex === 0) {

                        const noteData = this.config.notesToPlay[this.arpIndex];

                        if (this.previousNote != undefined) {

                            this.emit({ message: { rawData: this.previousNote, isChannelMessage: true, type: "noteoff", channel: 0 }, type: "noteoff" }, 0);
                        }

                        this.arpIndex = this.config.arpStyle === "random"
                            ? Math.floor(Math.random() * this.config.notesToPlay.length)
                            : (this.arpIndex + 1) % this.config.notesToPlay.length;

                        if (!noteData.muted) {

                            const data = noteStringToNoteMidi(noteData.noteValue + noteData.octave);

                            this.emit({ message: { rawData: data, isChannelMessage: true, type: "noteon", channel: 0 }, type: "noteon" }, 0);
                            this.previousNote = data;
                        }
                    }
                }

                return MessageResult.Processed;
            case "noteon":
                if (messageEvent.message.rawData[2] === 0) {

                    this.removeKeyboardNote(noteMidiToStringSeparated(messageEvent.message.rawData[1]));
                }
                else {

                    this.addKeyboardNote(noteMidiToStringSeparated(messageEvent.message.rawData[1]));
                }
                
                return MessageResult.Processed;
            case "noteoff":
                this.removeKeyboardNote(noteMidiToStringSeparated(messageEvent.message.rawData[1]));
                return MessageResult.Processed;
            default:
                return MessageResult.Ignored;
        }
    }
}

const ArpNodeWidget: React.FunctionComponent<CustomNodeWidgetProps<ArpMachine>> = props => {

    const [config, setConfig] = React.useState(props.machine.getState());

    function update(newConfig: ArpConfig) {

        props.machine.setState(newConfig);
        setConfig(newConfig);
    }

    function noteToIndex(note: string) {

        return allNotes.indexOf(note);
    }

    const notesRender = () => config.predefinedNotes.map((note, i) =>
        <S.Note key={i}>
            <Slider
                sx={{

                    "& input[type='range']": {

                        WebkitAppearance: "slider-vertical",
                    },
                }}
                step={1}
                style={{ marginTop: 10, marginBottom: 10 }}
                orientation="vertical"
                defaultValue={0}
                max={11}
                value={noteToIndex(note.noteValue)}
                valueLabelDisplay="off"
                onChange={(_, v) => {

                    if (typeof v === "number") {

                        config.predefinedNotes[i].noteValue = allNotes[v];
                        update({ ...config, predefinedNotes: config.predefinedNotes })
                    }
                }}
            />
            <S.SettingsBarVertical
                style={{ margin: 0, padding: 0 }}>
                <Checkbox aria-label="add note"
                    icon={<VolumeOff />}
                    style={{ margin: 0, padding: 0 }}
                    checkedIcon={<VolumeUp />}
                    checked={!note.muted}
                    onChange={e => {

                        config.predefinedNotes[i].muted = !e.target.checked;
                        update({ ...config, predefinedNotes: config.predefinedNotes });
                    }} />
                <IconButton aria-label="remove note"
                    color="error"
                    size="small"
                    style={{ margin: 0, padding: 0 }}
                    onClick={() => {

                        config.predefinedNotes.splice(i, 1);
                        update({ ...config, predefinedNotes: config.predefinedNotes });
                    }
                    }>
                    <Clear />
                </IconButton>
            </S.SettingsBarVertical>
            {note.noteValue + note.octave}
        </S.Note>);

    const predefinedConfig = config.arpMode === "predefined" ?
            <S.SettingsBarVertical>
                {notesRender()}
            <IconButton aria-label="add note"
                color="primary"
                onClick={() => update({ ...config, predefinedNotes: config.predefinedNotes.concat({ muted: false, noteValue: "C", octave: 3 }) })}>
                <AddBox />
            </IconButton>
        </S.SettingsBarVertical>
        : undefined;


    return (
        <S.SettingsBarHorizontal>
            <S.Dropdown>
                <span>Mode: </span>
                <select name="arpmode"
                    value={config.arpMode}
                    onChange={e => { update({ ...config, arpMode: e.target.value as ArpMode }) }}                    >
                    <option value="predefined">Predefined</option>
                    <option value="keyboard">Keyboard</option>
                </select>
            </S.Dropdown>
            {predefinedConfig}
            {config.octaves + " octaves"}
            <Slider aria-label="Octaves"
                min={1}
                max={4}
                onChange={(_, v) => {

                    if (typeof v === "number") {

                        update({ ...config, octaves: v })
                    }
                }}
                value={config.octaves} />
            <S.Dropdown>
                <span>Style: </span>
                <select name="arpstyle"
                    value={config.arpStyle}
                    onChange={e => { update({ ...config, arpStyle: e.target.value as ArpStyle }) }}                    >
                    <option value="up">Up</option>
                    <option value="down">Down</option>
                    <option value="updown">UpDown</option>
                    <option value="updown2">UpDown2</option>
                    <option value="random">Random</option>
                </select>
            </S.Dropdown>
        </S.SettingsBarHorizontal>
    );
}

import React from "react";
import { Box, Checkbox, FormControlLabel, TextField } from "@mui/material";
import { DiagramEngine } from "@projectstorm/react-diagrams";

import { S } from './MachineStyling';
import { AbstractMachine, CustomNodeWidgetProps, MachineFactory, MachineMessage, MachineSourceTarget, MachineType, MessageResult, registeredMachine } from "./Machines";
import { AllLinkCode } from "../layout/Engine";
import { MidiLinkModel } from "../layout/Link";
import { noteStringToNoteMidi, standardMidiMessages } from "../Utils";
import { ToggleOff, ToggleOnRounded } from "@mui/icons-material";
import { MachineNodeModel } from "../layout/Node";

interface NoteSplitConfig {

    readonly editNote: string;
    readonly noteThreshold: string;
    readonly broadcastNonNotes: boolean;
    readonly active: boolean;
} 

@registeredMachine
export class NoteSplitMachine extends AbstractMachine implements MachineSourceTarget {

    setState(newConfig: NoteSplitConfig) {
        
        try {

            noteStringToNoteMidi(newConfig.editNote);
            newConfig = { ...newConfig, noteThreshold: newConfig.editNote };

            if (newConfig.noteThreshold !== this.config.noteThreshold) {

                this.emit(standardMidiMessages["allnotesoff"], 1);
                this.emit(standardMidiMessages["allnotesoff"], 2);
            }
        }
        catch {
            // couldn't parse the edit note
        }

        this.config = newConfig;
    }

    private config: NoteSplitConfig;
    private static factory: MachineFactory;
    static buildFactory(): MachineFactory {

        if (this.factory) {

            return this.factory;
        }

        this.factory = {

            createMachine(config?: NoteSplitConfig) {

                return new NoteSplitMachine(config);
            },
            createWidget(engine: DiagramEngine, node: MachineNodeModel) { return <NoteSplitNodeWidget engine={engine} size={50} machine={node.machine as NoteSplitMachine} />; },
            getType() { return MachineType.Processor; },
            getName() { return "NoteSplitMachine"; },
            getTooltip() { return "Reads notes then dispatches them over 2 channels depending on whether they're above or below a threshold"; },
            getMachineCode() { return "split" }
        }

        return this.factory;
    }

    constructor(config?: NoteSplitConfig) {

        super();

        this.config = config ?? { editNote: "C3", noteThreshold: "C3", broadcastNonNotes: true , active: true };
        
        this.getNode().addMachineInPort("In", 1);

        this.getNode().addMachineOutPort(AllLinkCode, 0);
        this.getNode().addMachineOutPort("Channel 1", 1);
        this.getNode().addMachineOutPort("Channel 2", 2);
    }

    getState() {

        return this.config;
    }

    getFactory(): MachineFactory {

        return NoteSplitMachine.buildFactory();
    }

    receive(messageEvent: MachineMessage, _: number): MessageResult {
        
        if (messageEvent.message.type === "noteoff" || messageEvent.message.type === "noteon") {
            
            if (this.config.editNote !== this.config.noteThreshold) {

                return MessageResult.Ignored;
            }

            if (this.config.active) {

                const midiNote = messageEvent.message.rawData[1];
                const threshold = noteStringToNoteMidi(this.config.noteThreshold);
                if (midiNote > threshold[1]) {

                    this.emit(messageEvent, 1);
                }
                else {

                    this.emit(messageEvent, 2);
                }
            }
            else {
                
                this.emit(messageEvent, 1);
                this.emit(messageEvent, 2);
            }

            return MessageResult.Processed;
        }
        else if (this.config.broadcastNonNotes || (messageEvent.message.type === "allnotesoff" || messageEvent.message.type === "allsoundoff")) {

            this.emit(messageEvent, 1);
            this.emit(messageEvent, 2);

            return MessageResult.Processed;
        }

        return MessageResult.Ignored;
    }
}

const NoteSplitNodeWidget: React.FunctionComponent<CustomNodeWidgetProps<NoteSplitMachine>> = props => {

    const [config, setConfig] = React.useState(props.machine.getState());

    function update(newConfig: NoteSplitConfig) {

        props.machine.setState(newConfig);
        setConfig(props.machine.getState());
    }

    const enableCheckbox = <Checkbox aria-label="enable split"
        icon={<ToggleOff />}
        checkedIcon={<ToggleOnRounded />}
        style={{ margin: 0, padding: 0 }}
        checked={config.active}
        onChange={e => update({ ...config, active: e.target.checked })} />;

    const broadcastNonNotesCheckbox = <Checkbox aria-label="enable non notes"
        icon={<ToggleOff />}
        checkedIcon={<ToggleOnRounded />}
        style={{ margin: 0, padding: 0 }}
        checked={config.broadcastNonNotes}
        onChange={e => update({ ...config, broadcastNonNotes: e.target.checked })} />;
    return (
        <S.SettingsBarHorizontal>
            <S.SettingsBarVertical>
                <FormControlLabel control={enableCheckbox} label={
                    <Box component="div" fontSize={11} padding={0} margin={0}>
                        Active?
                    </Box>
                } labelPlacement="top" />
                <FormControlLabel control={broadcastNonNotesCheckbox} label={
                    <Box component="div" fontSize={11} padding={0} margin={0}>
                        Broadcast non-notes?
                    </Box>
                } labelPlacement="top" />
            </S.SettingsBarVertical>
            <TextField size="small"
                label="Note threshold"
                variant="standard"
                onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") { (e.target as any).blur(); } } }
                onChange={e => update({ ...config, editNote: e.target.value})}
                value={config.editNote}
                error={config.editNote !== config.noteThreshold}
                fullWidth />
        </S.SettingsBarHorizontal>
    );
}

@registeredMachine
export class NoteGrowMachine extends AbstractMachine implements MachineSourceTarget {

    private static factory: MachineFactory;
    getFactory() { return NoteGrowMachine.factory; }

    private readonly activeVoices: { [note: number]: number[] | undefined };
    private readonly usedVoices: boolean[];
    private readonly voices: number;

    static buildFactory(): MachineFactory {

        if (this.factory) {

            return this.factory;
        }

        this.factory = {

            createMachine(voices?: number) {

                return new NoteGrowMachine(voices);
            },
            getType() { return MachineType.Processor; },
            getName() { return "NoteGrowMachine"; },
            getTooltip() { return "Reads notes then dispatches them over N voices using the first free voice"; },
            getMachineCode() { return "grow" }
        }

        return this.factory;
    }

    getState() {

        return this.voices;
    }

    private constructor(voices?: number) {

        super();

        this.voices = voices ?? Number(window.prompt("How many voices?", "8"));
        this.usedVoices = new Array<boolean>(this.voices);

        this.getNode().addMachineOutPort(AllLinkCode, 0);
        for (let i = 0; i < this.voices; i++) {

            this.getNode().addMachineOutPort("Channel " + (i + 1), i + 1);
        }

        this.getNode().addMachineInPort("In", 1);
        this.activeVoices = {};
    }

    receive(messageEvent: MachineMessage, _: number): MessageResult {

        if (messageEvent.message.type === "noteoff" ||
            (messageEvent.message.type === "noteon" && messageEvent.message.rawData[2] === 0)) {

            const voices = this.activeVoices[messageEvent.message.rawData[1]];
            const voice = voices?.pop();
            if (voice != undefined) {

                this.emit(messageEvent, voice + 1);
                if (voices!.length == 0) {

                    delete this.activeVoices[messageEvent.message.rawData[1]];
                }
                this.usedVoices[voice] = false;
            }
        }
        else if (messageEvent.message.type === "noteon") {

            let voice = 0;
            let found = false;
            for (let i = 0; i < this.voices; i++) {

                if (!this.usedVoices[i]) {

                    voice = i;
                    found = true;
                    break;
                }
            }

            if (!found) {

                voice = this.voices - 1;
            }

            this.usedVoices[voice] = true;
            if (this.activeVoices[messageEvent.message.rawData[1]] == undefined) {

                this.activeVoices[messageEvent.message.rawData[1]] = [];
            }

            this.activeVoices[messageEvent.message.rawData[1]]!.push(voice);
            this.emit(messageEvent, voice + 1);
        }
        else {

            if (messageEvent.message.type === "stop") {

                for (let i = 0; i < this.voices; i++) {

                    this.usedVoices[i] = false;
                }

                for (var member in this.activeVoices) {

                    delete this.activeVoices[member];
                }
            }

            for (let i = 0; i < this.voices; i++) {

                this.emit(messageEvent, i + 1);
            }
        }
        
        return MessageResult.Processed;
    }
}

@registeredMachine
export class NoteRoundRobinMachine extends AbstractMachine implements MachineSourceTarget {

    private static factory: MachineFactory;
    getFactory() { return NoteRoundRobinMachine.factory; }

    private readonly activeVoices: { [note: number]: number };
    private readonly voices: number;
    private currentVoice: number;

    getState() {

        return this.voices;
    }

    static buildFactory(): MachineFactory {

        if (this.factory) {

            return this.factory;
        }

        this.factory = {

            createMachine(voices?: number) { return new NoteRoundRobinMachine(voices); },
            getType() { return MachineType.Processor; },
            getName() { return "NoteRoundRobinMachine"; },
            getTooltip() { return "Reads notes then dispatches them over N voices to allow dispatching to different targets (you can achieve polyphony with multiple monophonic devices this way)"; },
            getMachineCode() { return "roundrobin" }
        }

        return this.factory;
    }

    private constructor(voices?: number) {

        super();

        this.voices = voices ?? Number(window.prompt("How many voices?", "8"));

        this.getNode().addMachineOutPort(AllLinkCode, 0);
        for (let i = 0; i < this.voices; i++) {

            this.getNode().addMachineOutPort("Channel " + (i + 1), i + 1);
        }

        this.getNode().addMachineInPort("In", 1);
        this.currentVoice = 0;
        this.activeVoices = {};
    }

    receive(messageEvent: MachineMessage, _: number): MessageResult {

        if (messageEvent.message.type === "noteoff" ||
            (messageEvent.message.type === "noteon" && messageEvent.message.rawData[2] === 0)) {

            if (this.activeVoices[messageEvent.message.rawData[1]] != undefined) {

                this.emit(messageEvent, this.activeVoices[messageEvent.message.rawData[1]] + 1);
            }
        }
        else if (messageEvent.message.type === "noteon") {

            this.activeVoices[messageEvent.message.rawData[1]] = this.currentVoice;
            this.emit(messageEvent, this.currentVoice + 1);
            this.currentVoice = (this.currentVoice + 1) % this.voices;
        }
        else {

            if (messageEvent.message.type === "start" || messageEvent.message.type === "stop") {

                this.currentVoice = 0;
                for (var member in this.activeVoices) {

                    delete this.activeVoices[member];
                }
            }

            for (let i = 0; i < this.voices; i++) {

                this.emit(messageEvent, i + 1);
            }
        }

        return MessageResult.Processed;
    }
}

import { DiagramEngine } from "@projectstorm/react-diagrams-core";
import * as React from "react";
import * as WebMidi from "webmidi";

import { MachineNodeModel } from "./../layout/Node";
import { AbstractMachine, CustomNodeWidgetProps, MachineFactory, MachineSource, MachineType, registeredMachine } from "./Machines";
import { S } from "./MachineStyling";

@registeredMachine
export class KeyboardMachine extends AbstractMachine implements MachineSource {

    private static factory: MachineFactory;
    getFactory() { return KeyboardMachine.factory; }

    getState() {

        return undefined;
    }

    static buildFactory(): MachineFactory {

        if (this.factory) {

            return this.factory;
        }

        this.factory = {

            createMachine(): AbstractMachine { return new KeyboardMachine(); },
            createWidget(engine: DiagramEngine, node: MachineNodeModel): JSX.Element { return <KeyboardNodeWidget engine={engine} size={50} machine={node.machine as KeyboardMachine} />; },
            getType() { return MachineType.Emitter; },
            getName(): string { return "Keyboard"; },
            getTooltip() { return "Visual keyboard to send out MIDI notes with fixed attack"; },
            getMachineCode() { return "keyboard" }
        }

        return this.factory;
    }

    constructor() {

        super();
        this.getNode().addMachineOutPort("Out", 0);
    }
}

export const KeyboardNodeWidget: React.FunctionComponent<CustomNodeWidgetProps<KeyboardMachine>> = props => {

    const sendNote = React.useCallback((noteStr: string) => {

        const note = WebMidi.Utilities.buildNote(noteStr, { rawAttack: 150 });
        const data = Uint8Array.from([
            (WebMidi.Enumerations.CHANNEL_MESSAGES.noteon << 4),
            note.getOffsetNumber(WebMidi.WebMidi.octaveOffset),
            note.rawAttack]);

        props.machine.emit({ message: { rawData: data, isChannelMessage: true, type: "noteon", channel: 1 }, type: "noteon" }, 0);
    }, [props.machine]);

    const stopNote = React.useCallback((noteStr: string) => {

        const note = WebMidi.Utilities.buildNote(noteStr, { rawAttack: 150 });
        const data = Uint8Array.from([
            (WebMidi.Enumerations.CHANNEL_MESSAGES.noteoff << 4),
            note.getOffsetNumber(WebMidi.WebMidi.octaveOffset),
            note.rawAttack]);
        props.machine.emit({ message: { rawData: data, isChannelMessage: true, type: "noteoff", channel: 1 }, type: "noteoff" }, 0);
    }, [props.machine]);

    React.useEffect(() => {

        const keys: { [keyboardKey: string]: string} = {

            "q": "B2",
            "s": "C3",
            "e": "C#3",
            "d": "D3",
            "r": "D#3",
            "f": "E3",
            "g": "F3",
            "y": "F#3",
            "h": "G3",
            "u": "G#3",
            "j": "A3",
            "i": "A#3",
            "k": "B3",
            "l": "C4"
        };

        const onKeyDown = (ev: KeyboardEvent): void => {

            if (ev.repeat) { return; }
            if (keys[ev.key] != undefined) {

                sendNote(keys[ev.key]);
            }
        };

        const onKeyUp = (ev: KeyboardEvent): void => {

            if (keys[ev.key] != undefined) {

                stopNote(keys[ev.key]);
            }
        };

        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);

        return(() => {

            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
        })
    }, [sendNote, stopNote]);

    return (
        <S.KeyboardBody>
            <ul className="set">
                <li className="white e" onMouseDown={() => sendNote("C3")} onMouseUp={() => stopNote("C3")} />
                <li className="black ds" onMouseDown={() => sendNote("C#3")} onMouseUp={() => stopNote("C#3")} />
                <li className="white d" onMouseDown={() => sendNote("D3")} onMouseUp={() => stopNote("D3")} />
                <li className="black cs" onMouseDown={() => sendNote("D#3")} onMouseUp={() => stopNote("D#3")} />
                <li className="white c" onMouseDown={() => sendNote("E3")} onMouseUp={() => stopNote("E3")} />
                <li className="white b" onMouseDown={() => sendNote("F3")} onMouseUp={() => stopNote("F3")} />
                <li className="black as" onMouseDown={() => sendNote("F#3")} onMouseUp={() => stopNote("F#3")} />
                <li className="white a" onMouseDown={() => sendNote("G3")} onMouseUp={() => stopNote("G3")} />
                <li className="black gs" onMouseDown={() => sendNote("G#3")} onMouseUp={() => stopNote("G#3")} />
                <li className="white g" onMouseDown={() => sendNote("A3")} onMouseUp={() => stopNote("A3")} />
                <li className="black fs" onMouseDown={() => sendNote("A#3")} onMouseUp={() => stopNote("A#3")} />
                <li className="white f" onMouseDown={() => sendNote("B3")} onMouseUp={() => stopNote("B3")} />
            </ul>
        </S.KeyboardBody>
    );
}

import styled from '@emotion/styled';
import { DiagramEngine } from '@projectstorm/react-diagrams-core';
import * as React from 'react';
import * as WebMidi from 'webmidi';

import { MachineNodeModel } from './../layout/Node';
import { AbstractMachine, CustomNodeWidgetProps, MachineFactory, MachineSource, MachineType, registeredMachine } from './Machines';

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
            getName(): string { return "KeyboardMachine"; },
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

    function sendNote(noteStr: string) {

        const note = WebMidi.Utilities.buildNote(noteStr, { rawAttack: 150 });
        const data = Uint8Array.from([
            (WebMidi.Enumerations.MIDI_CHANNEL_MESSAGES.noteon << 4),
            note.getOffsetNumber(WebMidi.WebMidi.octaveOffset),
            note.rawAttack]);

        props.machine.emit({ message: { rawData: data, isChannelMessage: true, type: "noteon", channel: 1 }, type: "noteon" }, 0);
    }

    function stopNote(noteStr: string) {

        const note = WebMidi.Utilities.buildNote(noteStr, { rawAttack: 150 });
        const data = Uint8Array.from([
            (WebMidi.Enumerations.MIDI_CHANNEL_MESSAGES.noteoff << 4),
            note.getOffsetNumber(WebMidi.WebMidi.octaveOffset),
            note.rawAttack]);
        props.machine.emit({ message: { rawData: data, isChannelMessage: true, type: "noteoff", channel: 1 }, type: "noteoff" }, 0);
    }

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
    }, []);

    return (
        <S.Body>
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
        </S.Body>
    );
}

namespace S {

    export const Body = styled.div`
    ul {

        position:relative;
        border-radius:1em;
    }

    li {

        margin:0;
        padding:0;
        list-style:none;
        position:relative;
        float:left
    }

    ul .white {

        height:8em;
        width:3em;
        z-index:1;
        border-left:1px solid #bbb;
        border-bottom:1px solid #bbb;
        border-radius:0 0 5px 5px;
        box-shadow:-1px 0 0 rgba(255,255,255,0.8) inset,0 0 5px #ccc inset,0 0 3px rgba(0,0,0,0.2);
        background:linear-gradient(to bottom,#eee 0%,#fff 100%)
    }

    ul .white:active {

        border-top:1px solid #777;
        border-left:1px solid #999;
        border-bottom:1px solid #999;
        box-shadow:2px 0 3px rgba(0,0,0,0.1) inset,-5px 5px 20px rgba(0,0,0,0.2) inset,0 0 3px rgba(0,0,0,0.2);
        background:linear-gradient(to bottom,#fff 0%,#e9e9e9 100%)
    }

    .black {

        height:5em;
        width:1.5em;
        margin:0 0 0 -1em;
        z-index:2;
        border:1px solid #000;
        border-radius:0 0 3px 3px;
        box-shadow:-1px -1px 2px rgba(255,255,255,0.2) inset,0 -5px 2px 3px rgba(0,0,0,0.6) inset,0 2px 4px rgba(0,0,0,0.5);
        background:linear-gradient(45deg,#222 0%,#555 100%)
    }

    .black:active {

        box-shadow:-1px -1px 2px rgba(255,255,255,0.2) inset,0 -2px 2px 3px rgba(0,0,0,0.6) inset,0 1px 2px rgba(0,0,0,0.5);
        background:linear-gradient(to right,#444 0%,#222 100%)
    }

    .a,.g,.f,.d,.c {

        margin:0 0 0 -1em
    }

    ul li:first-of-type {

        border-radius:5px 0 5px 5px
    }

    ul li:last-child {

        border-radius:0 5px 5px 5px
    }
    `;
}
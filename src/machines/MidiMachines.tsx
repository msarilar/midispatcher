import * as WebMidi from 'webmidi';

import { notesOff } from "../Utils";
import { AllLinkCode } from "../layout/Engine";
import { MidiLinkModel } from "../layout/Link";
import { AbstractMachine, MachineFactory, MachineMessage, MachineSource, MachineTarget, MachineType, MessageResult } from "./Machines";

export class MidiMachineSource extends AbstractMachine implements MachineSource {

    private readonly factory: MachineFactory;
    getFactory() { return this.factory; }
    static buildFactory(midiInput: WebMidi.Input,
        ...signals: (keyof WebMidi.InputEventMap)[]): MachineFactory {

        const factory = {

            createMachine(): MidiMachineSource { return new MidiMachineSource(this, midiInput, ...signals); },
            getName() { return midiInput.name + " (in)"; },
            getType() { return MachineType.MIDI; },
            getTooltip() { return "Reads MIDI from this machine (1 port for system messages eg CLOCK, and 1 port per MIDI channel)"; },
            getMachineCode() { return "machine" }
        };

        return factory;
    }

    readonly midiInput: WebMidi.Input;

    private constructor(factory: MachineFactory, midiInput: WebMidi.Input, ...signals: (keyof WebMidi.InputEventMap)[]) {

        super(factory);

        this.factory = factory;
        this.midiInput = midiInput;

        this.getNode().addMachineOutPort("System", 0);
        for (let i = 0; i < this.midiInput.channels.length; i++) {

            this.getNode().addMachineOutPort("Channel " + (i + 1), i + 1);
        }

        this.getNode().addMachineOutPort(AllLinkCode, this.midiInput.channels.length + 1);

        signals.forEach(signal => {

            this.midiInput.addListener(signal, (e: WebMidi.MessageEvent) => {

                if (e.type === "midimessage") {

                    e.type = e.message.type;
                }

                this.emit(e, e.message.channel ?? 0);
            });
        });
    }

    getState() {

        return undefined;
    }
}

export class MidiMachineTarget extends AbstractMachine implements MachineTarget {

    private readonly factory: MachineFactory;
    getFactory() { return this.factory; }

    readonly midiOutput: WebMidi.Output;
    static buildFactory(midiOutput: WebMidi.Output): MachineFactory {

        const factory =  {

            createMachine(): MidiMachineTarget { return new MidiMachineTarget(factory, midiOutput); },
            getName() { return midiOutput.name + " (out)"; },
            getType() { return MachineType.MIDI; },
            getTooltip() { return "Sends MIDI to this machine (1 port for system messages eg CLOCK, and 1 port per MIDI channel)"; },
            getMachineCode() { return "machine" }
        }

        return factory;
    }

    getState() {

        return undefined;
    }

    private constructor(factory: MachineFactory, midiOutput: WebMidi.Output) {

        super(factory);

        this.factory = factory;
        this.midiOutput = midiOutput;

        this.getNode().addMachineInPort("System", 0);
        for (let i = 0; i <  this.midiOutput.channels.length; i++) {

            this.getNode().addMachineInPort("Channel " + (i + 1), i + 1);
        }
    }

    getInChannelCount() { return this.midiOutput.channels.length; }

    dispose(): void {
        
        for(let channel = 1; channel < this.midiOutput.channels.length; channel++) {
            
            for (let i = 0; i < notesOff.length; i++) {

                this.setChannel(notesOff[i], channel);
                try {
        
                    this.midiOutput.send(notesOff[i]);
                }
                catch(e) {
        
                    console.error(e);
                }
            }
        }
    }

    receive(messageEvent: MachineMessage, channel: number) {

        if (messageEvent.message.isChannelMessage) {

            messageEvent.message.channel = channel;
            this.setChannel(messageEvent.message.rawData, channel);
        }

        // somehow needed for some midi output device otherwise the midi is left in bad state?
        if (messageEvent.type === "allnotesoff" || messageEvent.type === "allsoundoff") {

            if (channel === 0) {

                return MessageResult.Ignored;
            }

            for (let i = 0; i < notesOff.length; i++) {

                this.setChannel(notesOff[i], channel);
                try {
        
                    this.midiOutput.send(notesOff[i]);
                }
                catch(e) {
        
                    console.error(e);
                    console.error(messageEvent);
                }
            }
        }
        else {

            try {

                this.midiOutput.send(messageEvent.message.rawData);
            }
            catch(e) {
    
                console.error(e);
                console.error(messageEvent);
            }
        }
        
        return MessageResult.Processed;
    }

    setChannel(rawData: Uint8Array, channel: number) {

        rawData[0] >>= 4;
        rawData[0] <<= 4;
        rawData[0] |= (channel - 1); // override channel
    }
}
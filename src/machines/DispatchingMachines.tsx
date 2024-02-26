import { AbstractMachine, MachineFactory, MachineMessage, MachineSourceTarget, MachineType, registeredMachine } from "./Machines";
import { AllLinkCode } from "../layout/Engine";
import { MidiLinkModel } from "../layout/Link";

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

    receive(messageEvent: MachineMessage, _: number, link: MidiLinkModel) {

        if (messageEvent.message.type === "noteoff" ||
            (messageEvent.message.type === "noteon" && messageEvent.message.rawData[2] === 0)) {

            link.setSending(true);
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

            link.setSending(true);
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

    receive(messageEvent: MachineMessage, _: number, link: MidiLinkModel) {

        if (messageEvent.message.type === "noteoff" ||
            (messageEvent.message.type === "noteon" && messageEvent.message.rawData[2] === 0)) {

            link.setSending(true);
            if (this.activeVoices[messageEvent.message.rawData[1]] != undefined) {

                this.emit(messageEvent, this.activeVoices[messageEvent.message.rawData[1]] + 1);
            }
        }
        else if (messageEvent.message.type === "noteon") {

            link.setSending(true);
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
    }
}

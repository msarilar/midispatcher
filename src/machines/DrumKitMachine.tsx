import { gsStandardSetDrumKit, gsStandardSetDrumKitMini, gsStandardSetDrumKitToms, noteMidiToString } from '../Utils';
import { AllLinkCode } from '../layout/Engine';
import { MidiLinkModel } from '../layout/Link';
import { AbstractMachine, MachineFactory, MachineMessage, MachineSourceTarget, MachineType, registeredMachine, registeredMachineWithParameter } from './Machines';

export enum DrumKitScope {

    All,
    Mini,
    Toms
}

@registeredMachineWithParameter(DrumKitScope.Toms)
@registeredMachineWithParameter(DrumKitScope.Mini)
@registeredMachine
export class DrumKitMachine extends AbstractMachine implements MachineSourceTarget {

    private readonly scope: DrumKitScope;

    getState() {

        return this.scope;
    }

    private static factories: { [scope in DrumKitScope]: MachineFactory | undefined } = {

        [DrumKitScope.All]: undefined,
        [DrumKitScope.Mini]: undefined,
        [DrumKitScope.Toms]: undefined
    };

    private readonly channelPerNote: { [note: string]: number } = {};
    getFactory() { return DrumKitMachine.buildFactory(this.scope)!; }

    static buildFactory(factoryScope?: DrumKitScope): MachineFactory {

        const requestedScope = factoryScope ?? DrumKitScope.All;
        if (DrumKitMachine.factories[requestedScope] != undefined) {

            return DrumKitMachine.factories[requestedScope]!;
        }

        DrumKitMachine.factories[requestedScope] = {

            createMachine(scope?: DrumKitScope): AbstractMachine { return new DrumKitMachine(scope ?? requestedScope); },
            getType() { return MachineType.Processor; },
            getName(): string { return "DrumKitMachine (" + DrumKitScope[requestedScope] + ")"; },
            getTooltip() { return "Split notes based on GS Standard Set Drum Kit"; },
            getMachineCode() { return "drumkit" }
        }

        return DrumKitMachine.factories[requestedScope]!;
    }

    constructor(scope: DrumKitScope) {

        super();

        this.scope = scope;
        this.getNode().addMachineInPort("In", 0);

        let channel = 0;

        let kit;
        switch (scope) {

            case DrumKitScope.All:
                kit = gsStandardSetDrumKit;
                break;
            case DrumKitScope.Mini:
                kit = gsStandardSetDrumKitMini;
                break;
            case DrumKitScope.Toms:
                kit = gsStandardSetDrumKitToms;
                break;
        }

        Object.keys(kit).forEach(note => {

            this.channelPerNote[note] = channel + 1;
            this.getNode().addMachineOutPort(gsStandardSetDrumKit[note], channel++);
        });

        this.getNode().addMachineOutPort(AllLinkCode, channel + 1);
    }

    receive(messageEvent: MachineMessage, _: number, link: MidiLinkModel): void {

        link.setSending(true);
        if (messageEvent.message.type === "noteoff" || messageEvent.message.type === "noteon") {

            const note = noteMidiToString(messageEvent.message.rawData[1]);
            if (gsStandardSetDrumKit[note] != undefined) {

                this.emit(messageEvent, this.channelPerNote[note]);
            }
        }
        else {

            for (let i = 0; i < Object.keys(gsStandardSetDrumKit).length; i++) {

                this.emit(messageEvent, i + 1);
            }
        }
    }
}

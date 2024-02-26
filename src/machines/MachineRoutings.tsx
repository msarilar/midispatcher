import { MidiLinkModel } from "../layout/Link";
import { MachinePortModel } from "../layout/Port";
import { MachineMessage, MachineSource, MachineTarget } from "./Machines";

export class MachineRoutings {

    private readonly routings: {

        [machineSource: string]: { [machineTarget: string]: Function[] }[]
    };

    private readonly deletions: {

        [linkId: string]: Function
    };

    constructor() {

        this.routings = {};
        this.deletions = {};
    }

    connect(source: MachineSource,
        target: MachineTarget,
        fromChannel: number,
        toChannel: number,
        link: MidiLinkModel) {

        if (!this.routings[source.getId()]) {

            this.routings[source.getId()] = [];
        }

        if (!this.routings[source.getId()][fromChannel]) {

            this.routings[source.getId()][fromChannel] = {};
        }

        if (!this.routings[source.getId()][fromChannel][target.getId()]) {

            this.routings[source.getId()][fromChannel][target.getId()] = [];
        }

        const callback = (e: MachineMessage) => {

            const port = link.getTargetPort() as MachinePortModel;
            port.setSending(true);
            target.receive(e, toChannel, link);
        }

        const emit: (messageEvent: MachineMessage, channel: number) => void = (e: MachineMessage, channel: number) => {

            Object.values(this.routings[source.getId()][channel] ?? []).forEach(handler => handler.forEach(h => h(e, channel)));
        };

        source.setEmit(emit);

        this.routings[source.getId()][fromChannel][target.getId()][toChannel] = callback;

        this.deletions[link.getID()] = () => delete this.routings[source.getId()][fromChannel][target.getId()][toChannel];
    }

    disconnect(link: MidiLinkModel) {

        if (this.deletions[link.getID()] == undefined) {

            return;
        }

        this.deletions[link.getID()]();
        delete this.deletions[link.getID()];
    }
}
import { MidiLinkModel } from "../layout/Link";
import { MachinePortModel } from "../layout/Port";
import { MachineMessage, MachineSource, MachineTarget, MessageResult } from "./Machines";

export const ON_CYCLE_DETECTED = "onCycleDetected";
export const ON_CYCLE_ClEARED = "onCycleCleared";

export class MachineRoutings extends EventTarget {

    private readonly onCycleDetected: Event = new Event(ON_CYCLE_DETECTED);
    private readonly onCycleCleared: Event = new Event(ON_CYCLE_ClEARED);

    private hasCycle: boolean;

    private readonly routings: {

        [machineSource: string]: { [machineTarget: string]: Function[] }[]
    };

    private readonly deletions: {

        [linkId: string]: Function
    };

    private readonly links: {

        [sourceAndTargetIds: string]: MidiLinkModel[]
    };

    private readonly sources: {

        [sourceId: string] : MachineSource
    };

    private addLink(source: string, target: string, link: MidiLinkModel) {

        if (this.links[source + "|" + target] == undefined) {

            this.links[source + "|" + target] = [];
        }

        this.links[source + "|" + target].push(link);
    }

    private getLinksBetween(source: string, target: string) : MidiLinkModel[] {

        return this.links[source + "|" + target] ?? [];
    }

    private deleteLink(source: string, target: string, link: MidiLinkModel) {

        this.links[source + "|" + target] = this.links[source + "|" + target].filter(x => x !== link);
    }

    constructor() {

        super();

        this.routings = {};
        this.deletions = {};
        this.links = {};
        this.sources = {};

        this.hasCycle = false;
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

            if (!target.isEnabled()) {

                return;
            }

            const port = link.getTargetPort() as MachinePortModel;
            port.setSending(true);
            try {

                if (link.inCycle) {

                    return;
                }

                if (target.receive(e, toChannel) === MessageResult.Processed) {

                    link.setSending(true);
                };
            }
            catch (e) {

                console.error(e);
            }
        }

        const emit: (messageEvent: MachineMessage, channel: number) => void = (e: MachineMessage, channel: number) => {

            Object.values(this.routings[source.getId()][channel] ?? []).forEach(handler => handler.forEach(h => h(e, channel)));
        };

        source.setEmit(emit);
        this.sources[source.getId()] = source;

        this.routings[source.getId()][fromChannel][target.getId()][toChannel] = callback;
        this.addLink(source.getId(), target.getId(), link);

        if (this.findAndMarkAllCycles()) {

            this.dispatchEvent(this.onCycleDetected);
            this.hasCycle = true;
        }

        this.deletions[link.getID()] = () => {

            delete this.routings[source.getId()][fromChannel][target.getId()][toChannel];
            this.deleteLink(source.getId(), target.getId(), link);
            const hasCycle = this.findAndMarkAllCycles();
            if (this.hasCycle && !hasCycle) {

                this.dispatchEvent(this.onCycleCleared);
            }

            this.hasCycle = hasCycle;
        };
    }

    private findAndMarkAllCycles(): boolean {

        let cycleDetected = false;
        Object.values(this.links).forEach(links => links.forEach(link => link.setInCycle(false)));

        const visited: { [sourceId: string]: boolean } = {};

        Object.keys(this.routings).forEach(sourceId => {

            const currentTraversal: { [sourceId: string]: boolean } = {};
            const stack: [node: string, parentNode?: string][] = [];
            const nodeToParent: { [key: string]: string | undefined } = {};

            stack.push([sourceId, undefined]);

            while (stack.length > 0) {

                const next = stack.pop();
                if (next == undefined) {

                    break;
                }

                const [node, parentNode] = next;

                if (!visited[node]) {

                    visited[node] = true;
                    currentTraversal[node] = true;
                    nodeToParent[node] = parentNode;
                }

                let unvisitedTargets = false;
                for (let channel = 0; this.routings[node] != undefined && channel < this.routings[node].length; channel++) {

                    for (const target in this.routings[node][channel]) {

                        if (this.routings[node][channel][target].find((handler: Function) => handler != undefined) == undefined) {

                            continue;
                        }

                        if (!visited[target]) {

                            stack.push([target, node]);
                            unvisitedTargets = true;
                        }
                        else if (currentTraversal[target]) {

                            let currentNode = node;
                            const links = [];
                            while (currentNode !== target && currentNode != undefined) {

                                const parentNode: string | undefined = nodeToParent[currentNode]!;

                                if (parentNode == undefined) {

                                    break;
                                }

                                links.push(...this.getLinksBetween(parentNode, currentNode));
                                currentNode = parentNode;
                            }

                            if (currentNode === target) {

                                links.push(...this.getLinksBetween(node, currentNode));
                                links.forEach(link => link.setInCycle(true));

                                cycleDetected = true;
                            }
                        }
                    }
                }

                if (!unvisitedTargets) {

                    currentTraversal[node] = false;
                }
            }
        });

        return cycleDetected;
    }

    disconnect(link: MidiLinkModel) {

        if (this.deletions[link.getID()] == undefined) {

            return;
        }

        this.deletions[link.getID()]();
        delete this.deletions[link.getID()];
    }
}
import { DiagramEngine } from "@projectstorm/react-diagrams";
import { AbstractReactFactory, GenerateWidgetEvent, GenerateModelEvent } from "@projectstorm/react-canvas-core";

import { MachineNodeModel, MachineNodeWidget } from "./../layout/Node";
import { engine } from "../layout/Engine";

export interface MachineMessage {

    type: string,
    message: {

        rawData: Uint8Array,
        isChannelMessage: boolean,
        type: string,
        channel: number
    }
}

export interface Machine {

    getNode(): MachineNodeModel;
    getFactory(): MachineFactory;
    getId(): string;
    dispose(): void;
    setNode(node: MachineNodeModel): void;
    getState(): any;
    getFactory(): MachineFactory;
    isEnabled(): boolean;
    setEnabled(enabled: boolean): void;
}

export interface CustomNodeWidgetProps<T extends Machine> {

    engine: DiagramEngine;
    size?: number;
    machine: T;
}

export abstract class AbstractMachine extends EventTarget implements Machine {

    private static counters: { [machineName: string]: number } = {};
    abstract getState(): any;
    private readonly node: MachineNodeModel;
    private enabled: boolean = true;
    getNode(): MachineNodeModel {

        return this.node;
    }
    setNode(node: MachineNodeModel) {

        this.machineNode = node;

    }
    private machineNode: MachineNodeModel | undefined;

    abstract getFactory(): MachineFactory;
    protected readonly id: string;
    protected constructor(factory?: MachineFactory) {

        super();

        if (!AbstractMachine.counters[this.constructor.name]) {

            AbstractMachine.counters[this.constructor.name] = 0;
        }

        this.id = this.constructor.name + "_" + AbstractMachine.counters[this.constructor.name]++;
        this.node = new MachineNodeModel(this, (factory ?? this.getFactory()).getMachineCode(), factory);
    }

    isEnabled(): boolean {

        return this.enabled;
    }

    setEnabled(enabled: boolean): void {

        this.enabled = enabled;
    }

    getId() {

        return this.id;
    }

    dispose() { }

    emitter?: (messageEvent: MachineMessage, channel: number) => void;
    setEmit(emit: (messageEvent: MachineMessage, channel: number) => void) { this.emitter = emit; }
    emit(messageEvent: MachineMessage, channel: number) {

        if (!this.enabled) {

            return;
        }

        (this.machineNode ?? this.getNode()).getOutPorts()[channel]?.setSending(true);
        this.emitter?.(messageEvent, channel);
    };
}

export interface MachineSource extends Machine {

    setEmit(emit: (messageEvent: MachineMessage, channel: number) => void): void;
}

export enum MessageResult {

    Processed,
    Ignored
}

export interface MachineTarget extends Machine {

    receive(messageEvent: MachineMessage, channel: number): MessageResult;
}

export interface MachineSourceTarget extends MachineSource, MachineTarget { }

export interface MachineFactory {

    createWidget?(engine: DiagramEngine, node: MachineNodeModel): JSX.Element;
    createMachine(deserializedData?: any): Machine;
    getName(): string;
    getType(): MachineType;
    getTooltip(): string;
    getMachineCode(): string;
}

export enum MachineType {

    Emitter = "Emitters",
    Output = "Output",
    System = "System",
    Processor = "Processors",
    WebRTC = "WebRTC",
    MIDI = "MIDI"
}

interface MachineTypeData {

    tooltip: string;
    factories: MachineFactory[];
}

export const registeredFactories: { [type in MachineType]: MachineTypeData } = {

    [MachineType.Processor]: {

        tooltip: "Read a signal, modify/filter it, re-emit it",
        factories: []
    },
    [MachineType.Emitter]: {

        tooltip: "Emit signals based on GUI interactions or clock input",
        factories: []
    },
    [MachineType.Output]: {

        tooltip: "Read signals and emit sound",
        factories: []
    },
    [MachineType.System]: {

        tooltip: "Emit system signals",
        factories: []
    },
    [MachineType.WebRTC]: {

        tooltip: "Remote machines",
        factories: []
    },
    [MachineType.MIDI]: {

        tooltip: "MIDI Tooltip",
        factories: []
    }
};

function registerFactory(factory: MachineFactory) {

    engine.getNodeFactories().registerFactory(new CustomNodeFactory(factory, factory.getMachineCode()));
    registeredFactories[factory.getType()].factories.push(factory);
}

export function registeredMachine<T extends { buildFactory(): MachineFactory; }>(target: T) {

    const factory = target.buildFactory();
    registerFactory(factory);
}

export function registeredMachineWithParameter<P>(parameter: P) {

    return function <T extends { buildFactory(param: P): MachineFactory; }>(target: T) {

        const factory = target.buildFactory(parameter);
        registerFactory(factory);

        return target;
    };
}

class CustomNodeFactory extends AbstractReactFactory<MachineNodeModel, DiagramEngine> {

    private readonly machineFactory: MachineFactory;

    constructor(machineFactory: MachineFactory, type: string) {

        super(type);
        this.machineFactory = machineFactory;
    }

    generateReactWidget(event: GenerateWidgetEvent<MachineNodeModel>): JSX.Element {

        const widget: JSX.Element | undefined = this.machineFactory.createWidget?.(this.engine, event.model);
        return <MachineNodeWidget engine={engine} node={event.model} customWidget={widget} />
    }

    generateModel(e: GenerateModelEvent) {

        // legacy deserialized states:

        if (e.initialConfig.clockConfig != undefined) {

            e.initialConfig.state = e.initialConfig.clockConfig;
        }
        else if (e.initialConfig.arpConfig != undefined) {

            e.initialConfig.state = e.initialConfig.arpConfig;
        }
        else if (e.initialConfig.midiFileConfig != undefined) {

            e.initialConfig.state = e.initialConfig.midiFileConfig;
        }
        else if (e.initialConfig.oscillatorConfig != undefined) {

            e.initialConfig.state = e.initialConfig.oscillatorConfig;
        }
        else if (e.initialConfig.thruConfig != undefined) {

            e.initialConfig.state = e.initialConfig.thruConfig;
        }
        else if (e.initialConfig.toneJsConfig != undefined) {

            e.initialConfig.state = e.initialConfig.toneJsConfig;
        }
        else if (this.machineFactory.getName().startsWith("ToneJsSample")) {

            if (e.initialConfig?.state instanceof String) {

                e.initialConfig.state = { "sample": e.initialConfig.state, "volume": 15 };
            }
            else {

                // retrocompatibility (used to be an enum):
                switch (e.initialConfig.state) {

                    case 0:
                        e.initialConfig.state = { sample: "Drum", volume: -15 };
                        break;
                    case 1:
                        e.initialConfig.state = { sample: "Kalimba", volume: -15 };
                        break;
                    case 2:
                        e.initialConfig.state = { sample: "Guitar", volume: -15 };
                        break;
                }
            }
        }

        if (this.machineFactory.getName() === "ArpMachine" || this.machineFactory.getName() === "Arp") {

            if (e.initialConfig.state.keyboardNotes == undefined) {

                e.initialConfig.state.keyboardNotes = [];
            }

            if (e.initialConfig.state.arpMode == undefined) {

                e.initialConfig.state.arpMode = "predefined";
            }

            if (e.initialConfig.state.predefinedNotes == undefined) {

                e.initialConfig.state.predefinedNotes = e.initialConfig.state.notes;
            }
        }

        return new MachineNodeModel(this.machineFactory.createMachine(e.initialConfig.state), this.type);
    }
}

export function machineTypeToColor(type: MachineType) {

    switch (type) {

        case MachineType.Processor:
            return "rgb(0,150,255)";
        case MachineType.Emitter:
            return "rgb(100,0,255)";
        case MachineType.Output:
            return "rgb(0,150,50)";
        case MachineType.System:
            return "rgb(255,153,0)";
        case MachineType.WebRTC:
            return "rgb(255,77,136)";
        case MachineType.MIDI:
            return "rgb(150,150,50)";
    }
}

export class LabelMachineFactory implements MachineFactory {

    private readonly type: MachineType;
    private readonly label: string;
    private readonly tooltip: string;
    constructor(type: MachineType, label: string, tooltip: string) {

        this.type = type;
        this.label = label;
        this.tooltip = tooltip;
    }

    getMachineCode() {

        return "machine";
    }

    createWidget(_engine: DiagramEngine, _node: MachineNodeModel): JSX.Element {

        throw new Error("Method not implemented.");
    }

    createMachine(_?: any): AbstractMachine {

        throw new Error("Method not implemented.");
    }

    getName(): string {

        return this.label;
    }

    getType(): MachineType {

        return this.type;
    }

    getTooltip(): string {

        return this.tooltip;
    }

}
import createEngine, { DefaultDiagramState, DiagramEngine, DiagramModel, LinkModel, LinkModelGenerics, NodeModel } from "@projectstorm/react-diagrams";
import { BaseModel, BaseEntityEvent, BaseEvent, BaseEntity, BaseEntityGenerics } from "@projectstorm/react-canvas-core";

import { MachineSource, MachineTarget } from "../machines/Machines";
import { MachineNodeModel } from "./Node";
import { MidiLinkModel } from "./Link";
import { MachineRoutings, ON_CYCLE_ClEARED, ON_CYCLE_DETECTED } from "../machines/MachineRoutings";
import { MachinePortModel } from "./Port";

export const engine = createEngine();
const state = engine.getStateMachine().getCurrentState();
if (state instanceof DefaultDiagramState) {

    state.dragNewLink.config.allowLooseLinks = false;
}

class Command {

    _execute: Function;
    _undo: Function;

    constructor(execute: Function, undo: Function) {

        this._execute = execute;
        this._undo = undo;
    }

    execute(engine: DiagramEngine) {

        this._execute(engine);
    }

    undo(engine: DiagramEngine) {

        this._undo(engine);
    }
}

export class CommandManager {

    commands: Array<Command> = [];
    index: number = -1;
    engine: DiagramEngine;

    constructor(engine: DiagramEngine) {

        this.engine = engine;
    }

    addCommand(command: Command) {

        this.commands.length = this.index + 1;
        this.commands.push(command);
        this.index += 1;
    }

    undo() {

        if (this.index >= 0) {

            const command = this.commands[this.index];
            command.undo(this.engine);
            this.index = this.index - 1;
        }
    }

    redo() {

        if (this.index + 1 < this.commands.length) {

            const command = this.commands[this.index + 1];
            command.execute(this.engine);
            this.index++;
        }
    }
}

export class MidispatcherDiagramModel extends DiagramModel {

    readonly commandManager: CommandManager;
    private routings: MachineRoutings;

    onCycleDetected: () => void;
    onCycleCleared: () => void;

    deserializeModel(data: ReturnType<this["serialize"]>, engine: DiagramEngine) {

        super.deserializeModel(data, engine);

        this.routings = new MachineRoutings()
        this.routings.addEventListener(ON_CYCLE_DETECTED, () => { this.onCycleDetected(); });
        this.routings.addEventListener(ON_CYCLE_ClEARED, () => { this.onCycleCleared(); });

        // running this forEach directly does not work (I guess engine not fully loaded?) so we go through setTimeout:
        window.setTimeout(() =>
        this.getLinks().forEach(link => this.applyLink(link as MidiLinkModel)), 0);

        this.realignGrid();
    }

    constructor(commandManager: CommandManager, onCycleDetected: () => void, onCycleCleared: () => void) {

        super();

        this.routings = new MachineRoutings();
        this.onCycleDetected = onCycleDetected;
        this.onCycleCleared = onCycleCleared;
        this.routings.addEventListener(ON_CYCLE_DETECTED, () => { this.onCycleDetected(); });
        this.routings.addEventListener(ON_CYCLE_ClEARED, () => { this.onCycleCleared(); });
        this.commandManager = commandManager;

        this.registerListener({

            linksUpdated: (lu: BaseEvent) => {

                const linksUpdatedEvent = lu as BaseEntityEvent<BaseEntity<BaseEntityGenerics>> & {

                    link: MidiLinkModel;
                    isCreated: boolean;
                };

                if (linksUpdatedEvent.isCreated) {

                    const registered = linksUpdatedEvent.link.registerListener({

                        targetPortChanged: (_: BaseEvent) => {

                            linksUpdatedEvent.link.deregisterListener(registered);
                            this.applyLink(linksUpdatedEvent.link);
                        }
                    });
                }
                else {

                    this.routings.disconnect(linksUpdatedEvent.link);
                }
            },
            eventDidFire: (edf: BaseEvent) => {

                const f = (edf as any).function;
                switch (f) {

                    case "offsetUpdated":
                        this.adjustGridOffset(edf as any);
                        break;

                    case "zoomUpdated":
                        this.adjustGridZoom(edf as any);
                        break;
                }
            }

        });

        this.realignGrid();
    }

    realignGrid() {

        this.adjustGridOffset({ offsetX: this.getOffsetX(), offsetY: this.getOffsetY() });
        this.adjustGridZoom({ zoom: this.getZoomLevel() });
    };

    private adjustGridOffset({ offsetX, offsetY }: { offsetX: number, offsetY: number}) {

        const grid = document.querySelector(".midispatcherGrid") as HTMLElement;
        if(grid == undefined) {

            return;
        }

        grid.style.setProperty("--offset-x", `${Math.round(offsetX)}px`);
        grid.style.setProperty("--offset-y", `${Math.round(offsetY)}px`);
    };

    private adjustGridZoom({ zoom }: { zoom: number }) {

        const grid = document.querySelector(".midispatcherGrid") as HTMLElement;
        if(grid == undefined) {

            return;
        }

        const { gridSize } = this.getOptions();
        grid.style.setProperty("--grid-size", `${((gridSize ?? 15) * zoom) / 100}px`);
    };

    removeLink(link: LinkModel<LinkModelGenerics>): void {

        const command = new Command(
            () => super.removeLink(link),
            () => {

                super.addLink(link);
                this.applyLink(link as MidiLinkModel);
            }
        );

        this.commandManager.addCommand(command);

        return super.removeLink(link);
    }

    addLink(link: LinkModel<LinkModelGenerics>): LinkModel<LinkModelGenerics> {

        const command = new Command(
            () => {

                super.addLink(link);
                this.applyLink(link as MidiLinkModel);
            },
            () => super.removeLink(link),
        );

        this.commandManager.addCommand(command);

        return super.addLink(link);
    }

    addNode(node: NodeModel): NodeModel {

        const command = new Command(
            () => super.addNode(node),
            () => super.removeNode(node),
        );

        this.commandManager.addCommand(command);

        return super.addNode(node);
    }

    removeNode(node: NodeModel): void {

        const command = new Command(
            () => super.removeNode(node),
            () => super.addNode(node),
        );

        this.commandManager.addCommand(command);

        return super.removeNode(node);
    }

    addAll(...models: BaseModel[]): BaseModel[] {

        return super.addAll(...models);
    }

    applyLink(link: MidiLinkModel) {

        let portSource = link.getSourcePort() as MachinePortModel;
        let portTarget = link.getTargetPort() as MachinePortModel;

        if (!portTarget.isIn) {

            const temp = portTarget;
            portTarget = portSource;
            portSource = temp;
        }

        const sourceNode = portSource.getNode() as MachineNodeModel;
        const machineSource = sourceNode.machine as MachineSource;

        const targetNode = portTarget.getNode() as MachineNodeModel;
        const machineTarget = targetNode.machine as MachineTarget;

        if (link.getSourcePort().getName() === AllLinkCode) {

            Object.keys(sourceNode.getMachinePorts()).forEach(key => {

                const port = sourceNode.getMachinePorts()[key];
                if (port.getName() !== AllLinkCode && !port.isIn) {

                    const newLink = (link.getTargetPort() as MachinePortModel).link<MidiLinkModel>(port);
                    engine.getModel().addAll(newLink);
                    const sourceNode = port.getNode() as MachineNodeModel;
                    const machineSource = sourceNode.machine as MachineSource;
                    this.routings.connect(machineSource, machineTarget, port.channel, portTarget.channel, newLink);
                }
            });

            engine.getModel().removeLink(link);
        }
        else if (portSource.getLinks()[portTarget.getName()] !== undefined) {

            engine.getModel().removeLink(link);
        }
        else {

            this.routings.connect(machineSource, machineTarget, portSource.channel, portTarget.channel, link);
        }

        return true;
    }
}

// "magic" constant to create a link used to connect all other links at the same time
export const AllLinkCode: string = "All";
import * as React from "react";

import { NodeModel, PortModelAlignment, NodeModelGenerics, DiagramEngine } from "@projectstorm/react-diagrams";
import { BaseEvent, AbstractReactFactory, GenerateWidgetEvent, GenerateModelEvent, BasePositionModelOptions } from "@projectstorm/react-canvas-core";

import { Machine, MachineFactory, machineTypeToColor } from "./../machines/Machines";
import { MachinePortLabel, MachinePortModel } from "./Port";
import { S } from "./LayoutStyling";

interface DefaultNodeModelOptions extends BasePositionModelOptions {

    name?: string;
    color: string;
}

interface DefaultNodeModelGenerics extends NodeModelGenerics {

    OPTIONS: DefaultNodeModelOptions;
}

export class MachineNodeModel extends NodeModel<DefaultNodeModelGenerics> {

    protected portsIn: MachinePortModel[];
    protected portsOut: MachinePortModel[];
    readonly machine: Machine;
    constructor(machine: Machine, type?: string, factory?: MachineFactory) {

        super({

            type: type ?? "machine",
            name: (factory ?? machine.getFactory()).getName(),
            color: machineTypeToColor((factory ?? machine.getFactory()).getType())
        });

        this.portsOut = [];
        this.portsIn = [];
        this.machine = machine;
        this.machine.setNode(this);

        this.registerListener({

            entityRemoved: (er: BaseEvent) => {

                this.dispose();
            }
        });
    }

    dispose() { this.machine.dispose(); }

    serialize() {

        return { ...super.serialize(),
            machineName: this.machine.getFactory().getName(),
            state: this.machine.getState() };
    }

    getInPorts(): MachinePortModel[] {

        return this.portsIn;
    }

    getOutPorts(): MachinePortModel[] {

        return this.portsOut;
    }

    removePort(port: MachinePortModel) {

        if (port.getOptions().in) {

            const index = this.portsIn.indexOf(port);
            this.portsIn.splice(index, 1);
        } else {

            const index = this.portsOut.indexOf(port);
            this.portsOut.splice(index, 1);
        }

        super.removePort(port);
    }

    addPort(port: MachinePortModel): MachinePortModel {

        super.addPort(port);
        if (port.getOptions().in) {

            if (this.portsIn.indexOf(port) === -1) {

                this.portsIn.push(port);
            }
        } else {

            if (this.portsOut.indexOf(port) === -1) {

                this.portsOut.push(port);
            }
        }

        return port;
    }

    addMachineOutPort(label: string, channel: number): MachinePortModel {

        const p = new MachinePortModel({

            in: false,
            name: label,
            label: label,
            alignment: PortModelAlignment.RIGHT
        }, channel);

        return this.addPort(p);
    }

    addMachineInPort(label: string, channel: number): MachinePortModel {

        const p = new MachinePortModel({

            in: true,
            name: label,
            label: label,
            alignment: PortModelAlignment.LEFT
        }, channel);

        return this.addPort(p);
    }

    getMachinePorts(): { [s: string]: MachinePortModel } {

        return this.getPorts() as { [s: string]: MachinePortModel };
    }
}

export class MachineNodeFactory extends AbstractReactFactory<MachineNodeModel, DiagramEngine> {

    private readonly factories: { [name: string]: MachineFactory };
    constructor(factories: { [name: string]: MachineFactory }) {

        super("machine");
        this.factories = factories;
    }

    generateReactWidget(event: GenerateWidgetEvent<MachineNodeModel>): JSX.Element {

        return <MachineNodeWidget engine={this.engine} node={event.model} />;
    }

    generateModel(e: GenerateModelEvent) {

        e.initialConfig.machineName = (e.initialConfig.machineName as string).replace(/(Machine)(?!.*\1)/, "");
        if (!this.factories[e.initialConfig.machineName]) {

            window.alert("Unknown machine " + e.initialConfig.machineName + "\r\nKnown machines:\r\n" + Object.keys(this.factories));
        }

        return new MachineNodeModel(this.factories[e.initialConfig.machineName]
            .createMachine(e.initialConfig.state), "machine");
    }
}

interface MachineNodeProps {

    node: MachineNodeModel;
    engine: DiagramEngine;
    customWidget?: JSX.Element;
}

export const MachineNodeWidget: React.FunctionComponent<MachineNodeProps> = props => {
    
    function generatePort(port: MachinePortModel) {

        return <MachinePortLabel engine={props.engine} port={port} key={port.getID()} />;
    };

    function setDraggable(draggable: boolean) {

        props.node.setLocked(!draggable);
    }

    return (
        <S.Node
            data-default-node-name={props.node.getOptions().name}
            selected={props.node.isSelected()}
            background={props.node.getOptions().color}>
            <S.Title>
                <S.TitleName>{props.node.getOptions().name}</S.TitleName>
            </S.Title>
            <S.Ports>
                <S.PortsContainer>{Object.values(props.node.getInPorts()).map(generatePort)}</S.PortsContainer>
                <S.PortsContainer>{Object.values(props.node.getOutPorts()).map(generatePort)}</S.PortsContainer>
            </S.Ports>
            {
                props.customWidget && (
                <div onMouseOver={() => setDraggable(false)}
                     onMouseOut={() => setDraggable(true)}>
                    {props.customWidget}
                </div>
            )}
        </S.Node>
    );
}

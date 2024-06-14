import * as React from "react";

import SettingsIcon from "@mui/icons-material/Settings";
import { NodeModel, PortModelAlignment, NodeModelGenerics, DiagramEngine } from "@projectstorm/react-diagrams";
import { BaseEvent, AbstractReactFactory, GenerateWidgetEvent, GenerateModelEvent, BasePositionModelOptions } from "@projectstorm/react-canvas-core";

import { Machine, MachineFactory, MachineModulable, MachineModulator, machineTypeToColor } from "./../machines/Machines";
import { MachinePortLabel, MachinePortModel, MidiPortModel, ModulationPortIn, ModulationPortOut } from "./Port";
import { S } from "./LayoutStyling";
import { IconButton, Menu, MenuItem } from "@mui/material";
import assert from "assert";

interface DefaultNodeModelOptions extends BasePositionModelOptions {

    name?: string;
    color: string;
}

interface DefaultNodeModelGenerics extends NodeModelGenerics {

    OPTIONS: DefaultNodeModelOptions;
}

export class MachineNodeModel extends NodeModel<DefaultNodeModelGenerics> {

    protected midiPortsIn: MidiPortModel[];
    protected midiPortsOut: MidiPortModel[];

    protected modulationPortsIn: ModulationPortIn[];
    protected modulationPortsOut: ModulationPortOut[];

    readonly machine: Machine;
    constructor(machine: Machine, type?: string, factory?: MachineFactory) {

        super({

            type: type ?? "machine",
            name: (factory ?? machine.getFactory()).getName(),
            color: machineTypeToColor((factory ?? machine.getFactory()).getType())
        });

        this.midiPortsOut = [];
        this.midiPortsIn = [];
        this.modulationPortsOut = [];
        this.modulationPortsIn = [];
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

    getMidiInPorts(): MidiPortModel[] {

        return this.midiPortsIn;
    }

    getMidiOutPorts(): MidiPortModel[] {

        return this.midiPortsOut;
    }

    getModulationInPorts(): ModulationPortIn[] {

        return this.modulationPortsIn;
    }

    getModulationOutPorts(): ModulationPortOut[] {

        return this.modulationPortsOut;
    }

    removeMidiPort(port: MidiPortModel) {

        if (port.getOptions().in) {

            const index = this.midiPortsIn.indexOf(port);
            this.midiPortsIn.splice(index, 1);
        } else {

            const index = this.midiPortsOut.indexOf(port);
            this.midiPortsOut.splice(index, 1);
        }

        super.removePort(port);
    }

    addPort(port: MachinePortModel): MachinePortModel {

        super.addPort(port);
        console.log(this.midiPortsOut);
        return port;
    }

    addMachineOutPort(label: string, channel: number): MachinePortModel {

        const port = new MidiPortModel({

            in: false,
            name: label,
            label: label,
            alignment: PortModelAlignment.RIGHT
        }, channel);

        if (this.midiPortsOut.indexOf(port) === -1) {

            this.midiPortsOut.push(port);
        }

        return this.addPort(port);
    }

    addMachineInPort(label: string, channel: number): MachinePortModel {

        const port = new MidiPortModel({

            in: true,
            name: label,
            label: label,
            alignment: PortModelAlignment.LEFT
        }, channel);

        if (this.midiPortsIn.indexOf(port) === -1) {

            this.midiPortsIn.push(port);
        }

        return this.addPort(port);
    }

    addModulationInput(modulable: MachineModulable): MachinePortModel {

        const port = new ModulationPortIn({

            in: true,
            name: "Mod In",
            label: "Mod In",
            alignment: PortModelAlignment.LEFT
        }, modulable);

        if (this.modulationPortsIn.indexOf(port) === -1) {

            this.modulationPortsIn.push(port);
        }

        return this.addPort(port);
    }

    addModulationOutput(modulator: MachineModulator): MachinePortModel {

        const port = new ModulationPortOut({

            in: false,
            name: "Mod Out",
            label: "Mod Out",
            alignment: PortModelAlignment.LEFT
        }, modulator);

        if (this.modulationPortsOut.indexOf(port) === -1) {

            this.modulationPortsOut.push(port);
        }

        return this.addPort(port);
    }

    getMachinePorts(): { [s: string]: MachinePortModel } {

        return this.getPorts() as { [s: string]: MachinePortModel };
    }

    getMachineMidiPortsOut(): MidiPortModel[] {

        return this.midiPortsOut;
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

    const [settingsAnchor, setSettingsAnchor] = React.useState<null | HTMLElement>(null);
    const open = Boolean(settingsAnchor);
    const handleSettingsClose = () => {

        setSettingsAnchor(null);
    };

    const handleSettingsClick = (event: React.MouseEvent<HTMLElement>) => {

        setSettingsAnchor(event.currentTarget);
    };

    const handleDuplicate = (event: React.MouseEvent<HTMLElement>) => {

        const clone = props.node.machine.getFactory().createMachine(props.node.machine.getState()).getNode();
        
        var point = props.engine.getRelativeMousePoint(event);
        clone.setPosition(point);
        props.engine.getModel().addAll(clone);
        handleSettingsClose();
        props.engine.repaintCanvas();
    };

    const toggleEnabled = () => {

        props.node.machine.setEnabled(!props.node.machine.isEnabled());
        handleSettingsClose();
        props.engine.repaintCanvas();
    };

    const handleDelete = () => {

        Object.keys(props.node.getMachinePorts()).forEach(key => {

            const port = props.node.getMachinePorts()[key];

            Object.keys(port.getLinks()).forEach(link => port.getLinks()[link].remove());
        });

        props.engine.getModel().removeNode(props.node);
        handleSettingsClose();
        props.engine.repaintCanvas();
    };

    return (
        <S.Node
            data-default-node-name={props.node.getOptions().name}
            selected={props.node.isSelected()}
            background={props.node.getOptions().color}
            enabled={props.node.machine.isEnabled()}>
            <S.Title>
                <S.TitleName>{props.node.getOptions().name + (props.node.machine.isEnabled() ? "" : " (disabled)")}</S.TitleName>

                <IconButton aria-label="settings"
                            size="small"
                            style={{margin: 0}}
                            onClick={handleSettingsClick}>
                    <SettingsIcon fontSize="inherit" style={{margin: 0, color: "white"}}/>
                </IconButton>
                <Menu anchorEl={settingsAnchor}
                      open={open}
                      onClose={handleSettingsClose}>
                    <MenuItem style={{margin: 0}} onClick={handleDuplicate}>Duplicate</MenuItem>
                    <MenuItem style={{margin: 0}} onClick={toggleEnabled}>{props.node.machine.isEnabled() ? "Disable" : "Enable"}</MenuItem>
                    <MenuItem style={{margin: 0}} onClick={handleDelete}>Delete</MenuItem>
                </Menu>
            </S.Title>
            <S.Ports>
                <S.PortsContainer>{Object.values(props.node.getMidiInPorts()).map(generatePort)}</S.PortsContainer>
                <S.PortsContainer>{Object.values(props.node.getMidiOutPorts()).map(generatePort)}</S.PortsContainer>
            </S.Ports>
            <S.Ports>
                <S.PortsContainer>{Object.values(props.node.getModulationInPorts()).map(generatePort)}</S.PortsContainer>
                <S.PortsContainer>{Object.values(props.node.getModulationOutPorts()).map(generatePort)}</S.PortsContainer>
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

import { DefaultPortModel, DefaultPortModelOptions, DiagramEngine, PortWidget } from "@projectstorm/react-diagrams";
import { AbstractModelFactory, DeserializeEvent } from "@projectstorm/react-canvas-core";
import React from "react";

import { MidiLinkModel } from "./Link";
import { S } from "./LayoutStyling";
import { MachineModulable, MachineModulator } from "../machines/Machines";

export abstract class MachinePortModel extends DefaultPortModel {

    isIn: boolean;
    portActive: boolean;
    sendingTimeout: NodeJS.Timeout | undefined;
    private sendingCallback?: (sending: boolean) => void;

    static counter: number = 0;
    readonly current: number = MachinePortModel.counter++;

    setPortActiveCallback(callback: (sending: boolean) => void) {

        this.sendingCallback = callback;
    }

    constructor(options: DefaultPortModelOptions) {

        super({ ...options, type: "machine" });

        this.isIn = options.in!;
        this.portActive = false;
    }

    createLinkModel(): MidiLinkModel {

        return new MidiLinkModel();
    }

    serialize() {

        return { ...super.serialize(), isIn: this.isIn };
    }

    deserialize(e: DeserializeEvent<this>) {

        super.deserialize(e);
        this.isIn = e.data.isIn;
    }

    setSending(sending: boolean) {

        if (this.portActive !== sending) {

            this.portActive = sending;
            if (this.portActive) {

                const that = this;
                if (this.sendingTimeout != undefined) {

                    clearTimeout(this.sendingTimeout);
                }

                this.sendingTimeout = setTimeout(function () {

                    that.setSending(false);
                }, 100);
            }

            this.sendingCallback?.(sending);
        }
    }
}

export class MidiPortModel extends MachinePortModel {

    channel: number;
    
    constructor(options: DefaultPortModelOptions, channel: number) {

        super({ ...options, type: "machine" });

        this.channel = channel ?? -1;
    }

    serialize() {

        return { ...super.serialize(), channel: this.channel };
    }

    deserialize(e: DeserializeEvent<this>) {

        super.deserialize(e);
        this.channel = e.data.channel;
    }
}

export class ModulationPortOut extends MachinePortModel {

    modulator: MachineModulator;
    
    constructor(options: DefaultPortModelOptions, modulator: MachineModulator) {

        super({ ...options, type: "machine" });

        this.modulator = modulator;
    }
}

export class ModulationPortIn extends MachinePortModel {

    modulable: MachineModulable;

    constructor(options: DefaultPortModelOptions, modulable: MachineModulable) {

        super({ ...options, type: "machine" });

        this.modulable = modulable;
    }
}

export class MachinePortFactory extends AbstractModelFactory<MachinePortModel, DiagramEngine> {

    constructor() {

        super("machine");
    }

    generateModel(event: any): MachinePortModel {

        return new MidiPortModel({

            in: true,
            name: event.name,
            label: event.label,
            alignment: event.alignment
        }, 1);
    }
}

interface MachinePortLabelProps {

	port: MachinePortModel;
	engine: DiagramEngine;
}

export const MachinePortLabel: React.FunctionComponent<MachinePortLabelProps> = props => {

    const [portActive, setPortActive] = React.useState(props.port.portActive);

    props.port.setPortActiveCallback(s => setPortActive(s));

    const port = (
        <PortWidget engine={props.engine} port={props.port}>
            <S.Port sending={portActive}/>
        </PortWidget>
    );

    const label = <S.Label>{props.port.getOptions().label}</S.Label>;

    return (
        <S.PortLabel>
            {props.port.getOptions().in ? port : label}
            {props.port.getOptions().in ? label : port}
        </S.PortLabel>
    );
}

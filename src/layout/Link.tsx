import { DefaultLinkFactory, DefaultLinkModel, DefaultLinkProps, DefaultLinkWidget } from "@projectstorm/react-diagrams";

import React from "react";
import { S } from "./LayoutStyling";

const MidiLinkWidget: React.FunctionComponent<DefaultLinkProps> = (props) => {

	const [refresh, toggleRefresh] = React.useState(false);

    React.useEffect(() => {

        const model = props.link as MidiLinkModel;
        model.setRefreshCallback(() => {

            toggleRefresh(!refresh);
        });
    });

    return <DefaultLinkWidget link={props.link} diagramEngine={props.diagramEngine}/>
}

export class MidiLinkFactory extends DefaultLinkFactory {

    constructor() {

        super("midi-link");
    }

    generateReactWidget(event: any) {

        return <MidiLinkWidget link={event.model} diagramEngine={this.engine}/>
    }

    generateModel(): DefaultLinkModel {

        return new MidiLinkModel();
    }

    generateLinkSegment(model: MidiLinkModel, selected: boolean, path: string) {

        return (
            <S.MidiLink
                selected={selected}
                sending={model.sending}
                inCycle={model.inCycle}
                stroke={selected ? model.getOptions().selectedColor : model.getOptions().color}
                strokeWidth={model.getOptions().width}
                d={path}
            />
        );
    }
}

export class MidiLinkModel extends DefaultLinkModel {

    sending: boolean;
    inCycle: boolean;
    sendingTimeout: NodeJS.Timeout | undefined;
    private deleteCallback: Function | undefined;
    private refreshCallback?: () => void;

    setRefreshCallback(callback: () => void) {

        this.refreshCallback = callback;
    }

    setInCycle(inCycle: boolean) {

        const changed = this.inCycle !== inCycle;
        this.inCycle = inCycle;
        if (changed) {

            this.refreshCallback?.();
        }
    }

    setDeleteCallback(deleteCallback: Function) {

        this.deleteCallback = deleteCallback;
    }

    invokeDeleteCallback() {

        this.deleteCallback?.();
    }

    setSending(sending: boolean) {

        const changed = this.sending !== sending;
        this.sending = sending;
        if (this.sending) {

            const that = this;
            if (this.sendingTimeout != undefined) {

                clearTimeout(this.sendingTimeout);
            }

            this.sendingTimeout = setTimeout(function () {

                that.setSending(false);
            }, 100);
        }

        if (changed) {

            this.refreshCallback?.();
        }
    }

    constructor() {

        super({

            type: "midi-link",
            width: 3
        });

        this.options.extras = false;
        this.sending = false;
        this.inCycle = false;
    }
}

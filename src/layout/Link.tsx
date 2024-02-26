import { DefaultLinkFactory, DefaultLinkModel, DefaultLinkProps, DefaultLinkWidget } from '@projectstorm/react-diagrams';
import { css, keyframes } from '@emotion/react';

import styled from '@emotion/styled';
import React from 'react';

const MidiLinkWidget: React.FunctionComponent<DefaultLinkProps> = (props) => {

	const [_, setSelected] = React.useState(false);
    
    React.useEffect(() => {

        const model = props.link as MidiLinkModel;
        model.setSendingCallback(sending => {
            setSelected(sending);
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
            <S.Path
                selected={selected}
                sending={model.sending}
                stroke={selected ? model.getOptions().selectedColor : model.getOptions().color}
                strokeWidth={model.getOptions().width}
                d={path}
            />
        );
    }
}

export class MidiLinkModel extends DefaultLinkModel {

    sending: boolean;
    sendingTimeout: NodeJS.Timeout | undefined;
    private sendingCallback?: (sending: boolean) => void;

    setSendingCallback(callback: (sending: boolean) => void) {

        this.sendingCallback = callback;
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

            this.sendingCallback?.(sending);
        }
    }

    constructor() {

        super({

            type: "midi-link",
            width: 3
        });

        this.options.extras = false;
        this.sending = false;
    }
}

namespace S {

    export const Keyframes = keyframes`
        from {

            stroke-dashoffset: 24;
        }
        to {

            stroke-dashoffset: 0;
        }
    `;

    const selected = css`
        stroke-dasharray: 10, 2;
        animation: ${Keyframes} 1s linear infinite;
    `;

    const sending = css`
        stroke-dasharray: 10, 1;
        stroke: lime;
        animation: ${Keyframes} 0.5s linear infinite;
    `;

    export const Path = styled.path<{ selected: boolean, sending: boolean }>`
        ${(p) => p.selected && selected};
        ${(p) => p.sending && sending};
        fill: none;
        pointer-events: auto;
    `;
}
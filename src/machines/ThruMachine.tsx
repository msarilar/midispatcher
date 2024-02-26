import styled from '@emotion/styled';
import { DiagramEngine } from '@projectstorm/react-diagrams-core';
import * as React from 'react';
import { AddBox, Clear } from '@mui/icons-material';
import { IconButton, TextField } from '@mui/material';

import { MidiLinkModel } from './../layout/Link';
import { MachineNodeModel } from './../layout/Node';
import { AbstractMachine, CustomNodeWidgetProps, MachineFactory, MachineMessage, MachineSourceTarget, MachineType, registeredMachine } from './Machines';

interface Filter {

    Category: number | undefined;
    Subcategory: number | undefined;
}

type FilterType = "none" | "allows" | "denies"

interface ThruConfig {

    detune: number;
    filterType: FilterType;
    filters: Filter[];
    currentCategory: number | undefined;
    currentSubcategory: number | undefined;
}

@registeredMachine
export class ThruMachine extends AbstractMachine implements MachineSourceTarget {

    static factory: MachineFactory;
    private config: ThruConfig;

    getFactory() { return ThruMachine.factory; }

    constructor(config?: ThruConfig) {

        super();

        this.config = config ?? { detune: 0, filterType: "none", filters: [], currentCategory: undefined, currentSubcategory: undefined };
        this.getNode().addMachineOutPort("Out", 0);
        this.getNode().addMachineInPort("In", 0);
    }

    getState() {

        return this.config;
    }

    static buildFactory(): MachineFactory {

        if (this.factory) {

            return this.factory;
        }

        this.factory = {

            createMachine(thruConfig?: ThruConfig) { return new ThruMachine(thruConfig); },
            createWidget(engine: DiagramEngine, node: MachineNodeModel): JSX.Element { return <ThruNodeWidget engine={engine} size={50} machine={node.machine as ThruMachine} />; },
            getName() { return "ThruMachine"; },
            getType() { return MachineType.Processor; },
            getTooltip() { return "Reads all MIDI messages, can apply a detune to any incoming NOTEON message as well as filtering specific MIDI messages"; },
            getMachineCode() { return "thru" }
        }

        return this.factory;
    }

    setState(options: ThruConfig) {

        this.config = options;
    }

    isFiltered(messageEvent: MachineMessage) {

        if (this.config.filterType === "none") {

            return false;
        }

        for (let i = 0; i < this.config.filters.length; i++) {

            const filter = this.config.filters[i];

            if (this.config.filterType === "denies") {

                if (filter.Category === messageEvent.message.rawData[0] && filter.Subcategory == undefined || filter.Subcategory === messageEvent.message.rawData[1]) {

                    return true;
                }
            }
            else {

                if (filter.Category === messageEvent.message.rawData[0] && filter.Subcategory == undefined || filter.Subcategory === messageEvent.message.rawData[1]) {

                    return false;
                }
            }
        }

        return this.config.filterType === "allows";
    }

    receive(messageEvent: MachineMessage, channel: number, link: MidiLinkModel) {

        if (this.isFiltered(messageEvent)) {

            return;
        }

        link.setSending(true);

        if (this.config.detune != 0 && (messageEvent.message.type === "noteon" || messageEvent.message.type === "noteoff")) {

            messageEvent = { ...messageEvent, message: { ...messageEvent.message, rawData: new Uint8Array(messageEvent.message.rawData) } };
            messageEvent.message.rawData[1] += this.config.detune;
        }

        this.emit(messageEvent, channel);
    }
}

const ThruNodeWidget: React.FunctionComponent<CustomNodeWidgetProps<ThruMachine>> = props => {

    const [state, setState] = React.useState(props.machine.getState());

    function update(newState: ThruConfig) {

        props.machine.setState(newState);
        setState(newState);
    }
    function filterRender(category: number | undefined,
        subcategory: number | undefined,
        action: "create" | number) {

        const actionButton = action === "create" ?
            <IconButton aria-label="add filter"
                color="primary"
                disabled={state.currentCategory == undefined && state.currentSubcategory == undefined}
                onClick={() => {

                    const newFilter: Filter = { Category: state.currentCategory, Subcategory: state.currentSubcategory };
                    update({ ...state, filters: state.filters.concat(newFilter), currentCategory: undefined, currentSubcategory: undefined });
                }}>
                <AddBox />
            </IconButton>
            : <IconButton aria-label="delete filter"
                color="primary"
                onClick={() => {

                    state.filters.splice(action, 1);
                    update({ ...state, filters: state.filters });
                }}>
                <Clear />
            </IconButton>;

        const isReadOnly = action === "create" ? false : true;

        return <S.SettingsBarVertical key={action}>
            <TextField value={category == undefined ? "" : category}
                type="number"
                size="small"
                onChange={e => action === "create" ? update({ ...state, currentCategory: parseInt(e.target.value) < 1 ? undefined : parseInt(e.target.value) }) : undefined}
                InputProps={{

                style: {

                    fontSize: '12px',
                    color: 'white',
                    height: '20px'
                },
                readOnly: isReadOnly,
            }} />
            <TextField value={subcategory == undefined ? "" : subcategory}
                type="number"
                size="small"
                onChange={e => action === "create" ? update({ ...state, currentSubcategory: parseInt(e.target.value) < 1 ? undefined : parseInt(e.target.value) }) : undefined}
                InputProps={{

                style: {

                    fontSize: '12px',
                    color: 'white',
                    height: '20px'
                },
                readOnly: isReadOnly
            }} />
            {actionButton}
        </S.SettingsBarVertical>
    }

    const filtersRender = state.filters.map((filter, i) =>
        filterRender(filter.Category, filter.Subcategory, i));

    return (
        <S.SettingsBar>
            <S.Slider>
                <span>Detune ({state.detune})</span>
                <input
                    type="range"
                    min="-12.0"
                    max="12.0"
                    step="1"
                    value={state.detune}
                    onChange={e => { update({ ...state, detune: Number(e.target.value) }) }}
                    list="detunes"
                    name="detune" />
                <datalist id="detunes">
                    <option value="-12.0" label="-1 octave"></option>
                    <option value="0" label="Normal"></option>
                    <option value="12.0" label="+1 octave"></option>
                </datalist>
            </S.Slider>
            MIDI Filtering:
            {filtersRender}
            {filterRender(state.currentCategory, state.currentSubcategory, "create")}
            <S.Dropdown>
                <span>filtering type: </span>
                <select name="filterType"
                    value={state.filterType}
                    onChange={e => { update({ ...state, filterType: e.target.value as FilterType }) }}>
                    <option value="none">None</option>
                    <option value="allows">Allows</option>
                    <option value="denies">Denies</option>
                </select>
            </S.Dropdown>
        </S.SettingsBar>
    );
}

namespace S {

    export const Dropdown = styled.div`
        vertical-align: middle;
        span {

            vertical-align: middle;
        }
        input {

            vertical-align: middle;
        }
    `;

    export const SettingsBarVertical = styled.div`
        position: relative;
        vertical-align: middle;
        width: 100%;
        height: 24px;
width: 200px;
        display: flex;
        justifyContent: "down";
        flex-direction: row;
    `;

    export const Slider = styled.div`
        vertical-align: middle;
        input {

            vertical-align: middle;
        }
        span {

            vertical-align: middle;
        }
    `;

    export const SettingsBar = styled.div`
        padding: 3px;
        position: relative;
        vertical-align: middle;
        width: 100%;
        display: flex;
        flex-direction: column;
    `;
}
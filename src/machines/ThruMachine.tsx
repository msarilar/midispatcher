import { DiagramEngine } from "@projectstorm/react-diagrams-core";
import * as React from "react";
import { AddBox, Clear } from "@mui/icons-material";
import { IconButton, Slider, TextField } from "@mui/material";

import { S } from "./MachineStyling";
import { MachineNodeModel } from "./../layout/Node";
import { AbstractMachine, CustomNodeWidgetProps, MachineFactory, MachineMessage, MachineSourceTarget, MachineType, MessageResult, registeredMachine } from "./Machines";
import { ON_MIDI_MESSAGE, standardMidiMessages } from "../Utils";
import { MidiSignalVizualizer } from "./Visualizers";

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
    logSize: number | undefined;
}

interface MessageEntry extends MachineMessage {

    accepted: boolean;
}

@registeredMachine
export class ThruMachine extends AbstractMachine implements MachineSourceTarget {

    static factory: MachineFactory;
    private config: ThruConfig;

    getFactory() { return ThruMachine.factory; }

    constructor(config?: ThruConfig) {

        super();

        this.config = config ?? { detune: 0, filterType: "none", filters: [], currentCategory: undefined, currentSubcategory: undefined, logSize: 10 };
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

        if (options.detune !== this.config.detune) {

            this.emit(standardMidiMessages["allnotesoff"], 0);
        }

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

    receive(messageEvent: MachineMessage, channel: number): MessageResult {

        if (this.isFiltered(messageEvent)) {

            this.dispatchEvent(new CustomEvent<MessageEntry>(ON_MIDI_MESSAGE, { detail: { ...messageEvent, accepted: false }}));
            return MessageResult.Ignored;
        }
        
        this.dispatchEvent(new CustomEvent<MessageEntry>(ON_MIDI_MESSAGE, { detail: { ...messageEvent, accepted: true }}));
        if (this.config.detune != 0 && (messageEvent.message.type === "noteon" || messageEvent.message.type === "noteoff")) {

            messageEvent = { ...messageEvent, message: { ...messageEvent.message, rawData: new Uint8Array(messageEvent.message.rawData) } };
            messageEvent.message.rawData[1] += this.config.detune;
        }

        this.emit(messageEvent, channel);
        return MessageResult.Processed;
    }
}

const ThruNodeWidget: React.FunctionComponent<CustomNodeWidgetProps<ThruMachine>> = props => {

    const [state, setState] = React.useState(props.machine.getState());
    const [messages, setMessages] = React.useState<MessageEntry[]>([]);

    const update = (newState: ThruConfig) => {

        props.machine.setState(newState);
        setState(newState);
    }

    React.useEffect(() => {

        const onMessage = (e: Event) => {

            const detail = (e as CustomEvent<MessageEntry>).detail;
            messages.push(detail);
            while (messages.length > (state.logSize ?? 10)) {
    
                messages.shift();
            }
    
            setMessages([...messages]);
        }

        props.machine.addEventListener(ON_MIDI_MESSAGE, onMessage);
        return (() => { props.machine.removeEventListener(ON_MIDI_MESSAGE, onMessage) } );
    }, [props.machine, state.logSize])

    function filterRender(category: number | undefined,
        subcategory: number | undefined,
        action: "create" | number) {

        const actionButton = action === "create" ?
            <IconButton aria-label="add filter"
                color="primary"
                size="small"
                disabled={state.currentCategory == undefined && state.currentSubcategory == undefined}
                onClick={() => {

                    const newFilter: Filter = { Category: state.currentCategory, Subcategory: state.currentSubcategory };
                    update({ ...state, filters: state.filters.concat(newFilter), currentCategory: undefined, currentSubcategory: undefined });
                }}>
                <AddBox fontSize="small"/>
            </IconButton>
            : <IconButton aria-label="delete filter"
                color="primary"
                size="small"
                onClick={() => {

                    state.filters.splice(action, 1);
                    update({ ...state, filters: state.filters });
                }}>
                <Clear fontSize="small"/>
            </IconButton>;

        const isReadOnly = action === "create" ? false : true;

        return <S.SettingsBarVertical key={action}>
            <TextField value={category == undefined ? "" : category}
                type="number"
                size="small"
                autoComplete="false"
                autoCorrect="false"
                onChange={e => action === "create" ? update({ ...state, currentCategory: parseInt(e.target.value) < 1 ? undefined : parseInt(e.target.value) }) : undefined}
                InputProps={{

                style: {

                    fontSize: "12px",
                    color: "white",
                    height: "20px",
                    width: "80px"
                },
                readOnly: isReadOnly
            }} />
            <TextField value={subcategory == undefined ? "" : subcategory}
                type="number"
                size="small"
                onChange={e => action === "create" ? update({ ...state, currentSubcategory: parseInt(e.target.value) < 1 ? undefined : parseInt(e.target.value) }) : undefined}
                InputProps={{

                    style: {

                        fontSize: "12px",
                        color: "white",
                        height: "20px",
                        width: "80px"
                    },
                    readOnly: isReadOnly
                }} />
            {actionButton}
        </S.SettingsBarVertical>
    }

    const filtersRender = state.filters.map((filter, i) =>
        filterRender(filter.Category, filter.Subcategory, i));

    const printMessageArray = (arr: Uint8Array) => {

        return `${arr[0].toString().padStart(3, "0")}-${arr[1]?.toString().padStart(3, "0") ?? "N/A"}-${arr[2]?.toString().padStart(3, "0") ?? "N/A"}`;
    }

    const messageLogs = messages.map((item, index) => {
        const rowContent = `${item.accepted ? "✔️" : "❌"}${(item.message.type ?? item.message.type).padEnd(12).substring(0, 12)} ${(printMessageArray(item.message.rawData)).padEnd(12).substring(0, 12)} #${item.message.channel}`;
        return <pre key={index}>
                <S.ConsoleLogEntry>{rowContent}</S.ConsoleLogEntry>
            </pre>;
    });

    const [ vizualizationOpened, setVizualizationOpened]  = React.useState(false);
    const [ logOpened, setLogOpened ] = React.useState(false);

    const toggleVizualization = () => {

        setVizualizationOpened(!vizualizationOpened);
    };

    const toggleLog = () => {

        setLogOpened(!logOpened);
    };

    const vizualizationArrow = vizualizationOpened ? "▲" : "▼";
    const logArrow = logOpened ? "▲" : "▼";

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
            
            <S.ExpandButton open={vizualizationOpened} onClick={toggleVizualization}>
                {vizualizationArrow} Vizualization {vizualizationArrow}
            </S.ExpandButton>
            <S.InternalWrapper open={vizualizationOpened}>
                <MidiSignalVizualizer width={200} height={200} midiMessageEmitter={props.machine} />
            </S.InternalWrapper>

            <S.ExpandButton open={logOpened} onClick={toggleLog}>
                {logArrow} Message logs {logArrow}
            </S.ExpandButton>
            <S.InternalWrapper open={logOpened}>
                {(state.logSize ?? 10) + " max messages"}
                <Slider aria-label="MaxMessages"
                    min={1}
                    max={100}
                    size="small"
                    onChange={(_, v) => {

                        if (typeof v === "number") {

                            update({ ...state, logSize: v })
                        }
                    }}
                    value={state.logSize ?? 10} />
                <S.ConsoleLog>
                <>
                    {messageLogs}
                </>
                </S.ConsoleLog>
            </S.InternalWrapper>
        </S.SettingsBar>
    );
}
import styled from '@emotion/styled';
import PlayArrowOutlined from '@mui/icons-material/PlayArrowOutlined';
import { DiagramEngine } from '@projectstorm/react-diagrams-core';
import * as React from 'react';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import { PauseOutlined, RestartAltOutlined } from '@mui/icons-material';

import { MachineNodeModel } from './../layout/Node';
import { AbstractMachine, CustomNodeWidgetProps, MachineFactory, MachineMessage, MachineSource, MachineType, registeredMachine } from './Machines';

type ClockStatus = "stop" | "start" | "continue";
interface ClockConfig {

    readonly tempo: number;
    readonly status: ClockStatus;
}

@registeredMachine
export class ClockMachine extends AbstractMachine implements MachineSource {

    private static factory: MachineFactory;
    private state: ClockConfig;
    private readonly worker: Worker;
    public hasWorker() { return this.worker != undefined };
    public static readonly messages: { [type: string]: MachineMessage } =
        {

            ["clock"]: { type: "clock", message: { rawData: Uint8Array.from([248]), isChannelMessage: false, type: "clock", channel: 0 } },
            ["start"]: { type: "start", message: { rawData: Uint8Array.from([250]), isChannelMessage: false, type: "start", channel: 0 } },
            ["continue"]: { type: "continue", message: { rawData: Uint8Array.from([251]), isChannelMessage: false, type: "continue", channel: 0 } },
            ["stop"]: { type: "stop", message: { rawData: Uint8Array.from([252]), isChannelMessage: false, type: "stop", channel: 0 } },
            ["allnotesoff"]: { type: "allnotesoff", message: { rawData: Uint8Array.from([176, 123, 0]), isChannelMessage: true, type: "allnotesoff", channel: 0 } },
            ["allsoundoff"]: { type: "allsoundoff", message: { rawData: Uint8Array.from([176, 120, 0]), isChannelMessage: true, type: "allsoundoff", channel: 0 } }
        };

    dispose() {

        this.worker.postMessage("stop");
        this.worker?.terminate()
        this.emit(ClockMachine.messages["stop"], 0);
    }

    getFactory() { return ClockMachine.factory; }

    setState(config: ClockConfig) {

        if (config.status == undefined) {

            return;
        }

        if (this.state.tempo !== config.tempo) {

            this.worker.postMessage({ tempo: config.tempo });
        }

        if (this.state.status !== config.status) {

            this.emit(ClockMachine.messages[config.status], 0);
        }

        if (this.state.status === "stop" && config.status !== "stop") {

            this.worker.postMessage("start");
        }

        if (config.status === "stop") {

            this.worker.postMessage("stop");

            this.emit(ClockMachine.messages["allnotesoff"], 0);
            this.emit(ClockMachine.messages["allsoundoff"], 0);
        }

        this.state = config;
    }

    getState() {

        return this.state;
    }

    private static readonly workerFunction = function () {

        let position: number = 0;
        let increment = 110;
        let running: boolean;

        function tick() {

            postMessage(null);

            const now = performance.now();
            if (position === 0) {

                position = now;
            }

            position += increment;
            const diff = position - now;

            if (running) {

                setTimeout(() => tick(), diff);
            }
        }

        onmessage = (e: MessageEvent) => {

            if (e.data === "start") {

                running = true;
                position = performance.now();
                setTimeout(() => tick(), 0);
            }
            else if (e.data.tempo) {

                increment = 60000 / (e.data.tempo * 24);
            }
            else if (e.data === "stop") {

                running = false;
            }
        };
    };

    constructor(clockConfig?: ClockConfig) {

        super();

        this.state = clockConfig ?? { tempo: 110, status: "stop" };
        this.state = { ...this.state, status: "stop" };

        let codeToString = ClockMachine.workerFunction.toString();
        let mainCode = codeToString.substring(codeToString.indexOf('{') + 1, codeToString.lastIndexOf('}'));
        let blob = new Blob([mainCode], { type: 'application/javascript' });
        let workerScript = URL.createObjectURL(blob);

        const that = this;
        this.worker = new Worker(workerScript);
        this.worker.onmessage = function (_: MessageEvent) {

            // assume all messages mean tick:
            that.emit(ClockMachine.messages["clock"], 0);
        }

        this.worker.postMessage({ tempo: this.state.tempo });

        this.getNode().addMachineOutPort("Out", 0);
    }

    static buildFactory(): MachineFactory {

        if (this.factory) {

            return this.factory;
        }

        this.factory = {

            createMachine(config?: ClockConfig) { return new ClockMachine(config); },
            createWidget(engine: DiagramEngine, node: MachineNodeModel) { return <ClockNodeWidget engine={engine} size={50} machine={node.machine as ClockMachine} />; },
            getName() { return "ClockMachine"; },
            getType() { return MachineType.System; },
            getTooltip() { return "Emits CLOCK message which can be used to command MIDI targets (on their system port) or Midispatcher's arpeggiator"; },
            getMachineCode() { return "clock" }
        }

        return this.factory;
    }
}

const ClockNodeWidget: React.FunctionComponent<CustomNodeWidgetProps<ClockMachine>> = props => {

    const [config, setConfig] = React.useState(props.machine.getState());

    function update(newConfig: ClockConfig) {

        props.machine.setState(newConfig);
        setConfig(newConfig);
    }

    return (
        <S.SettingsBar>
            <span>Tempo: {config.tempo}</span>
            <S.Slider>
                <input
                    type="range"
                    min="30"
                    max="240"
                    step="1"
                    value={config.tempo}
                    onChange={e => { update({ ...config, tempo: Number(e.target.value) }) }}
                    list="tempos"
                    name="tempo" />
                <datalist id="volumes">
                    <option value="110" label="Default"></option>
                </datalist>
            </S.Slider>
            <ToggleButtonGroup
                value={config.status}
                exclusive
                onChange={(_, v) => { update({ ...config, status: v as ClockStatus }) }}
                aria-label="text alignment">
                <ToggleButton value="continue" aria-label="continue">
                    <PlayArrowOutlined />
                </ToggleButton>
                <ToggleButton value="stop" aria-label="stop">
                    <PauseOutlined />
                </ToggleButton>
                <ToggleButton value="start" aria-label="start">
                    <RestartAltOutlined />
                    <PlayArrowOutlined />
                </ToggleButton>
            </ToggleButtonGroup>
        </S.SettingsBar>
    );
}

namespace S {

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
        justifyContent: "center";
        flex-direction: column;
    `;
}

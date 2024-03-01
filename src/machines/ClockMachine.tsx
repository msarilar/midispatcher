import PlayArrowOutlined from '@mui/icons-material/PlayArrowOutlined';
import { DiagramEngine } from '@projectstorm/react-diagrams-core';
import * as React from 'react';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import { PauseOutlined, RestartAltOutlined } from '@mui/icons-material';

import { S } from './MachineStyling';
import { MachineNodeModel } from './../layout/Node';
import { AbstractMachine, CustomNodeWidgetProps, MachineFactory, MachineSource, MachineType, registeredMachine } from './Machines';
import { standardMidiMessages } from '../Utils';

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

    dispose() {

        this.worker.postMessage("stop");
        this.worker?.terminate()
        this.emit(standardMidiMessages["stop"], 0);
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

            this.emit(standardMidiMessages[config.status], 0);
        }

        if (this.state.status === "stop" && config.status !== "stop") {

            this.emit(standardMidiMessages["allnotesoff"], 0);
            this.emit(standardMidiMessages["allsoundoff"], 0);

            this.worker.postMessage("start");
        }

        if (config.status === "stop") {

            this.worker.postMessage("stop");

            this.emit(standardMidiMessages["allnotesoff"], 0);
            this.emit(standardMidiMessages["allsoundoff"], 0);
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
            that.emit(standardMidiMessages["clock"], 0);
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

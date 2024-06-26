﻿import React from "react";
import Modal from "react-modal";

import { CanvasWidget, ZoomCanvasAction, InputType } from "@projectstorm/react-canvas-core";
import { Alert, AlertColor, Box, Snackbar, TextField } from "@mui/material";
import * as WebMidi from "webmidi";
import Disqus, { CommentCount } from "disqus-react"
import LZString from "lz-string";

import { WorkspaceButton, Workspace } from "./layout/Workspace";
import { Canvas } from "./layout/Canvas";
import { Tray, TrayItem } from "./layout/Tray";
import { LabelMachineFactory, MachineFactory, MachineType, registeredFactories } from "./machines/Machines";
import { MidiLinkFactory } from "./layout/Link";
import { engine, CommandManager, MidispatcherDiagramModel } from "./layout/Engine";
import { MachineNodeFactory, MachineNodeModel } from "./layout/Node";
import { MidiMachineSource, MidiMachineTarget } from "./machines/MidiMachines";
import { fromJson, toJson } from "./Utils";
import { MachinePortFactory } from "./layout/Port";
import { S } from "./layout/LayoutStyling";

const commandManager = new CommandManager(engine);
window.addEventListener("keydown", (event: any) => {

    if (event.keyCode === 90 && event.ctrlKey) {

        commandManager.undo();
        engine.repaintCanvas();
    }

    if (event.keyCode === 89 && event.ctrlKey) {

        commandManager.redo();
        engine.repaintCanvas();
    }
});

interface MidispatcherState {

    readonly update: boolean;
    readonly machineFactories: { [name: string]: MachineFactory };
    readonly modalContent: JSX.Element | undefined;
    readonly discussionVisible: boolean;
    readonly demos: { [name: string] : string } | undefined;
}

const defaultMidispatcherState: MidispatcherState = {

    update: false,
    machineFactories: {},
    modalContent: undefined,
    discussionVisible: false,
    demos: undefined
}

interface RefreshAction { }
interface ToggleDiscussAction { }
interface ToggleModalAction { modalContent: JSX.Element | undefined }
interface MidiLoadedAction { inputs: WebMidi.Input[], outputs: WebMidi.Output[] }
interface LoadSaveAction { data: string }
interface DemosLoadedAction { demos: { [name: string] : string } }

export enum MidispatcherActionType {

    Refresh = "Refresh",
    MidiLoaded = "MidiLoaded",
    ToggleModal = "ToggleModal",
    ToggleDiscuss = "ToggleDiscuss",
    LoadSave = "LoadSave",
    DemosLoaded = "DemosLoaded"
}

interface Action<TType, TValue> {

    readonly type: TType;
    readonly result: TValue;
}

export type MidispatcherAction =
    | Action<MidispatcherActionType.Refresh, RefreshAction>
    | Action<MidispatcherActionType.MidiLoaded, MidiLoadedAction>
    | Action<MidispatcherActionType.ToggleModal, ToggleModalAction>
    | Action<MidispatcherActionType.ToggleDiscuss, ToggleDiscussAction>
    | Action<MidispatcherActionType.LoadSave, LoadSaveAction>
    | Action<MidispatcherActionType.DemosLoaded, DemosLoadedAction>

let demoIndex = 0;

const Midispatcher: React.FunctionComponent = () => {

    const [toastOpened, setToastOpened] = React.useState<{ severity: AlertColor, content: string } | undefined>(undefined);
    const handleCloseToast = (e?: React.SyntheticEvent | Event, reason?: string) => {

        if (reason === 'clickaway') {

            return;
        }

        setToastOpened(undefined);
    };

    const onCycleDetected = () => {

        setToastOpened({ severity: "warning", content: "Cycle detected! To avoid infinite feedback loop, red links are disabled" });
    };

    const onCycleCleared = () => {

        setToastOpened({ severity: "success", content: "Cycle(s) cleared" });
    };

    const [state, dispatch] = React.useReducer(midispatcherReducer, defaultMidispatcherState);
    engine.getLinkFactories().registerFactory(new MidiLinkFactory());

    function midispatcherReducer(state: MidispatcherState, action: MidispatcherAction) {

        switch (action.type) {

            case MidispatcherActionType.LoadSave:

                engine.getModel().getNodes().forEach(node => {

                    (node as MachineNodeModel).dispose();
                });

                const model = new MidispatcherDiagramModel(commandManager, onCycleDetected, onCycleCleared);
                model.onCycleDetected = () => {

                    setToastOpened({ severity: "warning", content: "Cycle detected! To avoid infinite feedback loop, red links are disabled" });
                };
                model.onCycleCleared = () => {

                    setToastOpened({ severity: "success", content: "Cycle(s) cleared" });
                };

                try {

                    const json = fromJson(action.result.data);
                    model.deserializeModel(json, engine);
                    model.setGridSize(25);
                }
                catch (e) {

                    alert("Invalid save data:\r\n" + e);
                    console.error(e);
                    return state;
                }

                engine.setModel(model);
                model.setZoomLevel(100);
                model.realignGrid();
                engine.repaintCanvas();
                return state;
            case MidispatcherActionType.MidiLoaded:

                state.machineFactories["MIDI"] = new LabelMachineFactory(MachineType.System, "MIDI machines", "Receive/Send MIDI of your connected devices");
                action.result.inputs.forEach(input => {

                    const factory = MidiMachineSource.buildFactory(input, "midimessage");
                    state.machineFactories[factory.getName()] = factory;
                });

                action.result.outputs.forEach(input => {

                    const factory = MidiMachineTarget.buildFactory(input);
                    state.machineFactories[factory.getName()] = factory;
                });

                engine.getNodeFactories().deregisterFactory("machine");
                engine.getNodeFactories().registerFactory(new MachineNodeFactory(state.machineFactories));
                const totalDevices = action.result.inputs.length + action.result.outputs.length;
                setToastOpened({ severity: "success", content: `${totalDevices} MIDI device(s) loaded!` });

                return {

                    ...state,
                    update: !state.update
                }
            case MidispatcherActionType.Refresh:
                return {

                    ...state,
                    update: !state.update
                }
            case MidispatcherActionType.ToggleModal:
                return {

                    ...state,
                    modalContent: action.result.modalContent
                }

            case MidispatcherActionType.ToggleDiscuss:
                return {

                    ...state,
                    discussionVisible: !state.discussionVisible
                }
            case MidispatcherActionType.DemosLoaded:
                return {

                    ...state,
                    demos: action.result.demos
                }
            default:
                return state;
        }
    }

    // need this to run before first render:
    React.useMemo(() => {

        const model = new MidispatcherDiagramModel(commandManager, onCycleDetected, onCycleCleared);
        model.setGridSize(25);
        engine.setModel(model);
    }, []);

    React.useEffect(() => {
        engine.getPortFactories().registerFactory(new MachinePortFactory());

        const eventBus = engine.getActionEventBus();
        const action = eventBus.getActionsForType(InputType.MOUSE_WHEEL)[0];
        eventBus.deregisterAction(action);
        eventBus.registerAction(new ZoomCanvasAction( { inverseZoom: true }));

        Object.values(MachineType).forEach((key) => {

            const data = registeredFactories[key];
            state.machineFactories[key] = new LabelMachineFactory(key, key, data.tooltip);
            for (let i = 0;  i < data.factories.length; i++) {

                const factory = data.factories[i];
                state.machineFactories[factory.getName()] = factory;
            }
        });
        engine.getNodeFactories().registerFactory(new MachineNodeFactory(state.machineFactories));

        if (navigator.requestMIDIAccess != undefined) {

            WebMidi.WebMidi
                .enable()
                .then(() => dispatch({ type: MidispatcherActionType.MidiLoaded, result: { inputs: WebMidi.WebMidi.inputs, outputs: WebMidi.WebMidi.outputs } }))
                .catch(err => {

                    setToastOpened({ severity: "error", content: `Can't connect to your MIDI devices:\r\n${err}` });
                    dispatch({ type: MidispatcherActionType.MidiLoaded, result: { inputs: WebMidi.WebMidi.inputs, outputs: WebMidi.WebMidi.outputs } });
                });
        }
        else {

            setToastOpened({ severity: "error", content: "Can't connect to your MIDI devices:\r\nWeb MIDI API is not available on your browser" });
        }

        fetch("https://raw.githubusercontent.com/msarilar/midispatcher/main/saves/demos.json")
            .then(data => {

                if (data.ok) {

                    return data.text();
                }

                throw new Error("Unexpected HTTP " + data.status);
            })
            .then(json => dispatch({ type: MidispatcherActionType.DemosLoaded, result: { demos: JSON.parse(json) }}))
            .catch(err => {

                alert("Issue when trying to retrieve demos:\r\n" + err);
            });

        dispatch({ type: MidispatcherActionType.Refresh, result: {} });
    }, []);

    function onDrop<T>(event: React.DragEvent<T>) {

        var machineName = event.dataTransfer.getData("machine-name");

        const machineFactory = state.machineFactories[machineName];
        const machine = machineFactory.createMachine();
        const node = machine.getNode();

        var point = engine.getRelativeMousePoint(event);
        node.setPosition(point);
        engine.getModel().addAll(node);
        dispatch({ type: MidispatcherActionType.Refresh, result: {} });
    }

    function nextDemo() {

        if (state.demos == undefined) {

            return "";
        }

        demoIndex = (demoIndex + 1) % Object.values(state.demos).length;
        return Object.values(state.demos)[demoIndex];
    }

    const trayItems = Object.keys(state.machineFactories).map(machineName =>
        <TrayItem key={machineName + "TrayItemKey"} machineFactory={state.machineFactories[machineName]} />)

    const helpModalContent =
        <>
            <h2>How to use</h2><br />
            <p>
                📌 Drag and drop machines from the left into the workspace
            </p>
            <p>
                🔗 Connects OUT ports to IN ports
            </p>
            <br />
            <p>
                🤏 SHIFT+Click to select, DEL to delete
                <br />
                🗑️ SHIFT+Right Click to quick delete
            </p>
            <br />
            <p>
                🐌 If you notice performance issues, try closing other tabs or disable spectrograms/oscilloscopes by clicking on them
            </p>
            <br />
            <p>
                💀 Mostly developed & tested on Chromium based browsers
            </p>
            <br />
        </>

    function saveModalContent() {

        return <>
            <Box component="form"
                sx={{

                    "& .MuiTextField-root": { m: 1, width: "100ch" },
                }}
                noValidate
                autoComplete="off">
                <S.ScrollDiv>
                    <TextField
                        fullWidth={true}
                        id="outlined-multiline-static"
                        label="Save Data"
                        multiline
                        rows={10}
                        value={LZString.compressToBase64(toJson(engine.getModel().serialize()))}
                    />
                </S.ScrollDiv>
            </Box>

            <WorkspaceButton onClick={() => navigator.clipboard.writeText(LZString.compressToBase64(toJson(engine.getModel().serialize())))} color="success">Copy to clipboard</WorkspaceButton>
        </>;
    }

    const disqusShortname = "midispatcher";
    const disqusConfig = {

        url: "https://www.midispatcher.online",
        identifier: "midispatcher"
    };

    return (
        <Workspace
            buttons={[
                <WorkspaceButton key={"saveButtonKey"} onClick={() => dispatch({ type: MidispatcherActionType.ToggleModal, result: { modalContent: saveModalContent() } })}>
                    Save
                </WorkspaceButton>,
                <WorkspaceButton key={"loadButtonKey"} onClick={() => {

                    let data = window.prompt("Input save data here");
                    if (data) {

                        dispatch({ type: MidispatcherActionType.LoadSave, result: { data: LZString.decompressFromBase64(data)! } });
                    }
                }}>
                    Load
                </WorkspaceButton>,
                <WorkspaceButton key={"helpButtonKey"} onClick={() => dispatch({ type: MidispatcherActionType.ToggleModal, result: { modalContent: helpModalContent } })}>
                    Help
                </WorkspaceButton>,
                <WorkspaceButton disabled={state.demos == undefined} key={"nextDemoKey"} onClick={() => {

                    dispatch({ type: MidispatcherActionType.LoadSave, result: { data: LZString.decompressFromBase64(nextDemo())! } });
                }}>
                    Next Demo
                </WorkspaceButton>,
                <WorkspaceButton key={"discussButtonKey"}
                                 toggled={state.discussionVisible}
                                 onClick={() => dispatch({ type: MidispatcherActionType.ToggleDiscuss, result: {} })}>
                    <CommentCount config={disqusConfig} shortname={disqusShortname}>
                        Toggle Discuss
                    </CommentCount>
                </WorkspaceButton>
            ]}>

            <Modal isOpen={state.modalContent != undefined}
                onAfterOpen={undefined}
                onRequestClose={undefined}
                className="Modal"
                overlayClassName="Overlay"
                closeTimeoutMS={100}
                ariaHideApp={false}>
                {state.modalContent}
                <div className="flex-box">
                    <WorkspaceButton onClick={() => dispatch({ type: MidispatcherActionType.ToggleModal, result: { modalContent: undefined } })}>Close</WorkspaceButton>
                </div>
            </Modal>

            <S.Body>
                <S.MainContent>
                    <Tray>
                        {trayItems}
                    </Tray>
                    <S.Layer onDrop={onDrop}
                        onDragOver={(event) => {

                            event.preventDefault();
                        }}>
                        <Canvas>
                            <CanvasWidget engine={engine} />
                        </Canvas>
                    </S.Layer>
                </S.MainContent>
                <S.Disqus visible={state.discussionVisible}>
                    <Disqus.DiscussionEmbed shortname={disqusShortname} config={disqusConfig} />
                </S.Disqus>
            </S.Body>

            <Snackbar open={toastOpened != undefined}
                      autoHideDuration={toastOpened?.severity === "error" || toastOpened?.severity === "warning" ? undefined : 6000}
                      onClose={handleCloseToast}
                      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
                <Alert onClose={handleCloseToast}
                       severity={toastOpened?.severity}
                       variant="filled"
                       sx={{ width: '100%' }}>
                    {toastOpened?.content}
                </Alert>
            </Snackbar>
        </Workspace>
    )
}

export default Midispatcher;

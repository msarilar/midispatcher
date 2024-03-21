import { DataConnection, Peer } from "peerjs";
import { v4 as uuidv4 } from "uuid";

import { AbstractMachine, CustomNodeWidgetProps, MachineFactory, MachineMessage, MachineSource, MachineTarget, MachineType, MessageResult, registeredMachine } from "./Machines";
import React from "react";
import { S } from "./MachineStyling";
import { MachineNodeModel } from "../layout/Node";
import { DiagramEngine } from "@projectstorm/react-diagrams";
import { AddCircle, CachedOutlined, ContentCopyOutlined, RemoveCircle } from "@mui/icons-material";
import { Alert, Button, Tooltip, Typography, Zoom } from "@mui/material";
import { MachinePortModel } from "../layout/Port";
import { AllLinkCode } from "../layout/Engine";

const ON_STATUS_CHANGED: string = "onStateChanged";
const ON_REFRESH: string = "onRefresh";

interface RemoteMachineConfig {

    readonly channels: number;
    readonly dataChannelName: string;
    readonly targetChannelName: string | undefined;
}

interface ConnectionStatus {

    readonly status: string;
    readonly error: string | undefined;
    readonly connections: number;
    readonly channels: number;
}

@registeredMachine
export class EmittingRemoteMachine extends AbstractMachine implements MachineTarget {

    private static factory: MachineFactory;
    getFactory() { return EmittingRemoteMachine.factory; }

    private config: RemoteMachineConfig;

    private peer: Peer | undefined;
    private onStatusChanged: Event = new Event(ON_STATUS_CHANGED);
    public connectionStatus: ConnectionStatus;

    private readonly connections: Set<DataConnection> = new Set<DataConnection>();


    static buildFactory(): MachineFactory {

        if (this.factory) {

            return this.factory;
        }

        this.factory = {

            createMachine(config?: RemoteMachineConfig) {

                return new EmittingRemoteMachine(config);
            },
            createWidget(engine: DiagramEngine, node: MachineNodeModel) { return <EmittingRemoteNodeWidget engine={engine} size={50} machine={node.machine as EmittingRemoteMachine} />; },
            getType() { return MachineType.WebRTC; },
            getName() { return "EmittingRemoteMachine"; },
            getTooltip() { return "Reads messages and send them to a remote location"; },
            getMachineCode() { return "emitrtc" }
        }

        return this.factory;
    }

    getState() {

        return this.config;
    }

    dispose() {

        this.peer?.destroy();
    }

    addChannel() {

        this.config = { ...this.config, channels: this.config.channels + 1 };
        this.getNode().addMachineInPort("Channel " + this.config.channels, this.config.channels);
        this.send(this.config.channels);
    }

    removeChannel() {

        const port = this.getNode().getPort("Channel " + this.config.channels);
        if (port != undefined) {

            this.getNode().removePort(port as MachinePortModel);
            this.config = { ...this.config, channels: this.config.channels - 1 };
            this.send(this.config.channels);
        }
    }

    private setConnectionStatus(connectionStatus: ConnectionStatus) {

        this.connectionStatus = connectionStatus;
        this.dispatchEvent(this.onStatusChanged);
    }

    private constructor(config?: RemoteMachineConfig) {

        super();

        this.config = config ?? {

            channels: 1,
            dataChannelName: window.prompt("pick a unique name")!,
            targetChannelName: undefined
        };

        for (let i = 0; i < this.config.channels; i++) {

            this.getNode().addMachineInPort("Channel " + (i + 1), i + 1);
        }

        this.connectionStatus = {

            status: "loading",
            error: undefined,
            connections: 0,
            channels: 1
        };

        this.initPeer();
    }

    async initPeer() {

        this.peer?.destroy();
        const apiKey = process.env.REACT_APP_METERED_API_KEY ?? window.alert("missing api key in environment variable");
        const response = await fetch("https://midispatcher.metered.live/api/v1/turn/credentials?apiKey=" + apiKey);
        const iceServers = await response.json();
        
        const peerConfig = {

            iceServers: iceServers,
            sdpSemantics: "unified-plan",
        };

        const newPeer = new Peer(this.config.dataChannelName, {

            debug: 2,
            config: peerConfig
        });

        const that = this;
        this.peer = newPeer;

        this.peer.on("open", function (_) {
        
            that.setConnectionStatus({ ...that.connectionStatus, status: "waiting" });
        });
    
        this.peer.on("disconnected", function () {

            that.setConnectionStatus({ ...that.connectionStatus, status: "disconnected" });
        });

        this.peer.on("close", function() {

            that.setConnectionStatus({ ...that.connectionStatus, error: "closed", status: "closed" });
        });

        this.peer.on("error", function (err) {

            that.setConnectionStatus({ ...that.connectionStatus, error: err.message });
        });

        this.peer.on("connection", (conn) => {

            conn.on("iceStateChanged", d => {

                if (d === "disconnected" || d === "closed"  || d === "failed") {

                    that.setConnectionStatus({ ...that.connectionStatus, error: d, status: "ice disconnected" });
                }
                else {
                    
                    that.setConnectionStatus({ ...that.connectionStatus, error: undefined });
                }
            });

            conn.on("error", err => {

                this.connections.delete(conn);
                that.setConnectionStatus({ ...that.connectionStatus, error: err.message, connections: that.connectionStatus.connections - 1 });
            });

            conn.on("open", () => {

                this.connections.add(conn);
                this.send(that.config.channels);
                that.setConnectionStatus({ ...that.connectionStatus, error: undefined, connections: that.connectionStatus.connections + 1, status: "connected" });
            });

            conn.on("close", () => {

                this.connections.delete(conn);
                that.setConnectionStatus({ ...that.connectionStatus, error: undefined, connections: that.connectionStatus.connections - 1, status: that.connections.size > 1 ? "connected" : "waiting" });
            });
        });
    }

    private send(message: any) {

        for(const connection of this.connections) {

            connection.send(message);
        }
    }

    receive(messageEvent: MachineMessage, channel: number) {

        if (this.connections.size > 0) {

            const sanitizedMessage = {

                type: messageEvent.type,
                message: {

                    rawData: messageEvent.message.rawData,
                    isChannelMessage: messageEvent.message.isChannelMessage,
                    type: messageEvent.message.type,
                    channel: messageEvent.message.channel
                }
            }
            
            this.send({ messageEvent: sanitizedMessage, channel: channel });
            
            return MessageResult.Processed;
        }

        return MessageResult.Ignored;
    }
}

const EmittingRemoteNodeWidget: React.FunctionComponent<CustomNodeWidgetProps<EmittingRemoteMachine>> = props => {

    const [connectionStatus, setConnectionStatus] = React.useState(props.machine.connectionStatus);
    const [clipboardTooltipOpened, setClipboardTooltipOpened] = React.useState(false);
    const [channels, setChannels] = React.useState(props.machine.getState().channels);

    React.useEffect(() => {

        props.machine.addEventListener(ON_STATUS_CHANGED, () => {

            setConnectionStatus(props.machine.connectionStatus);
        });
    }, [props.machine]);

    const errorBlock = connectionStatus.error == undefined ? undefined :
        <Alert severity="error">
            {connectionStatus.error}
        </Alert>

    const titleClicked = () => {

        navigator.clipboard.writeText(props.machine.getState().dataChannelName);
        setClipboardTooltipOpened(true);
        setTimeout(() => { setClipboardTooltipOpened(false); }, 1000);
    };

    const addChannel = () => {

        props.machine.addChannel();
        props.engine.repaintCanvas();
        setChannels(props.machine.getState().channels);
    };

    const removeChannel = () => {

        props.machine.removeChannel();
        props.engine.repaintCanvas();
        setChannels(props.machine.getState().channels);
    };

    const forceReconnectClicked = () => {

        props.machine.initPeer();
    };

    return (
        <S.SettingsBarHorizontal>
            <S.SettingsBarVertical>
                <Typography variant="body2" align="center">
                    <Button size="small" onClick={addChannel}><AddCircle fontSize="small"/></Button>
                    <Button disabled={channels === 1} size="small" onClick={removeChannel}><RemoveCircle fontSize="small"/></Button>
                </Typography >

                <S.SettingsBarHorizontal>
                    <Tooltip
                        PopperProps={{ disablePortal: true }}
                        open={clipboardTooltipOpened}
                        disableFocusListener
                        disableHoverListener
                        disableTouchListener
                        followCursor={true}
                        title="Copied!"
                        TransitionComponent={Zoom}>
                        <Typography variant="h6" align="center">
                            { "<" + props.machine.getState().dataChannelName + ">" }
                            <Button onClick={titleClicked}><ContentCopyOutlined/></Button>
                        </Typography >
                    </Tooltip>
                    
                    <Typography variant="body2" align="center">{ connectionStatus.connections } connected</Typography >
                    <Typography variant="body2" align="center">{ connectionStatus.status }</Typography >
                    <Button onClick={forceReconnectClicked}>
                        <Typography variant="body2" align="center">Reconnect</Typography >
                        <CachedOutlined/>
                    </Button>
                </S.SettingsBarHorizontal>
            </S.SettingsBarVertical>
            { errorBlock }
        </S.SettingsBarHorizontal>
    );
}


@registeredMachine
export class ReceivingRemoteMachine extends AbstractMachine implements MachineSource {

    private static factory: MachineFactory;
    getFactory() { return ReceivingRemoteMachine.factory; }

    private readonly config: RemoteMachineConfig;

    private peer: Peer | undefined;
    private onStatusChanged: Event = new Event(ON_STATUS_CHANGED);
    private onRefresh: Event = new Event(ON_REFRESH);
    public connectionStatus: ConnectionStatus;

    static buildFactory(): MachineFactory {

        if (this.factory) {

            return this.factory;
        }

        this.factory = {

            createMachine(config?: RemoteMachineConfig) {

                return new ReceivingRemoteMachine(config);
            },
            createWidget(engine: DiagramEngine, node: MachineNodeModel) { return <ReceivingRemoteNodeWidget engine={engine} size={50} machine={node.machine as ReceivingRemoteMachine} />; },
            getType() { return MachineType.WebRTC; },
            getName() { return "ReceivingRemoteMachine"; },
            getTooltip() { return "Receives message from remote location"; },
            getMachineCode() { return "receivertc" }
        }

        return this.factory;
    }

    getState() {

        return this.config;
    }

    dispose() {

        this.peer?.destroy();
    }

    private setConnectionStatus(connectionStatus: ConnectionStatus) {

        this.connectionStatus = connectionStatus;
        this.dispatchEvent(this.onStatusChanged);
    }

    private constructor(config?: RemoteMachineConfig) {

        super();

        this.config = config ?? {

            channels: 1,
            dataChannelName: uuidv4(),
            targetChannelName: window.prompt("target name ?") ?? undefined
        };

        this.getNode().addMachineOutPort(AllLinkCode, 0);
        for (let i = 0; i < this.config.channels; i++) {

            this.getNode().addMachineOutPort("Channel " + (i + 1), i + 1);
        }

        this.connectionStatus = {

            status: "loading",
            error: undefined,
            connections: 0,
            channels: 1
        };

        this.initPeer();
    }

    async initPeer() {

        this.peer?.destroy();
        const apiKey = process.env.REACT_APP_METERED_API_KEY ?? window.alert("missing api key in environment variable");
        const response = await fetch("https://midispatcher.metered.live/api/v1/turn/credentials?apiKey=" + apiKey);
        const iceServers = await response.json();
        
        const peerConfig = {

            iceServers: iceServers,
            sdpSemantics: "unified-plan",
        };

        const newPeer = new Peer(this.config.dataChannelName, {
            debug: 2,
            config: peerConfig
        });;

        this.peer = newPeer;

        const that = this;
        
        this.peer.on("disconnected", function () {

            that.setConnectionStatus({ ...that.connectionStatus, status: "disconnected" });
        });

        this.peer.on("close", function() {

            that.setConnectionStatus({ ...that.connectionStatus, error: "closed", status: "disconnected" });
        });

        this.peer.on("error", function (err) {

            that.setConnectionStatus({ ...that.connectionStatus, error: err.message, status: "error" });
        });

        this.peer.on("open", _ => {

            that.setConnectionStatus({ ...that.connectionStatus, status: "waiting" });
            const connection = newPeer.connect(that.config.targetChannelName ?? window.prompt("target name?")!, {

                reliable: true
            });

            that.setConnectionStatus({ ...that.connectionStatus, error: undefined, status: "connecting..." });

            connection.on("iceStateChanged", d => {

                if (d === "disconnected" || d === "closed"  || d === "failed") {

                    that.setConnectionStatus({ ...that.connectionStatus, error: d, status: "ice disconnected" });
                }
                else {
                    
                    that.setConnectionStatus({ ...that.connectionStatus, error: undefined });
                }
            })
        
            connection.on("close", () => {

                that.setConnectionStatus({ ...that.connectionStatus, error: "closed", status: "disconnected" });
            });
    
            connection.on("error", e => {

                that.setConnectionStatus({ ...that.connectionStatus, error: e.message });
            });

            connection.on("open", () => {

                that.setConnectionStatus({ ...that.connectionStatus, error: undefined, status: "connected" });
            });

            connection.on("data", (message: any) => {
                
                const messageEvent = message.messageEvent;
                if (messageEvent != undefined) {

                    // rawData is an Uint8Array and binarypack serializes it into an ArrayBuffer, need to convert back:
                    const array = messageEvent.message.rawData;
                    messageEvent.message.rawData = new Uint8Array(array);
                    this.emit(messageEvent, message.channel);
                }
                else if (Number.isFinite(message)) {

                    const channels = (message as number) + 1;
                    while (channels < this.getNode().getOutPorts().length) {

                        const lastPort = this.getNode().getOutPorts()[this.getNode().getOutPorts().length - 1];
                        this.getNode().removePort(lastPort)
                    }
                    
                    while (channels > this.getNode().getOutPorts().length) {

                        this.getNode().addMachineOutPort("Channel " + this.getNode().getOutPorts().length, this.getNode().getOutPorts().length)
                    }

                    this.dispatchEvent(this.onRefresh);
                }
                else {

                    console.warn("unknown RTC message\n" + JSON.stringify(message));
                }
            });
        });
    }
}

const ReceivingRemoteNodeWidget: React.FunctionComponent<CustomNodeWidgetProps<ReceivingRemoteMachine>> = props => {

    const [connectionStatus, setConnectionStatus] = React.useState(props.machine.connectionStatus);

    React.useEffect(() => {

        const onStatusChanged = () => {

            setConnectionStatus(props.machine.connectionStatus);
        };
        props.machine.addEventListener(ON_STATUS_CHANGED, onStatusChanged);

        const onRefresh = () => {

            props.engine.repaintCanvas();
        }
        
        props.machine.addEventListener(ON_REFRESH, onRefresh);

        return () => {

            props.machine.removeEventListener(ON_STATUS_CHANGED, onStatusChanged);
            props.machine.removeEventListener(ON_REFRESH, onRefresh);
        }
    }, [props.machine, props.engine]);

    const errorBlock = connectionStatus.error == undefined ? undefined :
        <Alert severity="error">
            {connectionStatus.error}
        </Alert>

    const forceReconnectClicked = () => {

        props.machine.initPeer();
    };

    return (
        <S.SettingsBarHorizontal>
            <Typography variant="h6" align="center">
                { "target: <" + props.machine.getState().targetChannelName + ">" }
            </Typography >
            
            <Typography variant="body2" align="center">{ connectionStatus.status }</Typography >
            <Button onClick={forceReconnectClicked}>
                <Typography variant="body2" align="center">Reset</Typography >
                <CachedOutlined/>
            </Button>
            { errorBlock }
        </S.SettingsBarHorizontal>
    );
}

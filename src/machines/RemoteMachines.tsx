import { DataConnection, Peer } from "peerjs";
import { v4 as uuidv4 } from 'uuid';

import { AbstractMachine, CustomNodeWidgetProps, MachineFactory, MachineMessage, MachineSource, MachineTarget, MachineType, registeredMachine } from "./Machines";
import { MidiLinkModel } from "../layout/Link";
import React from "react";
import { S } from "./MachineStyling";
import { MachineNodeModel } from "../layout/Node";
import { DiagramEngine } from "@projectstorm/react-diagrams";

interface RemoteMachineConfig {

    readonly channels: number;
    readonly dataChannelName: string;
}

@registeredMachine
export class EmittingRemoteMachine extends AbstractMachine implements MachineTarget {

    private static factory: MachineFactory;
    getFactory() { return EmittingRemoteMachine.factory; }

    private readonly config: RemoteMachineConfig;

    private peer: Peer | undefined;

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

    private constructor(config?: RemoteMachineConfig) {

        super();

        this.config = config ?? {

            channels: 1,
            dataChannelName: window.prompt("pick a unique name")!
        };

        for (let i = 0; i < this.config.channels; i++) {

            this.getNode().addMachineInPort("Channel " + (i + 1), i + 1);
        }

        this.initPeer();
    }

    async initPeer() {

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

        this.peer = newPeer;

        this.peer.on("open", function (id) {
        
            console.log(newPeer.id + " ID: " + id);
        });
    
        this.peer.on("disconnected", function () {
            console.log(newPeer.id + " disconnected");
        });
        this.peer.on("close", function() {
            console.log(newPeer.id + " Connection destroyed");
        });
        this.peer.on('error', function (err) {
            console.log(newPeer.id + " " + err);
        });

        this.peer.on("connection", (conn) => {

            console.log(newPeer.id + " received connection " + conn.dataChannel + " (" + conn.connectionId + ")");

            console.log("conn:");
            console.log(conn);


            conn.on("data", d => {

                console.log("data:");
                console.log(d);
            });

            conn.on("iceStateChanged", d => {

                console.log("iceStateChanged:");
                console.log(d);
            });

            conn.on("error", err => {

                console.error(err);
            });

            conn.on("open", () => {
                
                console.log("connection opened");
                this.connections.add(conn);
            });

            conn.on("close", () => {

                console.log("connection closed");
                this.connections.delete(conn);
            })
        });
    }

    receive(messageEvent: MachineMessage, channel: number, link: MidiLinkModel) {

        if (this.connections.size > 0) {

            link.setSending(true);
            for(const connection of this.connections) {

                const messageEventAndChannel = { messageEvent: messageEvent, channel: channel };
                connection.send(messageEventAndChannel);
            }
        }
    }
}

const EmittingRemoteNodeWidget: React.FunctionComponent<CustomNodeWidgetProps<EmittingRemoteMachine>> = props => {

    const [status, setStatus] = React.useState({ text: "waiting", connections: 0 });

    React.useEffect(() => {

    }, []);

    return (
        <S.SettingsBarHorizontal>
        </S.SettingsBarHorizontal>
    );
}

@registeredMachine
export class ReceivingRemoteMachine extends AbstractMachine implements MachineSource {

    private static factory: MachineFactory;
    getFactory() { return ReceivingRemoteMachine.factory; }

    private readonly config: RemoteMachineConfig;

    private peer: Peer | undefined;

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

    private constructor(config?: RemoteMachineConfig) {

        super();

        this.config = config ?? {

            channels: 1,
            dataChannelName: uuidv4()
        };

        for (let i = 0; i < this.config.channels; i++) {

            this.getNode().addMachineOutPort("Channel " + (i + 1), i + 1);
        }

        this.initPeer();
    }

    async initPeer() {

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

        this.peer.on("open", id => {

            const connection = newPeer.connect(window.prompt("target name?")!, {

                reliable: true
            });

            console.log(connection);

            connection.on("iceStateChanged", s => {

                console.log(s);
            })
        
            connection.on("close", () => {

                console.log("closed");
            });
    
            connection.on("error", e => {

                console.error(e);
            });

            connection.on("open", () => {

                console.log("connected");
            });

            connection.on("data", (messageEventAndChannel: any) => {
                
                const messageEvent = messageEventAndChannel.messageEvent;
                if (messageEvent != undefined) {

                    // rawData is an Uint8Array and binarypack serializes it into an ArrayBuffer, need to convert back:
                    const array = messageEvent.message.rawData;
                    messageEvent.message.rawData = new Uint8Array(array);
                    this.emit(messageEvent, messageEventAndChannel.channel);
                }
                else {

                    console.warn("unknown RTC message\n" + JSON.stringify(messageEventAndChannel));
                }
            });
        });

        setUpLog(this.peer);
    }
}

const ReceivingRemoteNodeWidget: React.FunctionComponent<CustomNodeWidgetProps<ReceivingRemoteMachine>> = props => {

    const [status, setStatus] = React.useState("waiting");

    React.useEffect(() => {

    }, []);

    return (
        <S.SettingsBarHorizontal>
        </S.SettingsBarHorizontal>
    );
}

function setUpLog(peer: Peer) {

    peer.on("open", function (id) {
        
        console.log(peer.id + " ID: " + id);
    });
    peer.on("connection", function (c) {
        
        console.log(peer.id + " received connection " + c.dataChannel + " (" + c.connectionId + ")");
    });
    peer.on("disconnected", function () {
        console.log(peer.id + " disconnected");
    });
    peer.on("close", function() {
        console.log(peer.id + " Connection destroyed");
    });
    peer.on('error', function (err) {
        console.log(peer.id + " " + err);
    });
}
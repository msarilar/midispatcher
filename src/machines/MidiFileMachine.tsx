import * as MidiParser from "midi-parser-js";
import * as WebMidi from "webmidi";

import { AllLinkCode } from "../layout/Engine";
import { AbstractMachine, MachineFactory, MachineMessage, MachineSourceTarget, MachineType, MessageResult, registeredMachine } from "./Machines";

interface TrackEvent extends MachineMessage {

    deltaTime: number;
}

interface Track {

    events: TrackEvent[];
    currentClock: number;
    currentEvent: number;
    name: string;
    voices: number;
}

interface MidiFileConfig {

    tracks: Track[];
    timeDivision: number;
    fileName: string;
}

@registeredMachine
export class MidiFileMachine extends AbstractMachine implements MachineSourceTarget {

    private static factory: MachineFactory;
    private config: MidiFileConfig;
    private playing: boolean = false;

    getFactory() { return MidiFileMachine.factory; }

    static buildFactory(): MachineFactory {

        if (this.factory) {

            return this.factory;
        }

        this.factory = {

            createMachine(midiFileConfig?: MidiFileConfig): AbstractMachine {return new MidiFileMachine(midiFileConfig); },
            getType() { return MachineType.Emitter; },
            getName(): string { return "MidiFile"; },
            getTooltip() { return "Reads CLOCK message and sends out MIDI from file content"; },
            getMachineCode() { return "midifile" }
        }

        return this.factory;
    }

    getState() {

        return this.config;
    }

    constructor(config?: MidiFileConfig) {

        super();

        if (config == undefined) {

            config = { tracks: [], timeDivision: 0, fileName: "None" };
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".mid, .midi";
            MidiParser.parse(input, (obj: any) => {

                const parsedConfig = MidiFileMachine.createMidiConfig(obj, input);

                this.getNode().addMachineOutPort(AllLinkCode, 0);

                for(let i = 0; i < parsedConfig.tracks.length; i++) {

                    this.getNode().addMachineOutPort(parsedConfig.tracks[i].name, i + 1);
                }

                // force visually refresh:
                this.getNode().setSelected(true);
                this.getNode().setSelected(false);

                this.config = parsedConfig;
            });

            input.click();
        }
        else {

            this.getNode().addMachineOutPort(AllLinkCode, 0);

            for (let i = 0; i < config.tracks.length; i++) {

                this.getNode().addMachineOutPort(config.tracks[i].name + "(" + i + ")", i + 1);
                config.tracks[i].currentClock = 0;
                config.tracks[i].currentEvent = 0;
            }
        }

        this.config = config;
        this.getNode().addMachineInPort("Clock", 1);
    }

    static createMidiConfig(obj: any, input: HTMLInputElement): MidiFileConfig {

        const tracks: Track[] = [];

        for (let i = 0; i < obj.track.length; i++) {

            let rawTrack = obj.track[i];
            let trackName = undefined;
            let events: TrackEvent[] = []
            let voices = 0;
            let maxVoices = 0;
            for (let j = 0; j < obj.track[i].event.length; j++) {

                let rawEvent = rawTrack.event[j];
                if ((rawEvent.metaType === 3 || rawEvent.metaType === 1) && trackName == undefined) {

                    trackName = rawEvent.data + " ";
                }

                const data = [];
                data.push(rawEvent.type << 4);
                if (Array.isArray(rawEvent.data)) {

                    rawEvent.data.forEach((d: number) => {

                        data.push(d);
                    });
                }
                else {

                    data.push(rawEvent.data);
                }

                const rawDataParsed = Uint8Array.from(data);
                const midiMessage = new WebMidi.Message(rawDataParsed);

                const messageEvent = {

                    type: midiMessage.type,
                    message: {

                        rawData: rawDataParsed,
                        isChannelMessage: midiMessage.isChannelMessage,
                        type: midiMessage.type,
                        channel: i + 1
                    }
                };

                if (messageEvent.type === "noteon" && messageEvent.message.rawData[2] !== 0) {

                    voices++;
                    maxVoices = Math.max(maxVoices, voices);
                }
                else if (messageEvent.type === "noteoff" || (messageEvent.type === "noteon" && messageEvent.message.rawData[2] === 0)) {

                    voices = Math.max(0, voices - 1);
                }

                events.push({

                    ...messageEvent, deltaTime: rawEvent.deltaTime
                });
            }

            let label = (i + 1) + ". " + (trackName ?? "unknown");
            if (maxVoices > 1) {

                label += " (" + maxVoices + " voices)";
            }
            else if (maxVoices == 1) {

                label += " (mono)";
            }
            else {

                label += " (silent)";
            }

            tracks.push({

                currentClock: 0,
                currentEvent: 0,
                name: label,
                events,
                voices: maxVoices
            });
        }

        return {

            tracks,
            timeDivision: obj.timeDivision,
            fileName: input.value.replace(/^.*[\\/]/, '')
        };
    }

    receive(messageEvent: MachineMessage, _: number) {

        switch (messageEvent.message.type) {

            case "allnotesoff":
                for(let i = 0; i < this.config.tracks.length; i++) {

                    this.emit(messageEvent, i + 1);
                }

                return MessageResult.Processed;

            case "continue":
                this.playing = true;
                return MessageResult.Processed;

            case "start":
                this.playing = true;
                for(let i = 0; i < this.config.tracks.length; i++) {

                    this.config.tracks[i].currentClock = 0;
                    this.config.tracks[i].currentEvent = 0;
                }

                return MessageResult.Processed;

            case "stop":
                this.playing = false;
                for(let i = 0; i < this.config.tracks.length; i++) {

                    this.emit(messageEvent, i + 1);
                }

                return MessageResult.Processed;
                
            case "clock":
                if (!this.playing) {
                    
                    return MessageResult.Ignored;
                }

                const toPlay = [];
                for(let currentTrack = 0; currentTrack < this.config.tracks.length; currentTrack++) {

                    const track = this.config.tracks[currentTrack];

                    if (track.events.length > track.currentEvent) {

                        track.currentClock += this.config.timeDivision / 24.;

                        while (track.events[track.currentEvent] != undefined && track.events[track.currentEvent].deltaTime <= track.currentClock) {

                            if (track.events[track.currentEvent].type !== "sysex") {

                                toPlay.push({signal:track.events[track.currentEvent], channel: currentTrack + 1});
                            }

                            const diff = track.currentClock - track.events[track.currentEvent].deltaTime;

                            track.currentEvent++;
                            track.currentClock = 0;

                            if (diff > 0 && track.events[track.currentEvent] != undefined) {

                                track.currentClock += diff;
                            }
                        }
                    }
                }

                for(let i = 0; i < toPlay.length; i++) {

                    this.emit(toPlay[i].signal, toPlay[i].channel);
                }

                return MessageResult.Processed;
        }

        return MessageResult.Ignored;
    }
}

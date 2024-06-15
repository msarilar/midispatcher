import * as WebMidi from "webmidi";
import { MachineMessage } from "./machines/Machines";

export const allNotes = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B"
];

export const ON_MIDI_MESSAGE: string = "onMidiMessage";

const noteMidiToStringCache: { [index: number]: [string, number] } = {}
export function noteMidiToString(n: number): string {

    const [note, octave]: [string, number] = noteMidiToStringSeparated(n);
    return note + octave;
}

export function noteMidiToStringSeparated(n: number): [string, number] {

    if (noteMidiToStringCache[n] != undefined) {

        return noteMidiToStringCache[n];
    }

    const oct = Math.floor(n / 12) - 1;
    const note = n % 12;
    const result: [string, number] = [allNotes[note], oct];

    noteMidiToStringCache[n] = result;

    return result;
}

const notesRawDataCache: { [note: string]: Uint8Array } = { }

export function noteStringToNoteMidi(noteString: string): Uint8Array {

    if (!notesRawDataCache[noteString]) {

        const note = WebMidi.Utilities.buildNote(noteString, { rawAttack: 150 });
        notesRawDataCache[noteString] = Uint8Array.from([
            (WebMidi.Enumerations.CHANNEL_MESSAGES.noteon << 4),
            note.getOffsetNumber(WebMidi.WebMidi.octaveOffset),
            note.rawAttack]);
    }

    return notesRawDataCache[noteString];
}

export function normalizeVelocity(v: number) {

    return v / 127;
}

export const standardMidiMessages: { [type: string]: MachineMessage } =  {

    "clock": { type: "clock", message: { rawData: Uint8Array.from([248]), isChannelMessage: false, type: "clock", channel: 0 } },
    "start": { type: "start", message: { rawData: Uint8Array.from([250]), isChannelMessage: false, type: "start", channel: 0 } },
    "continue": { type: "continue", message: { rawData: Uint8Array.from([251]), isChannelMessage: false, type: "continue", channel: 0 } },
    "stop": { type: "stop", message: { rawData: Uint8Array.from([252]), isChannelMessage: false, type: "stop", channel: 0 } },
    "allnotesoff": { type: "allnotesoff", message: { rawData: Uint8Array.from([176, 123, 0]), isChannelMessage: true, type: "allnotesoff", channel: 0 } },
    "allsoundoff": { type: "allsoundoff", message: { rawData: Uint8Array.from([176, 120, 0]), isChannelMessage: true, type: "allsoundoff", channel: 0 } }
};

export const gsStandardSetDrumKitMini: { [index: string]: string } = {
    "B1": "Kick Drum 2",
    "C2": "Kick Drum 1",
    "D2": "Snare Drum 1",
    "D#2": "Hand Clap",
    "E2": "Snare Drum 2",
    "F#2": "Closed Hi-Hat",
    "G#2": "Pedal Hi-Hat",
    "A#2": "Open Hi-Hat",
    "C#3": "Crash Cymbal 1",
    "D#3": "Ride Cymbal 1",
    "G#3": "Cowbell",
}

export const gsStandardSetDrumKitToms: { [index: string]: string } = {
    "F2": "Low Tom 2",
    "G2": "Low Tom 1",
    "A2": "Mid Tom 2",
    "B2": "Mid Tom 1",
    "C3": "High Tom 2",
    "D3": "High Tom 1",
    "C4": "High Bongo",
    "C#4": "Low Bongo",
}

export const gsStandardSetDrumKit: { [index: string]: string } = {

    "A#0": "MC-500 Beep 1",
    "B0": "MC-500 Beep 2",
    "C1": "Concert Snare Drum",
    "C#1": "Snare Roll",
    "D1": "Finger Snap 2",
    "D#1": "High Q",
    "E1": "Slap",
    "F1": "Scratch Push",
    "F#1": "Scratch Pull",
    "G1": "Sticks",
    "G#1": "Square Click",
    "A1": "Metronome Click",
    "A#1": "Metronome Bell",
    "B1": "Kick Drum 2",
    "C2": "Kick Drum 1",
    "C#2": "Side Stick",
    "D2": "Snare Drum 1",
    "D#2": "Hand Clap",
    "E2": "Snare Drum 2",
    "F2": "Low Tom 2",
    "F#2": "Closed Hi-Hat",
    "G2": "Low Tom 1",
    "G#2": "Pedal Hi-Hat",
    "A2": "Mid Tom 2",
    "A#2": "Open Hi-Hat",
    "B2": "Mid Tom 1",
    "C3": "High Tom 2",
    "C#3": "Crash Cymbal 1",
    "D3": "High Tom 1",
    "D#3": "Ride Cymbal 1",
    "E3": "Chinese Cymbal",
    "F3": "Ride Bell",
    "F#3": "Tambourine",
    "G3": "Splash Cymbal",
    "G#3": "Cowbell",
    "A3": "Crash Cymbal 2",
    "A#3": "Vibraslap",
    "B3": "Ride Cymbal 2",
    "C4": "High Bongo",
    "C#4": "Low Bongo",
    "D4": "Mute High Conga",
    "D#4": "Open High Conga",
    "E4": "Low Conga",
    "F4": "High Timbale",
    "F#4": "Low Timbale",
    "G4": "High Agogo",
    "G#4": "Low Agogo",
    "A4": "Cabasa",
    "A#4": "Maracas",
    "B4": "Short High Whistle",
    "C5": "Long Low Whistle",
    "C#5": "Short Guiro",
    "D5": "Long Guiro",
    "D#5": "Claves",
    "E5": "High Wood Block",
    "F5": "Low Wood Block",
    "F#5": "Mute Cuica",
    "G5": "Open Cuica",
    "G#5": "Mute Triangle",
    "A5": "Open Triangle",
    "A#5": "Shaker",
    "B5": "Jingle Bell",
    "C6": "Bell Tree",
    "C#6": "Castanets",
    "D6": "Mute Surdo",
    "D#6": "Open Surdo",
    "E6": "Applause 2"
};

var context = typeof window === "undefined" ? global : window;
const FLAG_TYPED_ARRAY = "FLAG_TYPED_ARRAY";

export const toJson = (obj: any): string => JSON.stringify(obj, function (_, value) {

    if (value instanceof Int8Array ||
        value instanceof Uint8Array ||
        value instanceof Uint8ClampedArray ||
        value instanceof Int16Array ||
        value instanceof Uint16Array ||
        value instanceof Int32Array ||
        value instanceof Uint32Array ||
        value instanceof Float32Array ||
        value instanceof Float64Array) {
        var replacement = {
            constructor: value.constructor.name,
            data: Array.apply([], value as any),
            flag: FLAG_TYPED_ARRAY
        }
        return replacement;
    }
    return value;
});

export const fromJson = (jsonStr: string): any => JSON.parse(jsonStr, function (_, value) {

    try {

        if (value.flag != undefined && value.flag === FLAG_TYPED_ARRAY) {

            const constr = (context as any)[value.constructor];
            return new constr(value.data);
        }
    }
    catch (e) { }

    return value;
});

export const notesOff: Uint8Array[] = [];
for (let i = 0; i < 128; i++) {

    notesOff.push(Uint8Array.from([
        (WebMidi.Enumerations.CHANNEL_MESSAGES.noteoff << 4),
        i,
        0]));
}

export const scalesOffsets: { [key: string]: number[] } = {
    "Aeolian": [0, 2, 3, 5, 7, 8, 10],
    "Algerian": [0, 2, 3, 6, 7, 8, 11],
    "Altered": [0, 1, 3, 4, 6, 8, 10],
    "Augmented": [0, 3, 4, 7, 8, 11],
    "Bayātī": [0, 1, 4, 5, 7, 8, 10],
    "Blues": [0, 3, 5, 6, 7, 10],
    "Chromatic": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    "Dorian": [0, 2, 3, 5, 7, 9, 10],
    "Harmonic Minor": [0, 2, 3, 5, 7, 8, 11],
    "Hirajōshi": [0, 2, 3, 7, 8],
    "Hungarian": [0, 2, 3, 6, 7, 8, 11],
    "Insen": [0, 1, 5, 7, 10],
    "Iwato": [0, 1, 5, 6, 10],
    "Korsakovian": [0, 2, 3, 5, 6, 8, 9, 11],
    "Lydian": [0, 2, 4, 6, 7, 9, 11],
    "Major": [0, 2, 4, 5, 7, 9, 11],
    "Minor Pentatonic": [0, 3, 5, 7, 10],
    "Minyō": [0, 2, 5, 7, 9],
    "Pentatonic": [0, 2, 4, 7, 9],
    "Persian": [0, 1, 4, 5, 6, 8, 11],
    "Romanian": [0, 2, 3, 6, 7, 9, 10],
    "Triad Major": [0, 4, 7],
    "Triad Minor": [0, 3, 7],
    "Tuvan": [0, 2, 4, 6, 7, 9],
    "Whole Tone": [0, 2, 4, 6, 8, 10]
};
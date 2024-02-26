# https://www.midispatcher.online/

Midispatcher is a tool that allows you to design routes to send and receive MIDI signals between machines.

It connects to the MIDI devices plugged in your computer and provides a number of virtual components (virtual synths, keyboards, dispatching machines) to interact with them.

## How to use the tool

<p align="center">
    <img src='https://github.com/msarilar/midispatcher/assets/5569959/1a138b09-ec39-4d16-83b5-33664e67c27d' alt='Tutorial' height='600' />
</p>

Connecting to physical device Elektron Syntakt (used as output in this example) - 6 channels configured with the same monophonic synths and dispatching MIDI notes across them all to mimic polyphony:

<p align="center">
    <video src='https://github.com/msarilar/midispatcher/assets/5569959/f39f8e78-8530-4cd7-af7c-2e054147180d' height='600' />
</p>

## How to add a new machine

1. Determine the behaviour you want: emitting signals (implement `MachineSource`), receiving signals (implement `MachineTarget`) or both (`MachineSourceTarget`)
2. Declare a class to manage the logic of the machine, it should extend `AbstractMachine` and implement the behaviour interface determined above
3. Mark it with decorator `@registerMachine` and add the corresponding `require` in [index.tsx](src/index.tsx.tsx)
4. Ensure there is a static method `buildFactory(): MachineFactory` on your machine class which is responsible for creating the machine instances, the widget and determining the metadata (tooltip, unique machine code, label and type)

### Advanced usage includes:

1. Custom widgets (all machines have one except the MidiMachines used to represent physical devices)
2. State management (serialized/deserialized with the save/load buttons)
3. Parametrized factories (checkout [ToneJsSampleMachine](src/machines/ToneJsSampleMachine.tsx) for an example)

### Example machine:

```typescript
@registeredMachine
export class MyMachine extends AbstractMachine implements MachineSourceTarget {

    getState() {

        return undefined;
    }

    receive(messageEvent: MachineMessage, channel: number, link: MidiLinkModel): void {

        console.log(messageEvent);
    }

    getFactory() { return MyMachine.buildFactory(); }

    static buildFactory(): MachineFactory {

        const factory = {

            createMachine(): MyMachine { return new MyMachine(); },
            getName() { return "My machine"; },
            getType() { return MachineType.Processor; },
            getTooltip() { return "My custom machine"; },
            getMachineCode() { return "mymachine" }
        };

        return factory;
    }

    private constructor() {

        super();

        this.getNode().addMachineInPort("In", 0);
        this.getNode().addMachineOutPort("Out", 0);
    }
}
```

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

### `npm run deploy`

Deploy the app.

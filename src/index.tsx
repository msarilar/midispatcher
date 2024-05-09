import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import reportWebVitals from "./reportWebVitals";

require("./machines/ArpMachine");
require("./machines/ClockMachine");
require("./machines/DispatchingMachines");
require("./machines/DrumKitMachine");
require("./machines/KeyboardMachine");
require("./machines/MidiFileMachine");
require("./machines/OscillatorMachine");
require("./machines/ThruMachine");
require("./machines/ToneJsSampleMachine");
require("./machines/ToneJsSynthMachine");
require("./machines/RemoteMachines");
require("./machines/EuclidianSequencerMachine");

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
  <App />
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

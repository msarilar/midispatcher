import styled from "@emotion/styled";

export namespace S {

    export const Dropdown = styled.div`
        vertical-align: middle;
        width: 100%;
        span {

            vertical-align: middle;
        }
        input {

            vertical-align: middle;
        }
    `;

    export const Slider = styled.div`
        vertical-align: middle;
        input {

            vertical-align: middle;
        }
        span {

            vertical-align: middle;
        }
    `;

    export const Note = styled.div`
        height: 200px;
        position: relative;
        vertical-align: middle;
        width: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
    `;

    export const SettingsBarVertical = styled.div`
        position: relative;
        vertical-align: middle;
        width: 100%;
        display: flex;
        justifyContent: "down";
        flex-direction: row;
    `;

    export const SettingsBarHorizontal = styled.div`
        position: relative;
        vertical-align: middle;
        width: 100%;
        display: flex;
        justifyContent: "down";
        flex-direction: column;
        padding: 10px;
        padding: 0px;
    `;

    export const ExpandButton = styled.button<{ open: boolean }>`
        background: ${(p) => p.open ? "rgb(7, 133, 116)" : "rgb(7, 81, 7)"};
        float: center;
        border: solid;
        border-width: 1px;
        border-color: rgb(60, 60, 60);
        color: white;
        outline: none;
        cursor: pointer;
        border-radius: 5px;
        transition: all 0.3s ease-in-out;
    `;

    export const VoiceInput = styled.textarea<{ inError: boolean }>`
        display: inline-block;
        border: solid 1px black;
        width: 100%;
        white-space: pre;
        max-width: auto;
        font-size: 11px;
        padding: 5px;
        overflow-wrap: normal;
        overscroll-behavior: contain;
        overflow-y: hidden;
        overflow-x: hidden;
        background-color: ${(props) => (props.inError ? "#ffe6e6" : "white")};
    `;

    export const SettingsBar = styled.div`
        padding: 3px;
        position: relative;
        vertical-align: middle;
        width: auto;
        display: flex;
        justifyContent: "center";
        flex-direction: column;
    `;

    export const InternalWrapper = styled.div<{ open: boolean }>`
        width: 100%;
        height: ${(props) => (props.open ? "auto" : "0")};
        overflow: hidden;
    `;

    export const ConsoleLog = styled.div`
        max-height: 150px;
        overflow-y: auto;
        background: black;
        scroll-behavior: smooth;

        &::-webkit-scrollbar {

            width: 12px;
        }

        &::-webkit-scrollbar-track {

            -webkit-box-shadow: inset 0 0 6px #009633;
            border-radius: 0px;
        }

        &::-webkit-scrollbar-thumb {

            border-radius: 0px;
            -webkit-box-shadow: inset 0 0 6px white;
        }
    `;

    export const ConsoleLogEntry = styled.span`
    `;

    export const KeyboardBody = styled.div`
        ul {

            position:relative;
            border-radius:1em;
        }

        li {

            margin:0;
            padding:0;
            list-style:none;
            position:relative;
            float:left
        }

        ul .white {

            height:8em;
            width:3em;
            z-index:1;
            border-left:1px solid #bbb;
            border-bottom:1px solid #bbb;
            border-radius:0 0 5px 5px;
            box-shadow:-1px 0 0 rgba(255,255,255,0.8) inset,0 0 5px #ccc inset,0 0 3px rgba(0,0,0,0.2);
            background:linear-gradient(to bottom,#eee 0%,#fff 100%)
        }

        ul .white:active {

            border-top:1px solid #777;
            border-left:1px solid #999;
            border-bottom:1px solid #999;
            box-shadow:2px 0 3px rgba(0,0,0,0.1) inset,-5px 5px 20px rgba(0,0,0,0.2) inset,0 0 3px rgba(0,0,0,0.2);
            background:linear-gradient(to bottom,#fff 0%,#e9e9e9 100%)
        }

        .black {

            height:5em;
            width:1.5em;
            margin:0 0 0 -1em;
            z-index:2;
            border:1px solid #000;
            border-radius:0 0 3px 3px;
            box-shadow:-1px -1px 2px rgba(255,255,255,0.2) inset,0 -5px 2px 3px rgba(0,0,0,0.6) inset,0 2px 4px rgba(0,0,0,0.5);
            background:linear-gradient(45deg,#222 0%,#555 100%)
        }

        .black:active {

            box-shadow:-1px -1px 2px rgba(255,255,255,0.2) inset,0 -2px 2px 3px rgba(0,0,0,0.6) inset,0 1px 2px rgba(0,0,0,0.5);
            background:linear-gradient(to right,#444 0%,#222 100%)
        }

        .a,.g,.f,.d,.c {

            margin:0 0 0 -1em
        }

        ul li:first-of-type {

            border-radius:5px 0 5px 5px
        }

        ul li:last-child {

            border-radius:0 5px 5px 5px
        }
    `;
}

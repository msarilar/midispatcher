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
        background-color: ${(props) => (props.inError ? '#ffe6e6' : 'white')};
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
        height: ${(props) => (props.open ? 'auto' : '0')};
        overflow: hidden;
    `;
}